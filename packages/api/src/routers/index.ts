import { publicProcedure, router } from "../index";
import { agentRouter } from "./v1/agent";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  agent: agentRouter,
});
export type AppRouter = typeof appRouter;
