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
