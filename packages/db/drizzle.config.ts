import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_READ_URL || "",
  },

  /**
   * extensionsFilters: Tell Drizzle Kit which PostgreSQL extensions to ignore
   *
   * IMPORTANT: As of drizzle-kit@0.31.6, ONLY "postgis" is supported!
   * Source: https://github.com/drizzle-team/drizzle-kit-mirror/releases/tag/v0.22.0
   *
   * This will automatically skip PostGIS system tables:
   * - spatial_ref_sys
   * - geometry_columns
   * - geography_columns
   */
  extensionsFilters: ["postgis"],

  /**
   * tablesFilter: Manually exclude tables not covered by extensionsFilters
   *
   * Required for pg_stat_statements extension which creates:
   * - pg_stat_statements (view for query statistics)
   * - pg_stat_statements_info (view for extension metadata)
   *
   * Without this filter, drizzle-kit push will attempt to drop these views
   * and fail with: "cannot drop view pg_stat_statements_info because
   * extension pg_stat_statements requires it"
   */
  tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"],
});
