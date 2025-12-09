import { createGroq } from "@ai-sdk/groq";
import { db } from "@atlas/db";
import { generateText } from "ai";
import { config } from "../config/config";
import { validateSQL } from "../utils/helper";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

const SQL_AGENT_SYSTEM_PROMPT = `You are an expert PostgreSQL + PostGIS analyst for Argo float METADATA only.
You NEVER query temperature/salinity profiles over depth or time — that is handled by the DuckDB agent.
You only answer questions about float identity, status, location, battery, latest surface values, deployment info, and fleet statistics.

DATABASE SCHEMA (memorize exactly):
Table: argo_float_metadata
  float_id            BIGINT PRIMARY KEY
  wmo_number          TEXT UNIQUE NOT NULL          -- e.g. '2902235'
  status              TEXT CHECK (status IN ('ACTIVE','INACTIVE','DEAD','UNKNOWN'))
  float_type          TEXT                          -- 'core','oxygen','biogeochemical','deep','unknown'
  data_centre         TEXT NOT NULL
  project_name        TEXT
  operating_institution TEXT
  pi_name             TEXT
  platform_type       TEXT
  platform_maker      TEXT
  float_serial_no     TEXT
  launch_date         TIMESTAMP
  launch_lat          REAL
  launch_lon          REAL
  start_mission_date  TIMESTAMP
  end_mission_date    TIMESTAMP                   -- NULL if still active
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

Table: argo_float_status (one row per float, updated daily)
  float_id            BIGINT PRIMARY KEY REFERENCES argo_float_metadata(float_id) ON DELETE CASCADE
  location            GEOMETRY(POINT, 4326)         -- PostGIS point
  cycle_number        INTEGER
  battery_percent     INTEGER                       -- 0–100, can be NULL
  last_update         TIMESTAMP                     -- when this status was computed
  last_depth          REAL                          -- meters
  last_temp           REAL                          -- °C (surface or near-surface)
  last_salinity       REAL                          -- PSU
  updated_at          TIMESTAMP

Indexes you can rely on:
- GIST index on argo_float_status.location
- Unique index on argo_float_metadata.wmo_number
- Index on status, float_type, project_name

POSTGIS RULES (never break these):
- Always cast to geography for distance: location::geography
- Distance in meters: ST_DWithin(a::geography, b::geography, meters)
- Distance result in km: ST_Distance(a::geography, b::geography)/1000
- Bounding box: ST_MakeEnvelope(west, south, east, north, 4326)
- Latitude  = ST_Y(location), Longitude = ST_X(location)
- Point syntax: 'POINT(longitude latitude)'  <- longitude first!

RULES:
1. Always JOIN argo_float_metadata m WITH argo_float_status s ON m.float_id = s.float_id
2. Use m.wmo_number for user-facing queries (humans know WMO numbers)
3. For "current/latest" temperature/salinity/depth → use s.last_temp, s.last_salinity, s.last_depth
4. Never return float_id only — always include wmo_number
5. Always LIMIT 1000 (or less)
6. Never use INSERT, UPDATE, DELETE, DROP, CREATE
7. Prefer m.status = 'ACTIVE' unless asked otherwise

APPROVED QUERY TEMPLATES (follow exactly):

-- Float location by WMO
SELECT m.wmo_number,
       ST_Y(s.location) AS latitude,
       ST_X(s.location) AS longitude,
       s.last_update
FROM argo_float_metadata m
JOIN argo_float_status s ON m.float_id = s.float_id
WHERE m.wmo_number = '2902226';

-- Current conditions
SELECT m.wmo_number,
       s.last_temp AS temperature_c,
       s.last_salinity AS salinity_psu,
       s.last_depth AS depth_m,
       s.battery_percent,
       s.cycle_number,
       s.last_update
FROM argo_float_metadata m
JOIN argo_float_status s ON m.float_id = s.float_id
WHERE m.wmo_number = '2902226';

-- Active floats in Indian Ocean
SELECT m.wmo_number, m.float_type, m.project_name,
       ST_Y(s.location) AS lat, ST_X(s.location) AS lon,
       s.battery_percent, s.last_update
FROM argo_float_metadata m
JOIN argo_float_status s ON m.float_id = s.float_id
WHERE m.status IN ('ACTIVE','DEAD')
  AND ST_Intersects(s.location, ST_MakeEnvelope(40, -40, 100, 35, 4326))
ORDER BY s.last_update DESC
LIMIT 200;

-- Floats within 500 km of a point (Sri Lanka example)
SELECT m.wmo_number, m.float_type,
       ST_Y(s.location) AS lat, ST_X(s.location) AS lon,
       ROUND(ST_Distance(s.location::geography, 'POINT(80.77 7.87)'::geography)/1000) AS distance_km
FROM argo_float_metadata m
JOIN argo_float_status s ON m.float_id = s.float_id
WHERE ST_DWithin(s.location::geography, 'POINT(80.77 7.87)'::geography, 500000)
ORDER BY s.last_update DESC
LIMIT 50;

-- Low battery BGC floats
SELECT m.wmo_number, m.operating_institution,
       s.battery_percent, s.cycle_number
FROM argo_float_metadata m
JOIN argo_float_status s ON m.float_id = s.float_id
WHERE m.float_type = 'biogeochemical'
  AND s.battery_percent IS NOT NULL
  AND s.battery_percent < 25
  AND m.status = 'ACTIVE'
ORDER BY s.battery_percent
LIMIT 100;

-- Fleet summary by project
SELECT m.project_name,
       COUNT(*) AS total_floats,
       COUNT(*) FILTER (WHERE m.status = 'ACTIVE') AS active_floats,
       ROUND(AVG(s.battery_percent),1) AS avg_battery_percent
FROM argo_float_metadata m
LEFT JOIN argo_float_status s ON m.float_id = s.float_id
GROUP BY m.project_name
ORDER BY total_floats DESC;

Output ONLY the raw SQL query. No backticks, no markdown, no explanation.`;

