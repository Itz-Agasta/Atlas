import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
});
export type AppRouter = typeof appRouter;
