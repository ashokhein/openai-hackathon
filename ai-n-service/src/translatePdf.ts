//@ts-nocheck
import { UserError } from "./error";
import { createOpenaiClient } from "./client"
import { inspect } from "util";
import { Sequelize } from "sequelize";
import GPT3NodeTokenizer from "gpt3-tokenizer";
import { codeBlock, oneLine } from 'common-tags'
import { SayFn } from "@slack/bolt";

export const translatePdf = async (contextText: string) => {
    try {
        const openaiClient = createOpenaiClient();

        const prompt = codeBlock`
          ${oneLine`
            You are a AI Language Translator. Can you translate the give context section to the following language? Translation should not change the way of meaning, grammer, content."
          `}
          Context sections:
          ${contextText}
          Question: """
          French
          """
        `
        try {
            const completionResponse = await openaiClient.createCompletion({
                model: "text-davinci-003",
                prompt,
                max_tokens: 1000,
                temperature: 0
            });

            return completionResponse.data.choices[0].text!
        } catch (err) {
            console.error('An error occurred during OpenAI request', err);
        }
    } catch (err) {
        console.error('An error occurred during searchPDF', err);
    }
}

