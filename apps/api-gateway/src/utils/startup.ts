import { config } from "../config/config";
import logger from "../config/logger";

export function logStartupDiagnostics(): void {
  logger.info("Starting Atlas API Gateway...");

  // Database Configuration
  const dbUrl = config.databaseUrl;
  if (dbUrl) {
    logger.info("Database connection configured", {
      host: new URL(dbUrl).hostname,
      database: new URL(dbUrl).pathname.slice(1),
    });
  } else {
    logger.error("DATABASE_URL not configured");
  }

  // Qdrant Configuration
  const qdrantUrl = config.qdrantUrl;
  const qdrantApiKey = config.qdrantApiKey;
  if (qdrantUrl && qdrantApiKey) {
    logger.info("Qdrant vector database configured", {
      url: qdrantUrl,
      apiKeyLength: qdrantApiKey.length,
    });
  } else {
    logger.warn("Qdrant not fully configured", {
      url: !!qdrantUrl,
      apiKey: !!qdrantApiKey,
    });
  }

  // AI Models Configuration
  const groqKey = config.groqApiKey;
  const openrouterKey = config.openRouterApiKey;

  logger.info("AI Models Status:", {
    groq: groqKey ? "Configured" : "Missing",
    openrouter: openrouterKey ? "Configured" : "Missing",
  });

  const hasAnyAIKey = Boolean(groqKey || openrouterKey);
  if (!hasAnyAIKey) {
    logger.error("No AI API keys configured!");
  }

  // CORS Configuration
  const corsOrigin = process.env.CORS_ORIGIN || "";
  logger.info("CORS Configuration:", {
    origin: corsOrigin || "Not configured",
  });

  // Environment
  logger.info("Environment:", {
    bunEnv: process.env.BUN_ENV || "development",
    logLevel: logger.level,
  });
}
