import express from "express";
import http from 'http';
import { json } from "body-parser";
import { connect } from './setupDB';
import { DocumentInit, DocumentPage, DocumentPageInit } from './model';
import { contentEmbedding } from './page';
import { createConfluenceClient, createOpenaiClient } from './client';
import { App as SlackApp } from '@slack/bolt'
import { search } from './search';
import dotenv from 'dotenv'
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { translatePdf } from "./translatePdf";
import { searchPdf } from "searchPdf";
import { pdfEmbedding } from "pdf";
const PDFDocument = require('pdfkit');
const fs = require('fs');

dotenv.config()

const main = async () => {

    try {
        const app = express();

        app.use(json())

        //Setup DB
        const sequelize = await connect()

        //Create Tables and Functions
        DocumentInit(sequelize)
        DocumentPageInit(sequelize)
        // createDocumentPageSelectionFunc(sequelize)

        //Create Clients
        const confluenceClient = createConfluenceClient()
        const openaiClient = createOpenaiClient()

        app.get("/healthcheck", async (_, res) => {
            res.json({
                "message": "OpenAI Node Service",
            })
        });

        app.get("/api/model", async (_, res) => {
            const response = await openaiClient.listModels();
            res.json(response.data.data)
        });

        app.get("/api/crawler", async (req, res) => {

            const query = req.query;// query = {loadFromEnv:boolean, pageId: string}
            const pageIds: string[] = []

            if (query?.loadFromEnv === "true") {
                process.env.PAGE_IDS?.split(",").map(pageId => pageIds.push(pageId))
            } else {
                if (query.pageId) {
                    pageIds.push(query.pageId.toString())
                } else {
                    res.json({
                        "error": "page id is missing",
                    })
                }
            }

            await pageIds.reduce(async (promise: any, pageId: string) => {
                await promise
                const content = await confluenceClient.content.getContentById({
                    id: pageId,
                    expand: ["children.page", "body.atlas_doc_format"]
                })

                await contentEmbedding(content.body?.atlas_doc_format?.value!, content._links?.webui!, content.id, content.title)

                await content.children?.page?.results.reduce(async (promise, child) => {
                    await promise
                    const childContent = await confluenceClient.content.getContentById({
                        id: child.id,
                        expand: ["body.atlas_doc_format"]
                    })
                    return contentEmbedding(childContent.body?.atlas_doc_format?.value!, childContent._links?.webui!, childContent.id, childContent.title)
                }, Promise.resolve())
            }, Promise.resolve())
            res.json({
                "message": "Successfully generated the embedded content"
            })
        })

        app.get("/read/pdf", async (_, res) => {
            res.setHeader('Content-Type', "application/pdf");
            res.setHeader("Content-Disposition", "attachment; filename=" + "PodsKubernetes.pdf");

            res.download("/tmp/PodsKubernetes.pdf", "PodsKubernetes.pdf", (err) => {
                if (err) {
                    res.status(500).send({
                        message: "could not download the file. " + err,
                    });
                }
            });
        });

        const pdfFileName = "/tmp/PodsKubernetes.pdf";
        let vectorStore: HNSWLib
        app.get("/api/loadpdf", async (_, res) => {
            try {
                const loader = new PDFLoader(pdfFileName)
                const documents = await loader.load()
                /* Split text into chunks */
                const textSplitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 200,
                });


                await DocumentPage.destroy({
                    where: { page_id: pdfFileName },
                });

                const docs = await textSplitter.splitDocuments(documents);

                await docs.reduce(async (promise, doc) => {
                    await promise
                    await pdfEmbedding(doc)
                }, Promise.resolve())

                // Load the docs into the vector store
                try {
                    //@ts-ignore
                    vectorStore = await HNSWLib.fromDocuments(
                        docs,
                        new OpenAIEmbeddings()
                    );

                    // Save the vector store to a directory
                    const directory = "/tmp/pdfindex";
                    await vectorStore.save(directory);

                } catch (err) {
                    console.error(err);
                }

            } catch (err) {
                console.error(err);
            }
            res.json({
                "message": "PDF Load",
            })
        });


        app.get("/api/translate-pdf", async (_, res) => {
            try {
                const loader = new PDFLoader("/tmp/PodsKubernetes-1.pdf")
                const documents = await loader.load()
                /* Split text into chunks */
                const textSplitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 200,
                });

                const docs = await textSplitter.splitDocuments(documents);

                // Create a document
                const translatedDoc = new PDFDocument();
                translatedDoc.pipe(fs.createWriteStream('/tmp/pdfindex')); // write to PDF

                await docs.reduce(async (promise, doc) => {
                    await promise
                    translatedDoc.text(await translatePdf(doc.pageContent))
                }, Promise.resolve())
                translatedDoc.end();
            } catch (err) {
                console.error(err);
            }
            res.json({
                "message": "PDF Translated",
            })
        });

        const httpServer = http.createServer(app);

        const PORT = process.env.PORT || 4000
        await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
        console.log(`👈 Server ready at http://localhost:${PORT}`);

        const slackApp = new SlackApp({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            socketMode: true, // enable the following to use socket mode
            appToken: process.env.SLACK_APP_TOKEN
        })

        const slackPort = 5000
        await slackApp.start(process.env.SLACK_PORT || 5000);
        console.log(`⚡️ Slack Bolt app is running on port ${slackPort}!`);

        slackApp.message("okgpt", async ({ payload, say }) => {
            //@ts-ignore
            // const question = payload.blocks[0].elements[0].elements[1].text.replace(" okrl", "").trim()
            const question = payload.text.replace(" okrl", "").trim()
            try {
                search(sequelize, question, say)
            } catch (error) {
                console.error(error);
            }
        });

        slackApp.message("okpdf", async ({ payload, say }) => {
            //@ts-ignore
            // const question = payload.blocks[0].elements[0].elements[1].text.replace(" okrl", "").trim()
            const question = payload.text.replace("okpdf", "").trim()
            try {
                // Load the vector store from the same directory
                const loadedVectorStore = await HNSWLib.load(
                    "/tmp/pdfindex",
                    new OpenAIEmbeddings()
                );
                searchPdf(loadedVectorStore, question, say)
            } catch (error) {
                console.error(error);
            }
        });
    } catch (error) {
        console.error(error);
    }
}

main()


