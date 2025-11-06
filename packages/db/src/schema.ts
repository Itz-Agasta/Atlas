import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { geometry } from "drizzle-orm/pg-core/columns/postgis_extension/geometry";

// [T1]: FLOAT METADATA (static, never changes)
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

// [T2]: POSITION TIMESERIES (warm layer)
export const argo_positions_timeseries = pgTable(
  "argo_positions_timeseries",
  {
    id: serial("id").primaryKey(),
    float_id: bigint("float_id", { mode: "number" })
      .notNull()
      .references(() => argo_float_metadata.float_id, { onDelete: "cascade" }),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    time: timestamp("time").notNull(),
    cycle: integer("cycle"),
    location: geometry("location", { type: "point", srid: 4326 }), // ← ADDED
    created_at: timestamp("created_at").default(sql`NOW()`),
  },
  (table) => ({
    floatTimeidx: index("positions_time_idx").on(table.float_id, table.time),
    timeidx: index("positions_time_only_idx").on(table.time),
    spatialIdx: index("positions_spatial_idx").using("gist", table.location), // ← ADDED
  })
);

// [T2]: PROFILE DATA (warm layer - 6 months)
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
  })
);

// STATISTICS (cached aggregates)
export const argo_float_stats = pgTable("argo_float_stats", {
  float_id: bigint("float_id", { mode: "number" })
    .primaryKey()
    .references(() => argo_float_metadata.float_id, { onDelete: "cascade" }),
  avg_temp: real("avg_temp"),
  temp_min: real("temp_min"),
  temp_max: real("temp_max"),
  depth_range_min: integer("depth_range_min"),
  depth_range_max: integer("depth_range_max"),
  profile_count: integer("profile_count").default(0),

  // Bounding box: float's range in space
  location_bounds_nmin: real("location_bounds_nmin"), // south boundary
  location_bounds_nmax: real("location_bounds_nmax"), // north boundary
  location_bounds_emin: real("location_bounds_emin"), // west boundary
  location_bounds_emax: real("location_bounds_emax"), // east boundary

  recent_temp_trend: real("recent_temp_trend"), // (now - 1 week ago)
  last_updated: timestamp("last_updated"),
  updated_at: timestamp("updated_at").default(sql`NOW()`),
});

// PROCESS LOGS (for debugging)
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

export default {
  argo_float_metadata,
  argo_float_positions,
  argo_positions_timeseries,
  argo_profiles,
  argo_float_stats,
  processing_log,
  sync_manifest,
};
