import type { RoutingDecision } from "../agents/router-agent";

// FIXME: All tehse types should be infer from zod schema
export type ScientificResponse = {
  response: string;
  citations: Citation[];
  dataQuality: DataQuality;
  timestamp: Date;
  tokensUsed?: number;
  processingTimeMs?: number;
  limitations?: string;
  futureResearch?: string;
};

export type DataQuality = {
  floatsAnalyzed: number;
  papersReferenced: number;
  sqlQueriesExecuted: number;
  ragSearchesPerformed: number;
  averageCitationRelevance?: number;
};

export type Citation = {
  paperId: string;
  title: string;
  authors: string[];
  doi?: string;
  year: number;
  url?: string;
  journal?: string;
  relevanceScore?: number;
};

const TRAILING_SEMICOLONS_REGEX = /;+\s*$/;
const DISALLOWED_KEYWORDS_REGEX =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK)\b/;

/**
 * Validate that generated SQL to keep agent read‑only
 * This guards against multi‑statement execution even if the LLM goes off‑spec.
 */
export function validateSQL(sqlQuery: string): {
  isValid: boolean;
  cleaned: string;
} {
  const cleanedSQL = sqlQuery
    .trim()
    .replace(/^```sql\n?|```$/g, "")
    .trim();

  const withoutTrailingSemicolons = cleanedSQL.replace(
    TRAILING_SEMICOLONS_REGEX,
    ""
  );

  const upperSQL = withoutTrailingSemicolons.toUpperCase();
  const startsWithSelectOrWith =
    upperSQL.startsWith("SELECT") || upperSQL.startsWith("WITH");

  const hasExtraSemicolon = upperSQL.includes(";");
  const hasDisallowedKeyword = DISALLOWED_KEYWORDS_REGEX.test(upperSQL);

  const isValid =
    startsWithSelectOrWith && !hasExtraSemicolon && !hasDisallowedKeyword;

  return { isValid, cleaned: withoutTrailingSemicolons };
}

/**
 * Build agent metrics from agent execution results
 * Each agent returns its own timing and token usage - we just aggregate them
 */
export function buildAgentMetrics(params: {
  routing?: {
    decision: RoutingDecision;
    timeMs: number;
  };
  generalResult?: {
    tokensUsed?: number;
    timings: { total: number };
  };
  sqlResults?: {
    tokensUsed?: number;
    timings: { total: number; llmResponse?: number; dbExecution?: number };
  };
  duckdbResults?: {
    tokensUsed?: number;
    timings: { total: number; llmResponse?: number; dbExecution?: number };
  };
  ragResults?: {
    tokensUsed?: number;
    timings: { total: number };
    papersFound?: number;
  };
  orchestration?: {
    result: ScientificResponse;
    timeMs: number;
  };
  totalTime: number;
}) {
  const {
    routing,
    generalResult,
    sqlResults,
    duckdbResults,
    ragResults,
    orchestration,
    totalTime,
  } = params;

  const routingTime = routing?.timeMs || 0;
  const routingTokens = routing?.decision.tokensUsed || 0;
  const orchestrationTime = orchestration?.timeMs || 0;
  const orchestrationTokens = orchestration?.result.tokensUsed || 0;

  const totalTokens =
    routingTokens +
    (generalResult?.tokensUsed || 0) +
    (sqlResults?.tokensUsed || 0) +
    (duckdbResults?.tokensUsed || 0) +
    (ragResults?.tokensUsed || 0) +
    orchestrationTokens;

  return {
    routing: { timeMs: routingTime, tokensUsed: routingTokens },
    general: buildGeneralMetrics(generalResult),
    sql: buildSqlMetrics(sqlResults),
    duckdb: buildDuckdbMetrics(duckdbResults),
    rag: buildRagMetrics(ragResults),
    orchestrator: {
      timeMs: orchestrationTime,
      tokensUsed: orchestrationTokens,
    },
    total: {
      timeMs: totalTime,
      tokensUsed: totalTokens,
    },
  };
}

function buildGeneralMetrics(result?: {
  tokensUsed?: number;
  timings: { total: number };
}) {
  return result
    ? {
        timeMs: result.timings.total,
        tokensUsed: result.tokensUsed || 0,
      }
    : null;
}

function buildSqlMetrics(result?: {
  tokensUsed?: number;
  timings: { total: number; llmResponse?: number; dbExecution?: number };
}) {
  return result
    ? {
        timeMs: result.timings.total,
        tokensUsed: result.tokensUsed || 0,
        llmTimeMs: result.timings.llmResponse,
        dbTimeMs: result.timings.dbExecution,
      }
    : null;
}

function buildDuckdbMetrics(result?: {
  tokensUsed?: number;
  timings: { total: number; llmResponse?: number; dbExecution?: number };
}) {
  return result
    ? {
        timeMs: result.timings.total,
        tokensUsed: result.tokensUsed || 0,
        llmTimeMs: result.timings.llmResponse,
        dbTimeMs: result.timings.dbExecution,
      }
    : null;
}

function buildRagMetrics(result?: {
  tokensUsed?: number;
  timings: { total: number };
  papersFound?: number;
}) {
  return result
    ? {
        timeMs: result.timings.total,
        tokensUsed: result.tokensUsed || 0,
        papersFound: result.papersFound || 0,
      }
    : null;
}
