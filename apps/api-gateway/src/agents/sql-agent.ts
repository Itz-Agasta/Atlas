import { createGroq } from "@ai-sdk/groq";
import { db } from "@atlas/db";
import { generateText } from "ai";
import { config } from "../config/config";

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
 * Validate that generated SQL to keep agent read‑only
 * This guards against multi‑statement execution even if the LLM goes off‑spec.
 */
const TRAILING_SEMICOLONS_REGEX = /;+\s*$/;
const DISALLOWED_KEYWORDS_REGEX =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK)\b/;

function validateSQL(sqlQuery: string): { isValid: boolean; cleaned: string } {
  const cleanedSQL = sqlQuery
    .trim()
    .replace(/^```sql\n?|```$/g, "")
    .trim();

  // Remove trailing semicolons so we only ever execute a single statement
  const withoutTrailingSemicolons = cleanedSQL.replace(
    TRAILING_SEMICOLONS_REGEX,
    ""
  );

  const upperSQL = withoutTrailingSemicolons.toUpperCase();
  const startsWithSelectOrWith =
    upperSQL.startsWith("SELECT") || upperSQL.startsWith("WITH");

  // Any remaining semicolon implies an extra statement
  const hasExtraSemicolon = upperSQL.includes(";");

  const hasDisallowedKeyword = DISALLOWED_KEYWORDS_REGEX.test(upperSQL);

  const isValid =
    startsWithSelectOrWith && !hasExtraSemicolon && !hasDisallowedKeyword;

  return { isValid, cleaned: withoutTrailingSemicolons };
}

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
      system: `You are an expert SQL writer for oceanographic Argo float data in PostgreSQL with PostGIS.

DATABASE SCHEMA:

**argo_float_metadata** (static metadata):
  - float_id (bigint, PK): Unique float identifier
  - wmo_number (text, unique): WMO identifier
  - float_type (text): Type of float
  - deployment_date (timestamp): When float was deployed
  - deployment_lat, deployment_lon (real): Deployment location
  - deployment_country (text): Country that deployed the float
  - status (text): ACTIVE, INACTIVE, LOST
  - battery_capacity (integer): Battery percentage
  - created_at, updated_at (timestamp)

**argo_float_positions** (current/latest positions):
  - float_id (bigint, PK, FK): References argo_float_metadata
  - current_lat, current_lon (real): Current position
  - current_depth (integer): Current depth in meters
  - cycle_number (integer): Current cycle number
  - last_update (timestamp): When last updated
  - last_temp, last_salinity (real): Latest measurements
  - updated_at (timestamp)

**argo_positions_timeseries** (position history):
  - id (serial, PK)
  - float_id (bigint, FK): References argo_float_metadata
  - lat, lon (real): Position
  - time (timestamp): Measurement time
  - cycle (integer): Cycle number
  - location (geometry, POINT, SRID 4326): PostGIS geometry
  - created_at (timestamp)

**argo_profiles** (oceanographic profiles):
  - id (serial, PK)
  - float_id (bigint, FK): References argo_float_metadata
  - cycle (integer): Cycle number
  - profile_time (timestamp): When profile was taken
  - surface_lat, surface_lon (real): Surface position
  - max_depth (integer): Maximum profile depth in meters
  - surface_location (geometry, POINT, SRID 4326)
  - measurements (jsonb): Array of measurement objects, each with:
    [
      {
        "depth": 0.0,
        "temperature": 20.5,
        "salinity": 34.5
      },
      {
        "depth": 10.0,
        "temperature": 19.8,
        "salinity": 34.6
      },
      ...
    ]
    Access measurements via jsonb_array_elements() or ->'field' operators
  - quality_flag (text): REAL_TIME or DELAYED_MODE
  - created_at (timestamp)

**argo_float_stats** (cached statistics):
  - float_id (bigint, PK, FK)
  - avg_temp, temp_min, temp_max (real)
  - depth_range_min, depth_range_max (integer)
  - profile_count (integer)
  - location_bounds_nmin, location_bounds_nmax (real): South/North bounds
  - location_bounds_emin, location_bounds_emax (real): West/East bounds
  - recent_temp_trend (real): Temperature trend
  - last_updated, updated_at (timestamp)

QUERY GUIDELINES:
1. Generate ONLY valid PostgreSQL SELECT statements
2. Use proper JSONB operators: ->, ->>, @>, jsonb_array_elements
3. For spatial/geographic queries use bounding box operators: BETWEEN for latitude/longitude
   - Do NOT use ST_MakePolygon, ST_GeomFromText, or complex PostGIS functions
   - These require special geometry types that may not be available
   - Stick to simple bounding box logic with BETWEEN clauses
4. Use LATERAL joins for JSONB array processing
5. Include appropriate WHERE, ORDER BY, LIMIT clauses
6. Use CTEs (WITH) for complex queries
7. Return meaningful column aliases
8. Add comments for complex operations
9. **IMPORTANT: Do NOT select full JSONB measurement arrays - they are too large**
   - Either extract specific measurements using ->> operator
   - Or use jsonb_array_length() to count measurements without returning all data
   - For summaries, use aggregation functions (AVG, MIN, MAX)
10. NO DELETE, UPDATE, INSERT, DROP statements allowed
11. Limit results to 1000 rows maximum

EXAMPLES:

Q: "Show temperature profiles for float WMO-4903556"
A: SELECT 
     profile_time,
     max_depth,
     jsonb_array_length(measurements) as num_measurements,
     (measurements->0->>'temperature')::real as surface_temperature
   FROM argo_profiles
   WHERE float_id = (SELECT float_id FROM argo_float_metadata WHERE wmo_number = '4903556')
   ORDER BY profile_time DESC
   LIMIT 100;

Q: "Find floats with high salinity in the Indian Ocean"
A: SELECT 
     m.wmo_number,
     m.float_type,
     p.surface_lat,
     p.surface_lon,
     p.cycle
   FROM argo_profiles p
   JOIN argo_float_metadata m ON p.float_id = m.float_id
   WHERE p.surface_lat BETWEEN -20 AND 30
     AND p.surface_lon BETWEEN 40 AND 100
   ORDER BY m.wmo_number, p.profile_time DESC
   LIMIT 50;

Q: "Average temperature at 1000m depth across all floats"
A: WITH depth_temps AS (
     SELECT 
       float_id,
       profile_time,
       (m->>'temperature')::real as temp,
       (m->>'depth')::real as depth
     FROM argo_profiles,
          jsonb_array_elements(measurements) as m
     WHERE quality_flag = 'DELAYED_MODE'
   )
   SELECT 
     AVG(temp) as avg_temp_at_1000m,
     COUNT(*) as sample_count,
     STDDEV(temp) as std_dev
   FROM depth_temps
   WHERE depth BETWEEN 950 AND 1050;

Q: "Analyze temperature-salinity relationship in Antarctic waters"
A: SELECT 
     p.float_id,
     p.profile_time,
     p.surface_lat,
     p.surface_lon,
     jsonb_array_length(p.measurements) as num_measurements,
     AVG((meas->>'temperature')::real) as avg_temperature,
     AVG((meas->>'salinity')::real) as avg_salinity,
     STDDEV((meas->>'temperature')::real) as temp_stddev,
     STDDEV((meas->>'salinity')::real) as salinity_stddev
   FROM argo_profiles p
   CROSS JOIN LATERAL jsonb_array_elements(p.measurements) as meas
   WHERE p.surface_lat BETWEEN -90 AND -50
     AND p.surface_lon BETWEEN -180 AND 180
   GROUP BY p.float_id, p.profile_time, p.surface_lat, p.surface_lon, p.measurements
   ORDER BY p.profile_time DESC
   LIMIT 100;

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
    const result = (await db.execute(cleanedSQL)) as {
      rows: Record<string, unknown>[];
      rowCount?: number;
    };
    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      sql: cleanedSQL,
      data: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
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