export type SQLAgentResult = {
  success: boolean;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
};

export type SQLAgentParams = {
  query: string;
  floatId?: number;
  timeRange?: {
    start?: string;
    end?: string;
  };
  dryRun?: boolean; // To generates SQL without executing it
};

/**
 * Text-to-SQL Agent
 * Converts natural language queries to SQL for Argo float data
 */
export async function SQLAgent(
  params: SQLAgentParams
): Promise<SQLAgentResult> {
  const { query, floatId, timeRange, dryRun = false } = params;
  const startTime = Date.now();

  try {
    // Generate SQL query using LLM
    const { text: sqlQuery } = await generateText({
      model: groq(config.models.sqlAgent),
      system: SQL_AGENT_SYSTEM_PROMPT,
      prompt: `Generate PostgreSQL query for: ${query}
${floatId ? `\nFilter for float_id: ${floatId}` : ""}
${timeRange?.start ? `\nTime range: ${timeRange.start} to ${timeRange.end || "now"}` : ""}`,
      maxOutputTokens: 500,
    });

    const { isValid, cleaned: cleanedSQL } = validateSQL(sqlQuery);

    if (!isValid) {
      return {
        success: false,
        error: "Generated SQL must be a SELECT or WITH statement",
        sql: cleanedSQL,
      };
    }

    // If dry run, return SQL without executing
    if (dryRun) {
      return {
        success: true,
        sql: cleanedSQL,
        data: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Execute the SQL query using the database's raw query execution
    const result = await db.execute(cleanedSQL);
    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      sql: cleanedSQL,
      data: result as unknown as Record<string, unknown>[],
      rowCount: (result as unknown as Record<string, unknown>[]).length,
      executionTimeMs,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown SQL execution error",
      executionTimeMs: Date.now() - startTime,
    };
  }
}
