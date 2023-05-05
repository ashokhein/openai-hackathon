import { createHash } from "crypto";
import { inspect } from "util";
import { adfToMarkdown } from "./markdown";
import { Document, DocumentPage } from "./model";
import { createOpenaiClient } from "./client";
import { processMarkdown } from "./markdown-section";

export const verifyChecksum = async (content: string, pageId: string) => {
    const checksum = createHash("sha256").update(content).digest("hex");
    try {
        const document = await Document.findOne({ where: { page_id: pageId } });
        if (document !== null && document?.dataValues.checksum === checksum) {
            return {
                regenerate: false,
                checksum,
            };
        }
    } catch (err) {
        console.error(err);
    }
    return {
        regenerate: true,
        checksum,
    };
};

export const contentEmbedding = async (rawContent: string, path: string, pageId: string, heading: string) => {
    try {
        const isContent = await verifyChecksum(rawContent, pageId);

        if (isContent.regenerate) {
            await Document.upsert(
                {
                    page_id: pageId,
                    checksum: null,
                    path: path,
                    heading: heading
                },
                {
                    conflictFields: ["page_id"],
                }
            );

            await DocumentPage.destroy({
                where: { page_id: pageId },
            });

            const markdown = adfToMarkdown(JSON.parse(rawContent))
            const sections = processMarkdown(markdown);

            //generate a embedding
            console.log(`Begin: Generating embedding for ${path}`);

            sections.map(async (section) => {
                //OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
                const input = heading + " " + section.replace(/\n/g, " ")
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
                    page_id: pageId,
                    content: input,
                    // heading: section.title,
                    embedding: responseData.embedding,
                    token_count: embeddingResponse.data.usage.total_tokens
                });
            });

            await Document.upsert({
                page_id: pageId,
                checksum: isContent.checksum,
                path: path,
            }, { conflictFields: ["page_id"] });
            console.log(`End: Generating embedding for ${path}`);
        } else {
            console.log(`Page has not been changed ${path}`);
        }
    } catch (error: any) {
        console.error(`error in embedding: ${error.message} - ${pageId}`);
    }
};
