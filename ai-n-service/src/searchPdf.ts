//@ts-nocheck
import { SayFn } from "@slack/bolt";
import { makeChain } from "./makeChain";

const history = []

export const searchPdf = async (vectorStore: HNSWLib, query: string, say: SayFn) => {
    try {
        //create chain
        const chain = makeChain(vectorStore);
        //Ask a question using chat history
        const response = await chain.call({
            question: query,
            chat_history: history || [],
        });
        history.push(query)
        history.push(response)
        say(response);
    } catch (err) {
        console.error('An error occurred during searchPDF', err);
    }
}

