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
  routingTime: number;
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
  orchestrationTime: number;
  orchestrationTokens: number;
  totalTime: number;
}) {
  const {
    routingTime,
    generalResult,
    sqlResults,
    duckdbResults,
    ragResults,
    orchestrationTime,
    orchestrationTokens,
    totalTime,
  } = params;

  const totalTokens =
    (generalResult?.tokensUsed || 0) +
    (sqlResults?.tokensUsed || 0) +
    (duckdbResults?.tokensUsed || 0) +
    (ragResults?.tokensUsed || 0) +
    orchestrationTokens;

  return {
    routing: { timeMs: routingTime },
    general: generalResult
      ? {
          timeMs: generalResult.timings.total,
          tokensUsed: generalResult.tokensUsed || 0,
        }
      : null,
    sql: sqlResults
      ? {
          timeMs: sqlResults.timings.total,
          tokensUsed: sqlResults.tokensUsed || 0,
          llmTimeMs: sqlResults.timings.llmResponse,
          dbTimeMs: sqlResults.timings.dbExecution,
        }
      : null,
    duckdb: duckdbResults
      ? {
          timeMs: duckdbResults.timings.total,
          tokensUsed: duckdbResults.tokensUsed || 0,
          llmTimeMs: duckdbResults.timings.llmResponse,
          dbTimeMs: duckdbResults.timings.dbExecution,
        }
      : null,
    rag: ragResults
      ? {
          timeMs: ragResults.timings.total,
          tokensUsed: ragResults.tokensUsed || 0,
          papersFound: ragResults.papersFound || 0,
        }
      : null,
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
