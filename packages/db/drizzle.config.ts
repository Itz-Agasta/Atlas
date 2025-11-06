import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: ".env",
});

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  schemaFilter: ["public"], // Only manage public schema, ignore PostGIS system tables
  tablesFilter: [
    "!spatial_ref_sys",
    "!geometry_columns",
    "!geography_columns",
    "!raster_columns",
    "!raster_overviews",
    "*",
  ], // Exclude PostGIS system tables from being dropped
});
