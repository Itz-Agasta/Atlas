import { z } from "zod";

/**
 * Main query endpoint for agent
 */
export const agentQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, "Query cannot be empty")
    .describe(
      "The question to analyze. Atlas Agent specializes in: 1) Data Analysis of Argo float oceanographic data, 2) Literature Review from research papers, 3) Hybrid queries combining data + research context, 4) General queries (greetings, casual chat)"
    ),
});

// TODO: Define a Zod schema for Agent output so that only the `response` field
// is sent to the frontend, reducing payload size and bandwidth usage.

/**
 * Test SQL input for debugging and testing specific SQL agents
 */
export const testSQLSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  agent: z.enum(["pg", "duckdb"]).describe("Which SQL agent to test"),
});

/**
 * Citation schema for research papers referenced in responses
 */
export const citationSchema = z.object({
  paperId: z.string().describe("Unique identifier for the paper"),
  title: z.string().describe("Title of the paper"),
  authors: z.array(z.string()).describe("List of author names"),
  doi: z.string().optional().describe("Digital Object Identifier"),
  year: z.number().describe("Publication year"),
  url: z.string().optional().describe("URL to the paper"),
  journal: z.string().optional().describe("Journal name"),
  relevanceScore: z
    .number()
    .optional()
    .describe("Relevance score (0-1) for this citation"),
});

/**
 * Scientific response from the orchestrator agent
 */
export const scientificResponseSchema = z.object({
  response: z.string().describe("The formatted response text"),
  citations: z.array(citationSchema).describe("List of cited papers"),
  timestamp: z.date().describe("Response generation timestamp"),
  tokensUsed: z.number().optional().describe("Total tokens used"),
  limitations: z
    .string()
    .optional()
    .describe("Known limitations of the response"),
  futureResearch: z
    .string()
    .optional()
    .describe("Suggestions for future research"),
});

// Export inferred types
export type Citation = z.infer<typeof citationSchema>;
export type ScientificResponse = z.infer<typeof scientificResponseSchema>;
