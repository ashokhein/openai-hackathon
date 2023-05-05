//@ts-nocheck
import { UserError } from "./error";
import { createOpenaiClient } from "./client"
import { inspect } from "util";
import { Sequelize } from "sequelize";
import GPT3NodeTokenizer from "gpt3-tokenizer";
import { codeBlock, oneLine } from 'common-tags'
import { SayFn } from "@slack/bolt";

export const search = async (sequelize: Sequelize, query: string, say: SayFn) => {
    console.log(query)
    try {

        const openaiClient = createOpenaiClient();

        // Moderate the content to comply with OpenAI T&C
        const sanitizedQuery = query.trim()
        const moderationResponse = await openaiClient.createModeration({
            input: sanitizedQuery
        })

        const { results } = moderationResponse.data

        if (results[0].flagged) {
            throw new UserError('Flagged content', {
                flagged: true,
                categories: results[0].categories,
            })
        }

        const input = sanitizedQuery.replace(/\n/g, ' ')

        const embeddingResponse = await openaiClient.createEmbedding({
            model: 'text-embedding-ada-002',
            input
        })

        if (embeddingResponse.status !== 200) {
            throw new Error(inspect(embeddingResponse.data, false, 2))
        }

        const [responseData] = embeddingResponse.data.data

        const embedding = responseData.embedding

        const sortedDocumentResult = await sequelize.query(`select document_pages.page_id,document_pages.content from document_pages where (document_pages.embedding <#> '[${embedding}]') * -1 > 0.70 order by document_pages.embedding <#> '[${embedding}]' limit 10`)
        const sortedDocuments = sortedDocumentResult[0]

        // console.log(sortedDocuments)

        const tokenizer = new GPT3NodeTokenizer({ type: 'gpt3' })
        let tokenCount = 0
        let contextText = ''

        for (let i = 0; i < sortedDocuments.length; i++) {
            const pageSection = sortedDocuments[i]
            //@ts-ignore
            const content = pageSection.content
            const encoded = tokenizer.encode(content)
            tokenCount += encoded.text.length

            if (tokenCount >= 1500) {
                break
            }

            contextText += `${content.trim()}\n---\n`
        }

        // console.log(contextText)

        const prompt = codeBlock`
          ${oneLine`
            Given the following sections from the RocketLawyer
            documentation, answer the question using only that information,
            outputted in markdown format. If you are unsure and the answer
            is not explicitly written in the documentation, say
            "Sorry, I don't know how to help with that."
          `}
          Context sections:
          ${contextText}
          Question: """
          ${sanitizedQuery}
          """
          Answer as markdown (including related code snippets if available):
        `

        try {
            const completionResponse = await openaiClient.createCompletion({
                model: "text-davinci-003",
                prompt,
                max_tokens: 1000,
                temperature: 0
            });

            say(completionResponse.data.choices[0].text!)
        } catch (err) {
            console.error('An error occurred during OpenAI request', err);
        }
    } catch (err) {
        console.error('An error occurred during search', err);
    }
}

