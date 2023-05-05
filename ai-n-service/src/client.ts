import { ConfluenceClient } from "confluence.js";
import { Configuration, OpenAIApi } from "openai";

export const createOpenaiClient = () => {
    const configuration = new Configuration({
        organization: process.env.OPENAI_ORG_ID,
        apiKey: process.env.OPENAI_API_KEY,
    });
    return new OpenAIApi(configuration)
}

export const createConfluenceClient = () => new ConfluenceClient({
    host: process.env.CONFLUENCE_HOST!,
    authentication: {
        basic: {
            email: process.env.CONFLUENCE_EMAIL!,
            apiToken: process.env.CONFLUENCE_TOKEN!,
        },
    },
});
