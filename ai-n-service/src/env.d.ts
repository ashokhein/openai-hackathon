declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
      OPENAI_ORG_ID: string;
      POSTGRES_HOST: string;
      POSTGRES_PORT: string;
      POSTGRES_USERNAME: string;
      POSTGRES_PASSWORD: string;
      POSTGRES_DATABASE: string;
      CONFLUENCE_HOST: string;
      CONFLUENCE_EMAIL: string;
      CONFLUENCE_TOKEN: string;
      PAGE_IDS: string;
      SLACK_SIGNING_SECRET: string;
      SLACK_BOT_TOKEN: string;
      SLACK_APP_TOKEN: string;
      SLACK_PORT: string;
    }
  }
}

export {}
