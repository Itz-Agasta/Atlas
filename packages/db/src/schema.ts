import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgMaterializedView,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { geometry } from "drizzle-orm/pg-core/columns/postgis_extension/geometry";

// [T1]: FLOAT METADATA (static)
export const argo_float_metadata = pgTable(
  "argo_float_metadata",
  {
    float_id: bigint("float_id", { mode: "number" }).primaryKey(),
    wmo_number: text("wmo_number").unique().notNull(),
    float_type: text("float_type"),
    deployment_date: timestamp("deployment_date"),
    deployment_lat: real("deployment_lat"),
    deployment_lon: real("deployment_lon"),
    deployment_country: text("deployment_country"),
    status: text("status").default("ACTIVE"),
    battery_capacity: integer("battery_capacity"),
    created_at: timestamp("created_at").default(sql`NOW()`),
    updated_at: timestamp("updated_at").default(sql`NOW()`),
  },
  (table) => ({
    wmoidx: index("argo_float_metadata_wmo_idx").on(table.wmo_number),
  })
);

// [T2]: CURRENT POSITIONS (hot layer updates)
export const argo_float_positions = pgTable("argo_float_positions", {
  float_id: bigint("float_id", { mode: "number" })
    .primaryKey()
    .references(() => argo_float_metadata.float_id, { onDelete: "cascade" }),
  current_lat: real("current_lat"),
  current_lon: real("current_lon"),
  current_depth: integer("current_depth"),
  cycle_number: integer("cycle_number"),
  last_update: timestamp("last_update"),
  last_temp: real("last_temp"),
  last_salinity: real("last_salinity"),
  updated_at: timestamp("updated_at").default(sql`NOW()`),
});

// [T2]: PROFILE DATA (core table with profiles + trajectory + measurements)
export const argo_profiles = pgTable(
  "argo_profiles",
  {
    id: serial("id").primaryKey(),
    float_id: bigint("float_id", { mode: "number" })
      .notNull()
      .references(() => argo_float_metadata.float_id, { onDelete: "cascade" }),
    cycle: integer("cycle").notNull(),
    profile_time: timestamp("profile_time").notNull(),
    surface_lat: real("surface_lat"),
    surface_lon: real("surface_lon"),
    max_depth: integer("max_depth"),
    surface_location: geometry("surface_location", {
      type: "point",
      srid: 4326,
    }),

    // Store all measurements as JSONB for flexibility
    measurements: jsonb("measurements").default(sql`'{}'::jsonb`),
    // Example structure:
    // {
    //   "TEMP": [20.5, 19.8, 18.2, ...],
    //   "PSAL": [34.5, 34.6, 34.7, ...],
    //   "DOXY": [200, 190, 180, ...],
    //   "CHLA": [0.8, 0.9, 1.0, ...],
    //   "depths": [0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, ...]
    // }

    quality_flag: text("quality_flag").default("REAL_TIME"), // DELAYED_MODE or REAL_TIME
    created_at: timestamp("created_at").default(sql`NOW()`),
  },
  (table) => ({
    floatProfiileIdx: index("profiles_float_time_idx").on(
      table.float_id,
      table.profile_time
    ),
    timeIdx: index("profiles_time_idx").on(table.profile_time),
    qcIdx: index("profiles_qc_idx").on(table.quality_flag),
    spatialIdx: index("profiles_spatial_idx").using(
      "gist",
      table.surface_location
    ),
    // GIN index for JSONB measurements - enables fast containment queries and array operations
    measurementsGinIdx: index("profiles_measurements_gin_idx").using(
      "gin",
      table.measurements
    ),
    // Unique constraint to prevent duplicate profiles for same float+cycle
    floatCycleUnique: unique("profiles_float_cycle_unique").on(
      table.float_id,
      table.cycle
    ),
  })
);

// PROCESS LOGS (for debugging and monitoring)
export const processing_log = pgTable(
  "processing_log",
  {
    id: serial("id").primaryKey(),
    float_id: bigint("float_id", { mode: "number" }),
    operation: text("operation"), // "FTP_DOWNLOAD", "PARSE_NETCDF", "INSERT_PROFILES"
    status: text("status"), // "SUCCESS", "ERROR"
    message: text("message"),
    error_details: jsonb("error_details"),
    processing_time_ms: integer("processing_time_ms"),
    created_at: timestamp("created_at").default(sql`NOW()`),
  },
  (table) => ({
    floatOpIdx: index("log_float_op_idx").on(table.float_id, table.operation),
    timeIdx: index("log_time_idx").on(table.created_at),
  })
);

