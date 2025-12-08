import { createGroq } from "@ai-sdk/groq";
import { DuckDBInstance } from "@duckdb/node-api";
import { generateText } from "ai";
import { config } from "../config/config";
import { validateSQL } from "../utils/helper";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

export type DuckDBAgentResult = {
  success: boolean;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
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

  try {
    const { text: sqlQuery } = await generateText({
      model: groq(config.models.duckdbAgent),
      system: `You are an expert DuckDB SQL writer for Argo float oceanographic profile data stored in Parquet files on S3/R2.

DATA STORAGE:
- Files stored at: s3://atlas/profiles/{float_id}/data.parquet
- One Parquet file per float containing ALL profiles for that float
- Row groups optimized for time-series queries (sorted by float_id, cycle_number, level)

SCHEMA (denormalized "long" format - one row per measurement at one depth):

CREATE TABLE argo_measurements (
    -- Identity & partitioning
    float_id          BIGINT,        -- Float identifier
    cycle_number      DOUBLE,        -- Profile cycle number
    level             BIGINT,        -- Depth level index (0 to N_LEVELS-1)

    -- Spatiotemporal (per profile, repeated across levels)
    profile_timestamp TIMESTAMP WITH TIME ZONE,  -- When profile was taken
    latitude          DOUBLE,        -- Profile latitude
    longitude         DOUBLE,        -- Profile longitude

    -- Core measurements (at this depth level)
    pressure          DOUBLE,        -- Pressure in dbar (≈ depth in meters)
    temperature       DOUBLE,        -- Temperature in °C
    salinity          DOUBLE,        -- Salinity in PSU

    -- Quality flags (single char, dictionary encoded)
    position_qc       VARCHAR,       -- Position quality: '1'=good, '4'=bad
    pres_qc           VARCHAR,       -- Pressure quality
    temp_qc           VARCHAR,       -- Temperature quality
    psal_qc           VARCHAR,       -- Salinity quality

    -- Adjusted values (delayed-mode, higher quality)
    temperature_adj   DOUBLE,        -- Adjusted temperature
    salinity_adj      DOUBLE,        -- Adjusted salinity
    pressure_adj      DOUBLE,        -- Adjusted pressure
    temp_adj_qc       VARCHAR,       -- Adjusted temp quality
    psal_adj_qc       VARCHAR,       -- Adjusted salinity quality

    -- Provenance
    data_mode         VARCHAR,       -- 'R'=real-time, 'D'=delayed-mode, 'A'=adjusted

    -- Optional BGC sensors (80-95% NULL)
    oxygen            DOUBLE,        -- Dissolved oxygen µmol/kg
    oxygen_qc         VARCHAR,
    chlorophyll       DOUBLE,        -- Chlorophyll mg/m³
    chlorophyll_qc    VARCHAR,
    nitrate           DOUBLE,        -- Nitrate µmol/kg
    nitrate_qc        VARCHAR,

    -- Partitioning helpers
    year              BIGINT,        -- Extracted from profile_timestamp
    month             BIGINT         -- Extracted from profile_timestamp
)

QUERY PATTERNS:

1. **Single Float Profile Analysis:**
   SELECT cycle_number, level, pressure, temperature, salinity
   FROM read_parquet('s3://atlas/profiles/2902226/data.parquet')
   WHERE cycle_number = 0
   ORDER BY level;

2. **Time-Series Analysis (multiple cycles):**
   SELECT 
     cycle_number,
     AVG(temperature) as avg_temp,
     AVG(salinity) as avg_salinity,
     profile_timestamp
   FROM read_parquet('s3://atlas/profiles/{float_id}/data.parquet')
   WHERE pressure BETWEEN 0 AND 50  -- Surface layer
   GROUP BY cycle_number, profile_timestamp
   ORDER BY cycle_number;

3. **Depth Profile (T-S diagram):**
   SELECT 
     pressure,
     AVG(temperature) as mean_temp,
     AVG(salinity) as mean_sal,
     STDDEV(temperature) as temp_std
   FROM read_parquet('s3://atlas/profiles/{float_id}/data.parquet')
   WHERE cycle_number BETWEEN 0 AND 100
   GROUP BY pressure
   ORDER BY pressure;

4. **Quality-Filtered Analysis:**
   SELECT pressure, temperature_adj as temp, salinity_adj as sal
   FROM read_parquet('s3://atlas/profiles/{float_id}/data.parquet')
   WHERE data_mode = 'D'  -- Delayed-mode only
     AND temp_adj_qc = '1'  -- Good quality
     AND psal_adj_qc = '1'
     AND cycle_number = 5
   ORDER BY level;
   ORDER BY level;

5. **Multi-Cycle Comparison:**
   WITH cycle_stats AS (
     SELECT 
       cycle_number,
       AVG(temperature) as avg_temp,
       COUNT(*) as num_levels
     FROM read_parquet('s3://atlas/profiles/{float_id}/data.parquet')
     WHERE pressure < 2000
     GROUP BY cycle_number
   )
   SELECT * FROM cycle_stats
   ORDER BY cycle_number
   LIMIT 50;

IMPORTANT DuckDB-SPECIFIC RULES:
1. Use read_parquet('s3://atlas/profiles/{float_id}/data.parquet') to read files
2. DuckDB auto-configures S3 credentials - no need to specify them
3. Use proper aggregations (AVG, STDDEV, MIN, MAX) for statistics
4. Filter by pressure for depth ranges (pressure ≈ depth in meters)
5. Use temp_adj_qc and psal_adj_qc = '1' for good quality data
6. Prefer delayed-mode data (data_mode = 'D') for scientific analysis
7. LIMIT results to avoid huge datasets (max 10000 rows)
8. Use CTEs (WITH) for complex multi-step analysis
9. NO INSERT, UPDATE, DELETE, DROP operations allowed

QUALITY FLAGS:
- '1' = Good
- '2' = Probably good
- '3' = Probably bad
- '4' = Bad
- '0' or missing = No QC performed

Generate ONLY the SQL query without markdown formatting or explanations.`,
      prompt: `Generate DuckDB query for: ${query}
${floatId ? `\nFloat ID: ${floatId}` : ""}
${timeRange?.start ? `\nTime range: ${timeRange.start} to ${timeRange.end || "now"}` : ""}`,
      maxOutputTokens: 600,
    });

    const { isValid, cleaned: cleanedSQL } = validateSQL(sqlQuery);

    if (!isValid) {
      return {
        success: false,
        error: "Generated SQL must be a SELECT or WITH statement",
        sql: cleanedSQL,
      };
    }

    if (dryRun) {
      return {
        success: true,
        sql: cleanedSQL,
        data: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
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

    const result = await connection.runAndReadAll(cleanedSQL);
    const rows = result.getRowsJson(); // It returns JSON-compatible data instead of default specialized JS objects. Ref: https://duckdb.org/docs/stable/clients/node_neo/overview#convert-result-data

    connection.closeSync();
    instance.closeSync();

    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      sql: cleanedSQL,
      data: rows as Record<string, unknown>[],
      rowCount: rows.length,
      executionTimeMs,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown DuckDB execution error",
      executionTimeMs: Date.now() - startTime,
    };
  }
}
