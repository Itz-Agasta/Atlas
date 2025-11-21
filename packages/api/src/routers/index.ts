import { publicProcedure, router } from "../index";
import { agentRouter } from "./agent";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  agent: agentRouter,
});
export type AppRouter = typeof appRouter;