// SYNC MANIFEST (track what we've downloaded)
export const sync_manifest = pgTable(
  "sync_manifest",
  {
    id: serial("id").primaryKey(),
    float_id: bigint("float_id", { mode: "number" }),
    file_name: text("file_name").notNull(), // "2902224_prof.nc"
    file_size: bigint("file_size", { mode: "number" }),
    remote_modified_time: timestamp("remote_modified_time"),
    local_modified_time: timestamp("local_modified_time"),
    sync_status: text("sync_status").default("SYNCED"), // "SYNCED", "PENDING", "FAILED"
    local_path: text("local_path"), // "/data/argo/incois/2902224/2902224_prof.nc"
    s3_path: text("s3_path"), // "s3://bucket/2902224/2902224_prof.nc"
    created_at: timestamp("created_at").default(sql`NOW()`),
    updated_at: timestamp("updated_at").default(sql`NOW()`),
  },
  (table) => ({
    floatFileIdx: index("manifest_float_file_idx").on(
      table.float_id,
      table.file_name
    ),
    statusIdx: index("manifest_status_idx").on(table.sync_status),
  })
);

// MATERIALIZED VIEW: Pre-computed measurements at standard depths
// Enables fast dashboard queries without JSONB array expansion
export const argo_measurements_summary = pgMaterializedView(
  "argo_measurements_summary"
).as((qb) =>
  qb
    .select({
      id: argo_profiles.id,
      float_id: argo_profiles.float_id,
      cycle: argo_profiles.cycle,
      profile_time: argo_profiles.profile_time,
      surface_lat: argo_profiles.surface_lat,
      surface_lon: argo_profiles.surface_lon,
      max_depth: argo_profiles.max_depth,

      // Extract surface temperature (0-10m)
      surface_temp: sql<number | null>`(
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 0 AND 10 
        ORDER BY (elem->>'depth')::REAL ASC 
        LIMIT 1
      )`.as("surface_temp"),

      surface_salinity: sql<number | null>`(
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 0 AND 10 
        ORDER BY (elem->>'depth')::REAL ASC 
        LIMIT 1
      )`.as("surface_salinity"),

      // Extract 100m depth
      temp_100m: sql<number | null>`(
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 90 AND 110 
        ORDER BY ABS((elem->>'depth')::REAL - 100) ASC 
        LIMIT 1
      )`.as("temp_100m"),

      salinity_100m: sql<number | null>`(
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 90 AND 110 
        ORDER BY ABS((elem->>'depth')::REAL - 100) ASC 
        LIMIT 1
      )`.as("salinity_100m"),

      // Extract 500m depth
      temp_500m: sql<number | null>`(
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 450 AND 550 
        ORDER BY ABS((elem->>'depth')::REAL - 500) ASC 
        LIMIT 1
      )`.as("temp_500m"),

      salinity_500m: sql<number | null>`(
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 450 AND 550 
        ORDER BY ABS((elem->>'depth')::REAL - 500) ASC 
        LIMIT 1
      )`.as("salinity_500m"),

      // Extract 1000m depth
      temp_1000m: sql<number | null>`(
        SELECT (elem->>'temperature')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 950 AND 1050 
        ORDER BY ABS((elem->>'depth')::REAL - 1000) ASC 
        LIMIT 1
      )`.as("temp_1000m"),

      salinity_1000m: sql<number | null>`(
        SELECT (elem->>'salinity')::REAL 
        FROM jsonb_array_elements(${argo_profiles.measurements}) elem 
        WHERE (elem->>'depth')::REAL BETWEEN 950 AND 1050 
        ORDER BY ABS((elem->>'depth')::REAL - 1000) ASC 
        LIMIT 1
      )`.as("salinity_1000m"),

      // Metadata
      measurement_count:
        sql<number>`jsonb_array_length(${argo_profiles.measurements})`.as(
          "measurement_count"
        ),
      quality_flag: argo_profiles.quality_flag,
    })
    .from(argo_profiles)
);

export default {
  argo_float_metadata,
  argo_float_positions,
  argo_profiles,
  processing_log,
  sync_manifest,
  argo_measurements_summary,
};
