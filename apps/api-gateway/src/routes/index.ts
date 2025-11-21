import { publicProcedure, router } from "@atlas/api";
import { agentRouter } from "./v1/agent";

// Import and combine routers
export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
