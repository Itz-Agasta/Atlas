import { z } from "zod";
import { publicProcedure, router } from "../index";

// Input schemas co-located with router
export const agentQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, "Query cannot be empty")
    .describe(
      "The question to analyze. Atlas Agent specializes in: 1) Data Analysis of Argo float oceanographic data, 2) Literature Review from research papers, 3) Hybrid queries combining data + research context. 4) General queries (T&C)"
    ),
  floatId: z.number().optional().describe("Optional specific float WMO number"),
  includeRag: z.boolean().default(true).describe("Include literature review"),
  includeSql: z.boolean().default(true).describe("Include data analysis"),
  timeRange: z
    .object({
      start: z.string().optional().describe("Start date in ISO format"),
      end: z.string().optional().describe("End date in ISO format"),
    })
    .optional(),
  yearRange: z
    .object({
      start: z
        .number()
        .optional()
        .describe("Earliest publication year for papers"),
      end: z.number().optional().describe("Latest publication year for papers"),
    })
    .optional(),
});

export const testSQLInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  floatId: z.number().optional(),
  timeRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
});

export const classifyInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
});

// Export types for use in other parts of the monorepo
export type AgentQueryInput = z.infer<typeof agentQueryInputSchema>;
export type TestSQLInput = z.infer<typeof testSQLInputSchema>;
export type ClassifyInput = z.infer<typeof classifyInputSchema>;

export const agentRouter = router({
  query: publicProcedure
    .input(agentQueryInputSchema)
    .mutation(() => undefined as never),

  testSQL: publicProcedure
    .input(testSQLInputSchema)
    .query(() => undefined as never),

  classify: publicProcedure
    .input(classifyInputSchema)
    .query(() => undefined as never),
});

export type AgentRouter = typeof agentRouter;
