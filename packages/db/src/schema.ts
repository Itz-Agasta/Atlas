import { sql } from "drizzle-orm";
import {
  bigint,
  geometry,
  index,
  integer,
  json,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// FLOAT METADATA (static)
// Filters: status, project_name, float_type, platform_type, operating_institution
export const argo_float_metadata = pgTable("argo_float_metadata", {
  float_id: bigint("float_id", { mode: "number" }).primaryKey(),
  wmo_number: text("wmo_number").unique().notNull(), /// "2902235.."
  status: text("status")
    .$type<"ACTIVE" | "INACTIVE" | "UNKNOWN" | "DEAD">()
    .default("UNKNOWN"),
  float_type: text("float_type")
    .$type<"core" | "oxygen" | "biogeochemical" | "deep" | "unknown">()
    .default("unknown"),
  data_centre: text("data_centre").notNull(), // "IN"
  project_name: text("project_name"), // "Argo India", "SOCCOM", "BioArgo"
  operating_institution: text("operating_institution"), // "INCOIS"
  pi_name: text("pi_name"), // "M Ravichandran"
  platform_type: text("platform_type"), // "ARVOR", "APEX"
  platform_maker: text("platform_maker"), // "NKE"
  float_serial_no: text("float_serial_no"), // "17007"

  // deployment infos
  launch_date: timestamp("launch_date"), // Parsed from YYYYMMDDHHMISS
  launch_lat: real("launch_lat"), // 16.42
  launch_lon: real("launch_lon"), // 88.05
  start_mission_date: timestamp("start_mission_date"), // Parsed
  end_mission_date: timestamp("end_mission_date"), // Nullable

  created_at: timestamp("created_at").default(sql`NOW()`),
  updated_at: timestamp("updated_at").default(sql`NOW()`),
});

// CURRENT STATUS (hot layer updates)
export const argo_float_status = pgTable(
  "argo_float_status",
  {
    float_id: bigint("float_id", { mode: "number" })
      .primaryKey()
      .references(() => argo_float_metadata.float_id, { onDelete: "cascade" }),
    location: geometry("location", { typed: "point", mode: "xy", srid: 4326 }),
    cycle_number: integer("cycle_number"),
    battery_percent: integer("battery_percent"), // 0–100
    last_update: timestamp("last_update"),
    last_depth: real("last_depth"),
    last_temp: real("last_temp"),
    last_salinity: real("last_salinity"),
    updated_at: timestamp("updated_at").default(sql`NOW()`),
  },
  (t) => [index("spatial_index").using("gist", t.location)]
);

export const processing_log = pgTable("processing_log", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(), // "FULL SYNC", "SYNC", "UPDATE"
  status: text("status").$type<"success" | "failed">().notNull(), // "success", "failed"
  successful_ids: bigint("successful_float_ids", { mode: "number" })
    .array()
    .default(sql`'{}'::bigint[]`),
  failed_ids: bigint("failed_float_ids", { mode: "number" })
    .array()
    .default(sql`'{}'::bigint[]`),
  error_details: json("error_details"),
  processing_time_ms: integer("processing_time_ms"),
  created_at: timestamp("created_at").default(sql`NOW()`),
});

export default {
  argo_float_metadata,
  argo_float_status,
  processing_log,
};
