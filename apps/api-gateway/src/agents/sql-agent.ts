import { createGroq } from "@ai-sdk/groq";
import { db } from "@atlas/db";
import { generateText } from "ai";
import { config } from "../config/config";
import { validateSQL } from "../utils/helper";

const groq = createGroq({
  apiKey: config.groqApiKey,
});

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
      system: `You are an expert SQL writer for Argo float METADATA queries in PostgreSQL with PostGIS.

IMPORTANT: This agent handles ONLY metadata queries (float info, status, locations).
Profile data (temperature/salinity measurements) is handled by a separate DuckDB agent.

DATABASE SCHEMA:

**argo_float_metadata** (static metadata):
  - float_id (bigint, PK): Unique float identifier
  - wmo_number (text, unique, NOT NULL): WMO identifier (e.g., "2902235")
  - status (text): "ACTIVE" | "INACTIVE" | "UNKNOWN" | "DEAD"
  - float_type (text): "core" | "oxygen" | "biogeochemical" | "deep" | "unknown"
  - data_centre (text, NOT NULL): Data center code (e.g., "IN")
  - project_name (text): Project name (e.g., "Argo India")
  - operating_institution (text): Institution name (e.g., "INCOIS")
  - pi_name (text): Principal investigator
  - platform_type (text): Platform type (e.g., "ARVOR")
  - platform_maker (text): Manufacturer (e.g., "NKE")
  - float_serial_no (text): Serial number
  - launch_date (timestamp): Deployment date
  - launch_lat, launch_lon (real): Deployment coordinates
  - start_mission_date (timestamp): Mission start
  - end_mission_date (timestamp): Mission end (nullable for active floats)
  - created_at, updated_at (timestamp)

**argo_float_status** (hot layer - current status):
  - float_id (bigint, PK, FK): References argo_float_metadata (cascade delete)
  - location (geometry POINT, SRID 4326): Current position (PostGIS)
  - cycle_number (integer): Current cycle number
  - battery_percent (integer): Battery level (0-100)
  - last_update (timestamp): Last data update
  - last_depth (real): Last recorded depth (meters)
  - last_temp (real): Last temperature (°C)
  - last_salinity (real): Last salinity (PSU)
  - updated_at (timestamp)

**processing_log** (system logs):
  - id (serial, PK)
  - float_id (bigint): Related float
  - operation (text): Operation type (e.g., "FULL SYNC")
  - status (text): "SUCCESS" | "ERROR"
  - error_details (jsonb): Error information
  - processing_time_ms (integer): Processing duration
  - created_at (timestamp)

SPATIAL QUERIES (PostGIS):
- Use ST_DWithin for radius queries: ST_DWithin(location::geography, ST_GeogFromText('POINT(lon lat)'), distance_meters)
- Use ST_MakeEnvelope for bounding boxes: ST_Intersects(location, ST_MakeEnvelope(west, south, east, north, 4326))
- Indexes: GIST index on argo_float_status.location

QUERY GUIDELINES:
1. Generate ONLY valid PostgreSQL SELECT statements
2. For float locations, use argo_float_status.location (PostGIS geometry)
3. Extract lat/lon from geometry: ST_Y(location) AS lat, ST_X(location) AS lon
4. Filter by status, project_name, float_type, operating_institution
5. Join metadata + status for comprehensive float information
6. Use CTEs (WITH) for complex queries
7. NO DELETE, UPDATE, INSERT, DROP statements allowed
8. Limit results to 1000 rows maximum

EXAMPLES:

Q: "List all active floats in the Indian Ocean"
A: SELECT 
     m.wmo_number,
     m.float_type,
     m.project_name,
     ST_Y(s.location) AS latitude,
     ST_X(s.location) AS longitude,
     s.battery_percent,
     s.last_update
   FROM argo_float_metadata m
   JOIN argo_float_status s ON m.float_id = s.float_id
   WHERE m.status = 'ACTIVE'
     AND ST_Y(s.location) BETWEEN -20 AND 30
     AND ST_X(s.location) BETWEEN 40 AND 100
   ORDER BY s.last_update DESC
   LIMIT 100;

Q: "Find floats within 500km of Sri Lanka"
A: SELECT 
     m.wmo_number,
     m.float_type,
     ST_Y(s.location) AS latitude,
     ST_X(s.location) AS longitude,
     ST_Distance(s.location::geography, ST_GeogFromText('POINT(80.77 7.87)')) / 1000 AS distance_km
   FROM argo_float_metadata m
   JOIN argo_float_status s ON m.float_id = s.float_id
   WHERE ST_DWithin(s.location::geography, ST_GeogFromText('POINT(80.77 7.87)'), 500000)
   ORDER BY distance_km
   LIMIT 50;

Q: "Show BGC floats with low battery"
A: SELECT 
     m.wmo_number,
     m.operating_institution,
     s.battery_percent,
     s.cycle_number,
     s.last_update
   FROM argo_float_metadata m
   JOIN argo_float_status s ON m.float_id = s.float_id
   WHERE m.float_type = 'biogeochemical'
     AND s.battery_percent < 20
   ORDER BY s.battery_percent ASC
   LIMIT 100;

Q: "Count floats by project"
A: SELECT 
     project_name,
     COUNT(*) AS float_count,
     SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_count
   FROM argo_float_metadata
   GROUP BY project_name
   ORDER BY float_count DESC;

Generate ONLY the SQL query without any markdown formatting, explanations, or comments.`,
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
