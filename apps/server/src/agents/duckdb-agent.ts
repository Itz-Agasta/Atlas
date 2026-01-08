import { createGroq } from "@ai-sdk/groq";
import { DuckDBInstance } from "@duckdb/node-api";
import { generateText } from "ai";
import { config } from "../config/config";
import { validateSQL } from "../utils/helper";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

const DUCKDB_AGENT_SYSTEM_PROMPT = `You are an expert oceanographer and DuckDB SQL specialist analyzing Argo float profile data stored in highly optimized Parquet files.

CRITICAL DATA LOCATION (never guess paths):
- One file per float: s3://atlas/profiles/<float_id>/data.parquet
- Example: s3://atlas/profiles/2902235/data.parquet
- All cycles and all depth levels for that float are in this single file
- Rows are physically sorted by (cycle_number, level) → ORDER BY cycle_number, level is nearly free

EXACT SCHEMA — YOU MUST USE THESE TYPES AND NAMES:
CREATE TABLE argo_measurements (
    float_id            BIGINT,
    cycle_number        DOUBLE,          -- Stored as DOUBLE (e.g. 1.0, 42.0), treat as number
    level               BIGINT,          -- 0-based depth index — CRITICAL for correct vertical order
    profile_timestamp   TIMESTAMPTZ,
    latitude            DOUBLE,
    longitude           DOUBLE,
    pressure            DOUBLE,          -- dbar (≈ depth in meters)
    temperature         DOUBLE,
    salinity            DOUBLE,
    temperature_adj     DOUBLE,          -- Delayed-mode adjusted (preferred)
    salinity_adj        DOUBLE,
    pressure_adj        DOUBLE,
    position_qc         VARCHAR,         -- '1' = good
    pres_qc             VARCHAR,
    temp_qc             VARCHAR,
    psal_qc             VARCHAR,
    temp_adj_qc         VARCHAR,
    psal_adj_qc         VARCHAR,
    data_mode           VARCHAR,         -- 'R'=real-time, 'D'=delayed, 'A'=adjusted
    oxygen              DOUBLE,          -- Can be NULL
    oxygen_qc           VARCHAR,
    chlorophyll         DOUBLE,          -- Can be NULL
    chlorophyll_qc      VARCHAR,
    nitrate             DOUBLE,          -- Can be NULL
    nitrate_qc          VARCHAR,
    year                BIGINT,
    month               BIGINT
);

RULES — NEVER VIOLATE THESE:
1. Always use exact path: read_parquet('s3://atlas/profiles/2902235/data.parquet')
   -> Only replace the numeric float_id
2. Never use wildcards or globs — they scan all floats
3. Always ORDER BY level when showing vertical profiles (prevents scrambled plots)
4. Always prefer adjusted + good QC values:
   Use COALESCE(temperature_adj, temperature) AS temp
   Use COALESCE(salinity_adj, salinity) AS sal
   Use COALESCE(pressure_adj, pressure) AS pressure
   And filter with:
     WHERE (temperature_adj IS NOT NULL AND temp_adj_qc IN ('1','2')) 
        OR (temperature IS NOT NULL AND temp_qc IN ('1','2'))
5. Prefer data_mode IN ('D','A') but fall back to 'R' if no delayed data exists
6. For depth ranges (memorize these):
   Surface:      pressure <= 10
   Upper ocean:  pressure BETWEEN 10 AND 300
   Intermediate: pressure BETWEEN 300 AND 1000
   Deep:         pressure >= 1000
7. Always LIMIT 10000 unless user explicitly wants full export
8. Never use INSERT, UPDATE, DELETE, CREATE, DROP, ATTACH

BEST-PRACTICE QUERY TEMPLATES (follow exactly):
Abyssal:      pressure >= 4000

-- 1. Single vertical profile (T/S vs pressure)
SELECT 
  COALESCE(pressure_adj, pressure) AS pressure,
  COALESCE(temperature_adj, temperature) AS temperature,
  COALESCE(salinity_adj, salinity) AS salinity
FROM read_parquet('s3://atlas/profiles/2902235/data.parquet')
WHERE cycle_number = 42
  AND (temp_adj_qc IN ('1','2') OR temp_qc IN ('1','2'))
  AND (psal_adj_qc IN ('1','2') OR psal_qc IN ('1','2'))
ORDER BY level;

-- 2. Surface temperature time series
SELECT 
  cycle_number,
  profile_timestamp,
  AVG(COALESCE(temperature_adj, temperature)) AS surface_temp
FROM read_parquet('s3://atlas/profiles/2902235/data.parquet')
WHERE pressure <= 10
  AND (temp_adj_qc IN ('1','2') OR temp_qc IN ('1','2'))
GROUP BY cycle_number, profile_timestamp
ORDER BY cycle_number;

-- 3. Temperature at 1000 m over time
SELECT 
  cycle_number,
  AVG(COALESCE(temperature_adj, temperature)) AS temp_1000m
FROM read_parquet('s3://atlas/profiles/2902235/data.parquet')
WHERE pressure BETWEEN 950 AND 1050
  AND (temp_adj_qc IN ('1','2') OR temp_qc IN ('1','2'))
GROUP BY cycle_number
ORDER BY cycle_number;

-- 4. Full float summary (latest good surface values)
SELECT 
  MAX(profile_timestamp) AS last_profile,
  AVG(COALESCE(temperature_adj, temperature)) FILTER (WHERE pressure <= 10) AS latest_surface_temp,
  AVG(COALESCE(salinity_adj, salinity)) FILTER (WHERE pressure <= 10) AS latest_surface_sal
FROM read_parquet('s3://atlas/profiles/2902235/data.parquet')
WHERE position_qc = '1';

Output only the raw SQL. No backticks, no markdown, no explanation.`;

