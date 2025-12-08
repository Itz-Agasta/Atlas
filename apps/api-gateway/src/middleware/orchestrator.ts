import { createOpenAI } from "@ai-sdk/openai";
import type { Citation, ScientificResponse } from "@atlas/api";
import { generateText } from "ai";
import type { DuckDBAgentResult } from "../agents/duckdb-agent";
import type { RAGAgentResult } from "../agents/rag-agent";
import type { SQLAgentResult } from "../agents/sql-agent";
import { config } from "../config/config";

const openrouter = createOpenAI({
  apiKey: config.openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// Constants
const MAX_EXCERPT_LENGTH = 300;
const MAX_DUCKDB_ROWS_IN_CONTEXT = 100;

export type AgentResults = {
  queryType: string;
  originalQuery: string;
  sqlResults?: SQLAgentResult;
  duckdbResults?: DuckDBAgentResult;
  ragResults?: RAGAgentResult;
};

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
      model: openrouter(config.models.orchestrator), // NOTE: Uses massive context window model for orchestration
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
      queryType: results.queryType,
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

function formatAgentContext(results: AgentResults): string {
  let context = `ORIGINAL QUERY: ${results.originalQuery}\n\n`;
  context += `QUERY TYPE: ${results.queryType}\n\n`;

  context += formatSQLContext(results.sqlResults);
  context += formatDuckDBContext(results.duckdbResults);
  context += formatRAGContext(results.ragResults);
  context += formatNoDataWarning(results);

  return context;
}

function formatSQLContext(sqlResults?: SQLAgentResult): string {
  if (!sqlResults) {
    return "";
  }

  if (sqlResults.success && sqlResults.data) {
    let context = "ARGO FLOAT METADATA ANALYSIS (PostgreSQL):\n";
    context += `SQL Query Executed:\n${sqlResults.sql}\n\n`;
    context += `Results (${sqlResults.rowCount} rows):\n`;
    context += JSON.stringify(sqlResults.data, null, 2);
    context += "\n\n";
    return context;
  }

  if (sqlResults.error) {
    return `METADATA QUERY ERROR: ${sqlResults.error}\n\n`;
  }

  return "";
}

function formatDuckDBContext(duckdbResults?: DuckDBAgentResult): string {
  if (!duckdbResults) {
    return "";
  }

  if (duckdbResults.success && duckdbResults.data) {
    let context = "ARGO PROFILE DATA ANALYSIS (DuckDB on Parquet):\n";
    context += `DuckDB Query Executed:\n${duckdbResults.sql}\n\n`;
    context += `Results (${duckdbResults.rowCount} rows):\n`;
    context += JSON.stringify(
      duckdbResults.data.slice(0, MAX_DUCKDB_ROWS_IN_CONTEXT),
      null,
      2
    );
    if (
      duckdbResults.rowCount &&
      duckdbResults.rowCount > MAX_DUCKDB_ROWS_IN_CONTEXT
    ) {
      context += `\n... (showing first ${MAX_DUCKDB_ROWS_IN_CONTEXT} of ${duckdbResults.rowCount} rows)\n`;
    }
    context += "\n\n";
    return context;
  }

  if (duckdbResults.error) {
    return `PROFILE DATA QUERY ERROR: ${duckdbResults.error}\n\n`;
  }

  return "";
}

function formatRAGContext(ragResults?: RAGAgentResult): string {
  if (!ragResults) {
    return "";
  }

  if (ragResults.success && ragResults.papers) {
    let context = "RELEVANT RESEARCH PAPERS:\n\n";
    for (const [idx, paper] of ragResults.papers.entries()) {
      context += formatPaperCitation(idx + 1, paper);
    }
    return context;
  }

  if (ragResults.error) {
    return `LITERATURE SEARCH ERROR: ${ragResults.error}\n\n`;
  }

  return "";
}

function formatPaperCitation(
  index: number,
  paper: {
    title: string;
    authors: string[];
    year: number;
    journal?: string;
    doi?: string;
    url?: string;
    score: number;
    chunk: string;
  }
): string {
  let citation = `${index}. "${paper.title}"\n`;
  citation += `   Authors: ${paper.authors.join(", ")}\n`;
  citation += `   Year: ${paper.year}`;
  if (paper.journal) {
    citation += `, Journal: ${paper.journal}`;
  }
  citation += "\n";
  if (paper.doi) {
    citation += `   DOI: ${paper.doi}\n`;
  }
  if (paper.url) {
    citation += `   URL: ${paper.url}\n`;
  }
  citation += `   Relevance Score: ${paper.score.toFixed(2)}\n`;
  citation += `   Relevant Excerpt: "${paper.chunk.substring(0, MAX_EXCERPT_LENGTH)}..."\n\n`;
  return citation;
}

function formatNoDataWarning(results: AgentResults): string {
  const hasNoSQL = !results.sqlResults?.success;
  const hasNoDuckDB = !results.duckdbResults?.success;
  const hasNoRAG = !results.ragResults?.success;

  if (hasNoSQL && hasNoDuckDB && hasNoRAG) {
    return "Note: No data or literature was successfully retrieved. Provide a general response based on oceanographic knowledge.\n";
  }
  return "";
}

function extractCitations(ragResults?: RAGAgentResult): Citation[] {
  if (!ragResults?.papers) {
    return [];
  }

  return ragResults.papers.map((paper) => ({
    paperId: paper.paperId,
    title: paper.title,
    authors: paper.authors,
    doi: paper.doi,
    year: paper.year,
    url: paper.url,
    journal: paper.journal,
    relevanceScore: paper.score,
  }));
}

function calculateDataQuality(results: AgentResults) {
  const floatsAnalyzed =
    (results.sqlResults?.rowCount || 0) +
    (results.duckdbResults?.rowCount || 0);
  const papersReferenced = results.ragResults?.papersFound || 0;
  const sqlQueriesExecuted = results.sqlResults?.success ? 1 : 0;
  const duckdbQueriesExecuted = results.duckdbResults?.success ? 1 : 0;
  const ragSearchesPerformed = results.ragResults?.success ? 1 : 0;

  let averageCitationRelevance: number | undefined;
  if (results.ragResults?.papers && results.ragResults.papers.length > 0) {
    const totalScore = results.ragResults.papers.reduce(
      (sum, paper) => sum + paper.score,
      0
    );
    averageCitationRelevance = totalScore / results.ragResults.papers.length;
  }

  return {
    floatsAnalyzed,
    papersReferenced,
    sqlQueriesExecuted: sqlQueriesExecuted + duckdbQueriesExecuted,
    ragSearchesPerformed,
    averageCitationRelevance,
  };
}
