import { createGroq } from "@ai-sdk/groq";
import { generateText, tool } from "ai";
import { z } from "zod";
import { config } from "../config/config";
import {
  type QueryClassificationResult,
  QueryType,
} from "../models/query-types";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

/**
 * Query Classifier Agent
 * Determines the type of oceanographic query and routes to appropriate agents
 */
export const classifyQuery = tool({
  description:
    "Classify oceanographic research queries into appropriate categories",
  parameters: z.object({
    query: z.string().min(10).describe("The research question to classify"),
  }),
  execute: async ({ query }): Promise<QueryClassificationResult> => {
    try {
      const { text } = await generateText({
        model: groq(config.models.classifier),
        system: `You are an expert oceanography research assistant specializing in Argo float data analysis.

Classify queries into ONE of these categories:

1. DATA_ANALYSIS - Questions about specific Argo float measurements, trends, statistics
   Examples: "Show temperature profiles for float WMO-4903556"
             "Find floats with high salinity anomalies"
             "What's the average temperature at 1000m depth?"

2. LITERATURE_REVIEW - Questions about research papers and publications
   Examples: "What research exists on Argo float oxygen calibration?"
             "Find papers about ocean acidification"
             "Who has published work on Indian Ocean currents?"

3. HYBRID - Queries combining float data analysis with literature context
   Examples: "How do recent papers explain the temperature anomaly in float 4903556?"
             "Compare our salinity data with published research"
             "What does literature say about patterns in our data?"

4. METHODOLOGICAL - Questions about Argo procedures, techniques, QC
   Examples: "What are the QC procedures for Argo salinity?"
             "Explain Argo float deployment procedures"
             "How is temperature calibrated on Argo floats?"

5. FORECASTING - Trajectory predictions and environmental forecasts
   Examples: "Predict the next month's trajectory for this float"
             "Forecast temperature trends based on historical data"
             "Where will float 4903556 be in 30 days?"

6. GENERAL - Casual conversation, greetings, or non-research queries
   Examples: "hi", "hello", "how are you?", "what can you do?", "thanks"
             "what's your name?", "tell me about yourself"

Respond with ONLY the category name (e.g., "DATA_ANALYSIS") without any additional text.`,
        prompt: `Classify this query: "${query}"`,
        maxTokens: 50,
      });

      const queryType = text.trim() as z.infer<typeof QueryType>;

      // Validate the classification
      const validTypes = QueryType.options;
      if (!validTypes.includes(queryType as unknown as never)) {
        // Default to HYBRID if classification is uncertain
        return {
          queryType: "HYBRID",
          confidence: 0.5,
          reasoning: "Classification uncertain, defaulting to HYBRID approach",
        };
      }

      return {
        queryType,
        confidence: 0.95,
        reasoning: `Query classified as ${queryType}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to classify query: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

export function classifyQueryDirect(
  query: string
): Promise<QueryClassificationResult> {
  return classifyQuery.execute({ query });
}
