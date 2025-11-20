import "dotenv/config";
import { createContext } from "@atlas/api/context";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import logger from "./config/logger";
import { appRouter } from "./routes/index";
import { logServerReady, logStartupDiagnostics } from "./utils/startup";

const app = new Hono();

logStartupDiagnostics();

app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "",
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

logger.info("Middleware configured: CORS, Logger");

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  })
);

logger.info("tRPC router mounted at /trpc");

app.get("/", (c) => {
  c.header("Content-Type", "text/plain");
  return c.text("OK from Agasta");
});

app.get("/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

const port = Number.parseInt(process.env.PORT || "3000", 10);

export default {
  port,
  fetch: app.fetch,
};

logServerReady(port);
