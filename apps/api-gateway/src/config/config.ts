export const config = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",

  // Per-Agent Model Configuration
  models: {
    classifier: "llama-3.3-70b-versatile", // 128k context (non-reasoning, multilingual)
    sqlAgent: "llama-3.3-70b-versatile",
    ragAgent: "llama-3.3-70b-versatile",
    orchestrator: "x-ai/grok-4.1-fast", // 2M context (reasoning)
  },

  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",

  databaseUrl: process.env.DATABASE_URL || "",

  isDev: process.env.NODE_ENV !== "development",
};

// TODO: Later we will have 2 separate files under config. env.ts and config.ts
