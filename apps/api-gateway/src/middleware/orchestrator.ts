import { createGroq } from "@ai-sdk/groq";
import type { ScientificResponse } from "@atlas/api";
import { generateText } from "ai";
import { config } from "../config/config";
import {
  type AgentResults,
  calculateDataQuality,
  extractCitations,
  formatAgentContext,
} from "../utils/orchestrator-utils";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

/**
 * Response Orchestrator
 * Combines SQL and RAG results into comprehensive scientific response
 */
export async function responseOrchestrator(
  results: AgentResults
): Promise<ScientificResponse> {
  const startTime = Date.now();

  try {
    const { text, usage } = await generateText({
      model: groq(config.models.orchestrator),
      system: `You are an expert oceanographer and scientific writer specialized in Argo float data analysis.

Your task is to generate a comprehensive, well-cited response combining:
1. Float metadata analysis (locations, status, deployment info) from PostgreSQL - if available
2. Profile data analysis (temperature/salinity measurements, depth profiles) from DuckDB - if available
3. Supporting research from peer-reviewed literature - if available
4. Statistical rigor and uncertainty quantification
5. Proper academic citations

RESPONSE FORMAT:
- Start with key findings from the data analysis (metadata or profile data)
- Provide statistical context (mean, std dev, ranges, trends)
- Explain significance of the findings
- Connect to relevant research literature with citations
- Discuss limitations of the analysis
- Suggest future research directions

CITATION FORMAT:
- Use [Author et al., Year] format in text
- Be specific about which findings come from which papers
- Only cite papers that are actually relevant to the query

IMPORTANT:
- Be precise and quantitative when data is available
- Acknowledge uncertainties and limitations
- Use scientific terminology appropriately
- Keep response concise but comprehensive (200-500 words)
- If no data or papers are available, state this clearly`,

      prompt: formatAgentContext(results),
      maxOutputTokens: 2000,
    });

    const citations = extractCitations(results.ragResults);
    const dataQuality = calculateDataQuality(results);

    return {
      response: text,
      citations,
      dataQuality,
      timestamp: new Date(),
      tokensUsed: usage?.totalTokens,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(
      `Orchestration failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