export type DuckDBAgentResult = {
  success: boolean;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  tokensUsed?: number | undefined;
  timings: {
    llmResponse?: number;
    dbExecution?: number;
    total: number;
  };
  error?: string;
};

export type DuckDBAgentParams = {
  query: string;
  floatId?: number;
  timeRange?: {
    start?: string;
    end?: string;
  };
  dryRun?: boolean;
};

/**
 * DuckDB Agent for Argo Profile Data Analysis
 * Queries Parquet files stored in R2 using DuckDB
 */
export async function DuckDBAgent(
  params: DuckDBAgentParams
): Promise<DuckDBAgentResult> {
  const { query, floatId, timeRange, dryRun = false } = params;
  const startTime = Date.now();
  const timings = {
    dbExecution: 0,
    llmResponse: 0,
    total: 0,
  };

  try {
    // Generate SQL using LLM
    const llmStart = Date.now();
    const { text: sqlQuery, usage } = await generateText({
      model: groq(config.models.sqlAgent),
      system: DUCKDB_AGENT_SYSTEM_PROMPT,
      prompt: `Generate DuckDB query for: ${query}
${floatId ? `\nFloat ID: ${floatId}` : ""}
${timeRange?.start ? `\nTime range: ${timeRange.start} to ${timeRange.end || "now"}` : ""}`,
      maxOutputTokens: 600,
    });
    timings.llmResponse = Date.now() - llmStart;
    const tokensUsed = usage.totalTokens;

    const { isValid, cleaned: cleanedSQL } = validateSQL(sqlQuery);

    if (!isValid) {
      timings.total = Date.now() - startTime;
      return {
        success: false,
        error: "Generated SQL must be a SELECT or WITH statement",
        sql: cleanedSQL,
        tokensUsed,
        timings,
      };
    }

    if (dryRun) {
      timings.total = Date.now() - startTime;
      return {
        success: true,
        sql: cleanedSQL,
        data: [],
        rowCount: 0,
        tokensUsed,
        timings,
      };
    }

    // Ref: https://duckdb.org/docs/stable/clients/node_neo/overview
    // Execute query with DuckDB
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();

    // Install and load required extensions
    await connection.run("INSTALL httpfs;");
    await connection.run("LOAD httpfs;");

    // Configure R2 credentials using CREATE SECRET for Cloudflare R2
    await connection.run(`
      CREATE SECRET IF NOT EXISTS r2_secret (
        TYPE S3,
        KEY_ID '${config.s3.accessKey}',
        SECRET '${config.s3.secretKey}',
        REGION '${config.s3.region}',
        ENDPOINT '${config.s3.endpoint.replace("https://", "")}',
        URL_STYLE 'path'
      );
    `);

    const dbStart = Date.now();
    const result = await connection.runAndReadAll(cleanedSQL);
    const rows = result.getRowsJson(); // It returns JSON-compatible data instead of default specialized JS objects. Ref: https://duckdb.org/docs/stable/clients/node_neo/overview#convert-result-data
    timings.dbExecution = Date.now() - dbStart;

    connection.closeSync();
    instance.closeSync();

    timings.total = Date.now() - startTime; // instanceCreation, duck-dbSetup, cleanup times are included

    return {
      success: true,
      sql: cleanedSQL,
      data: rows as unknown as Record<string, unknown>[],
      rowCount: rows.length,
      tokensUsed,
      timings,
    };
  } catch (error) {
    timings.total = Date.now() - startTime;
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown DuckDB execution error",
      timings,
    };
  }
}
