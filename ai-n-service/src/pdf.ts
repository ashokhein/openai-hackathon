import { inspect } from "util";
import { DocumentPage } from "./model";
import { createOpenaiClient } from "./client";

export const pdfEmbedding = async (document: any) => {
    try {
        //generate a embedding
        console.log(`Begin: Generating embedding for ${document.metadata.source}`);

        //OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
        const input = document.pageContent.replace(/\n/g, " ")
        const openaiClient = createOpenaiClient();
        const embeddingResponse = await openaiClient.createEmbedding({
            model: "text-embedding-ada-002",
            input,
        });

        if (embeddingResponse.status !== 200) {
            throw new Error(inspect(embeddingResponse.data, false, 2));
        }

        const [responseData] = embeddingResponse.data.data;

        await DocumentPage.create({
            "page_id": document.metadata.source,
            content: input,
            // heading: section.title,
            embedding: responseData.embedding,
            token_count: embeddingResponse.data.usage.total_tokens
        });
        console.log(`End: Generating embedding for ${document.metadata.source}`);
    } catch (error: any) {
        console.error(`error in embedding: ${error.message}`);
    }
};
