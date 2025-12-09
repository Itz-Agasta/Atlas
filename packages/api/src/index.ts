import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

// Export context type
export type { Context } from "./context";

// Export shared domain types (explicit exports to avoid barrel file issues)
export type {
  Citation,
  DataQuality,
  ResearchPaperChunk,
  ScientificResponse,
} from "./types";
