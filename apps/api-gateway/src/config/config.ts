export const config = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",

  // Per-Agent Model Configuration
  models: {
    router: "llama-3.3-70b-versatile",
    sqlAgent: "llama-3.3-70b-versatile", // 128k context (non-reasoning, multilingual)
    duckdbAgent: "llama-3.3-70b-versatile",
    ragAgent: "llama-3.3-70b-versatile",
    generalAgent: "llama-3.3-70b-versatile",
    orchestrator: "llama-3.3-70b-versatile",
  },

  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",

  databaseUrl: process.env.PG_READ_URL || "",

  // S3/R2 Configuration for DuckDB
  s3: {
    accessKey: process.env.S3_ACCESS_KEY || "",
    secretKey: process.env.S3_SECRET_KEY || "",
    endpoint: process.env.S3_ENDPOINT || "",
    bucket: process.env.S3_BUCKET_NAME || "",
    region: process.env.S3_REGION || "auto",
  },

  isDev: process.env.BUN_ENV !== "production",
};

// TODO: Later we will have 2 separate files under config. env.ts and config.ts
