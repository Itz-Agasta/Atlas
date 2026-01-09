import type { DuckDBAgentResult } from "../agents/duckdb-agent";
import type { RAGAgentResult } from "../agents/rag-agent";
import type { SQLAgentResult } from "../agents/sql-agent";

/**
 * Agent results type for orchestration
 */
export type AgentResults = {
  originalQuery: string;
  sqlResults?: SQLAgentResult;
  duckdbResults?: DuckDBAgentResult;
  ragResults?: RAGAgentResult;
};

/**
 * Paper type for RAG results
 */
type Paper = {
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  score: number;
  chunk: string;
};

/**
 * Format complete agent context for LLM prompt
 */
export function formatAgentContext(results: AgentResults): string {
  let context = `ORIGINAL QUERY: ${results.originalQuery}\n\n`;

  context += formatSQLContext(results.sqlResults);
  context += formatDuckDBContext(results.duckdbResults);
  context += formatRAGContext(results.ragResults);
  context += formatNoDataWarning(results);

  return context;
}

/**
 * Constants for data summarization
 */
export const SUMMARIZATION_CONSTANTS = {
  MAX_EXCERPT_LENGTH: 300,
  MAX_SQL_ROWS_TO_SHOW: 5,
  MAX_DUCKDB_SAMPLE_ROWS: 10,
  MAX_STATS_COLUMNS: 5,
  DECIMAL_PRECISION: 3,
} as const;

/**
 * Statistical summary of numeric data
 */
export type DataStats = {
  mean: number;
  min: number;
  max: number;
  median: number;
  count: number;
};

/**
 * Calculate statistical summary of numeric data
 */
export function calculateStats(data: number[]): DataStats {
  if (data.length === 0) {
    return { mean: 0, min: 0, max: 0, median: 0, count: 0 };
  }
  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((acc, val) => acc + val, 0);
  const mean = sum / data.length;
  const len = sorted.length;
  const mid = Math.floor(len / 2);
  let median: number;
  if (len % 2 === 0) {
    const a = sorted[mid - 1] ?? 0;
    const b = sorted[mid] ?? 0;
    median = (a + b) / 2;
  } else {
    median = sorted[mid] ?? 0;
  }
  const precision = SUMMARIZATION_CONSTANTS.DECIMAL_PRECISION;
  return {
    mean: Number(mean.toFixed(precision)),
    min: Number((sorted[0] ?? 0).toFixed(precision)),
    max: Number((sorted.at(-1) ?? 0).toFixed(precision)),
    median: Number((median as number).toFixed(precision)),
    count: data.length,
  };
}

/**
 * Format DuckDB profile data statistics
 */
export function formatProfileStatistics(data: unknown[]): string {
  if (data.length === 0) {
    return "";
  }

  const rows = data as unknown[][];
  if (!Array.isArray(rows[0])) {
    return "";
  }

  const numColumns = rows[0]?.length ?? 0;
  let statsContext = `\nData Structure: ${numColumns} columns per row\n`;
  const columnNames = ["Pressure", "Temperature", "Salinity"];

  for (
    let colIdx = 0;
    colIdx < Math.min(numColumns, SUMMARIZATION_CONSTANTS.MAX_STATS_COLUMNS);
    colIdx++
  ) {
    const columnData = rows
      .map((row) => row[colIdx])
      .filter((val) => typeof val === "number") as number[];

    if (columnData.length > 0) {
      const stats = calculateStats(columnData);
      const colName = columnNames[colIdx] ?? `Column ${colIdx}`;
      statsContext += `${colName} Stats: min=${stats.min}, max=${stats.max}, mean=${stats.mean}, median=${stats.median}\n`;
    }
  }

  return statsContext;
}

/**
 * Format SQL results with sample rows
 */
export function formatSQLContext(sqlResults?: SQLAgentResult): string {
  if (!sqlResults) {
    return "";
  }

  if (sqlResults.success && sqlResults.data) {
    let context = "ARGO FLOAT METADATA ANALYSIS (PostgreSQL):\n";
    context += `SQL Query Executed:\n${sqlResults.sql}\n\n`;
    context += `Total Rows: ${sqlResults.rowCount ?? 0}\n`;

    const rowCount = sqlResults.rowCount ?? 0;
    if (rowCount > 0) {
      const sampleRows = sqlResults.data.slice(
        0,
        SUMMARIZATION_CONSTANTS.MAX_SQL_ROWS_TO_SHOW
      );
      const numRowsToShow = Math.min(
        SUMMARIZATION_CONSTANTS.MAX_SQL_ROWS_TO_SHOW,
        rowCount
      );
      context += `\nSample Data (first ${numRowsToShow} rows):\n`;
      context += JSON.stringify(sampleRows, null, 2);

      if (rowCount > SUMMARIZATION_CONSTANTS.MAX_SQL_ROWS_TO_SHOW) {
        context += `\n... (${rowCount - SUMMARIZATION_CONSTANTS.MAX_SQL_ROWS_TO_SHOW} more rows not shown)`;
      }
    }
    context += "\n\n";
    return context;
  }

  if (sqlResults.error) {
    return `METADATA QUERY ERROR: ${sqlResults.error}\n\n`;
  }

  return "";
}

/**
 * Format DuckDB results with statistics and sample rows
 */
export function formatDuckDBContext(duckdbResults?: DuckDBAgentResult): string {
  if (!duckdbResults) {
    return "";
  }

  if (duckdbResults.success && duckdbResults.data) {
    let context = "ARGO PROFILE DATA ANALYSIS (DuckDB on Parquet):\n";
    context += `DuckDB Query Executed:\n${duckdbResults.sql}\n\n`;
    context += `Total Rows: ${duckdbResults.rowCount}\n`;

    if (duckdbResults.data.length > 0 && Array.isArray(duckdbResults.data[0])) {
      // Add statistics
      context += formatProfileStatistics(duckdbResults.data);

      // Show sample rows
      const sampleData = duckdbResults.data.slice(
        0,
        SUMMARIZATION_CONSTANTS.MAX_DUCKDB_SAMPLE_ROWS
      );
      const numRowsToShow = Math.min(
        SUMMARIZATION_CONSTANTS.MAX_DUCKDB_SAMPLE_ROWS,
        duckdbResults.rowCount ?? 0
      );
      context += `\nSample Data (first ${numRowsToShow} rows):\n`;
      context += JSON.stringify(sampleData, null, 2);

      if (
        (duckdbResults.rowCount ?? 0) >
        SUMMARIZATION_CONSTANTS.MAX_DUCKDB_SAMPLE_ROWS
      ) {
        context += `\n... (${(duckdbResults.rowCount ?? 0) - SUMMARIZATION_CONSTANTS.MAX_DUCKDB_SAMPLE_ROWS} more rows - statistics above represent full dataset)`;
      }
    } else {
      // Fallback for non-array data
      const sampleData = duckdbResults.data.slice(
        0,
        SUMMARIZATION_CONSTANTS.MAX_DUCKDB_SAMPLE_ROWS
      );
      context += JSON.stringify(sampleData, null, 2);
    }

    context += "\n\n";
    return context;
  }

  if (duckdbResults.error) {
    return `PROFILE DATA QUERY ERROR: ${duckdbResults.error}\n\n`;
  }

  return "";
}

/**
 * Format research paper citation
 */
export function formatPaperCitation(
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
  citation += `   Relevant Excerpt: "${paper.chunk.substring(0, SUMMARIZATION_CONSTANTS.MAX_EXCERPT_LENGTH)}..."\n\n`;
  return citation;
}

/**
 * Format RAG results with all papers
 */
export function formatRAGContext(ragResults?: RAGAgentResult): string {
  if (!ragResults) {
    return "";
  }

  if (ragResults.success && ragResults.papers) {
    let context = "RELEVANT RESEARCH PAPERS:\n\n";
    ragResults.papers.forEach((paper, idx) => {
      context += formatPaperCitation(idx + 1, paper);
    });
    return context;
  }

  if (ragResults.error) {
    return `LITERATURE SEARCH ERROR: ${ragResults.error}\n\n`;
  }

  return "";
}

/**
 * Format warning when no data is available
 */
export function formatNoDataWarning(results: AgentResults): string {
  const hasNoSQL = !results.sqlResults?.success;
  const hasNoDuckDB = !results.duckdbResults?.success;
  const hasNoRAG = !results.ragResults?.success;

  if (hasNoSQL && hasNoDuckDB && hasNoRAG) {
    return "Note: No data or literature was successfully retrieved. Provide a general response based on oceanographic knowledge.\n";
  }
  return "";
}

/**
 * Extract citations from RAG results
 */
export function extractCitations(ragResults?: RAGAgentResult) {
  if (!ragResults?.papers) {
    return [];
  }

  return ragResults.papers.map((paper: Paper) => ({
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

/**
 * Calculate data quality metrics from all agents
 */
export function calculateDataQuality(results: AgentResults) {
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
      (sum: number, paper: Paper) => sum + paper.score,
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
