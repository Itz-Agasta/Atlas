CREATE TABLE "argo_float_metadata" (
	"float_id" bigint PRIMARY KEY NOT NULL,
	"wmo_number" text NOT NULL,
	"float_type" text,
	"deployment_date" timestamp,
	"deployment_lat" real,
	"deployment_lon" real,
	"deployment_country" text,
	"status" text DEFAULT 'ACTIVE',
	"battery_capacity" integer,
	"created_at" timestamp DEFAULT NOW(),
	"updated_at" timestamp DEFAULT NOW(),
	CONSTRAINT "argo_float_metadata_wmo_number_unique" UNIQUE("wmo_number")
);
--> statement-breakpoint
CREATE TABLE "argo_float_positions" (
	"float_id" bigint PRIMARY KEY NOT NULL,
	"current_lat" real,
	"current_lon" real,
	"current_depth" integer,
	"cycle_number" integer,
	"last_update" timestamp,
	"last_temp" real,
	"last_salinity" real,
	"updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "argo_float_stats" (
	"float_id" bigint PRIMARY KEY NOT NULL,
	"avg_temp" real,
	"temp_min" real,
	"temp_max" real,
	"depth_range_min" integer,
	"depth_range_max" integer,
	"profile_count" integer DEFAULT 0,
	"location_bounds_nmin" real,
	"location_bounds_nmax" real,
	"location_bounds_emin" real,
	"location_bounds_emax" real,
	"recent_temp_trend" real,
	"last_updated" timestamp,
	"updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "argo_positions_timeseries" (
	"id" serial PRIMARY KEY NOT NULL,
	"float_id" bigint NOT NULL,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"time" timestamp NOT NULL,
	"cycle" integer,
	"location" geometry(point),
	"created_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "argo_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"float_id" bigint NOT NULL,
	"cycle" integer NOT NULL,
	"profile_time" timestamp NOT NULL,
	"surface_lat" real,
	"surface_lon" real,
	"max_depth" integer,
	"surface_location" geometry(point),
	"measurements" jsonb DEFAULT '{}'::jsonb,
	"quality_flag" text DEFAULT 'REAL_TIME',
	"created_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "processing_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"float_id" bigint,
	"operation" text,
	"status" text,
	"message" text,
	"error_details" jsonb,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "sync_manifest" (
	"id" serial PRIMARY KEY NOT NULL,
	"float_id" bigint,
	"file_name" text NOT NULL,
	"file_size" bigint,
	"remote_modified_time" timestamp,
	"local_modified_time" timestamp,
	"sync_status" text DEFAULT 'SYNCED',
	"local_path" text,
	"s3_path" text,
	"created_at" timestamp DEFAULT NOW(),
	"updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
ALTER TABLE "argo_float_positions" ADD CONSTRAINT "argo_float_positions_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "argo_float_stats" ADD CONSTRAINT "argo_float_stats_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "argo_positions_timeseries" ADD CONSTRAINT "argo_positions_timeseries_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "argo_profiles" ADD CONSTRAINT "argo_profiles_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "argo_float_metadata_wmo_idx" ON "argo_float_metadata" USING btree ("wmo_number");--> statement-breakpoint
CREATE INDEX "positions_time_idx" ON "argo_positions_timeseries" USING btree ("float_id","time");--> statement-breakpoint
CREATE INDEX "positions_time_only_idx" ON "argo_positions_timeseries" USING btree ("time");--> statement-breakpoint
CREATE INDEX "positions_spatial_idx" ON "argo_positions_timeseries" USING gist ("location");--> statement-breakpoint
CREATE INDEX "profiles_float_time_idx" ON "argo_profiles" USING btree ("float_id","profile_time");--> statement-breakpoint
CREATE INDEX "profiles_time_idx" ON "argo_profiles" USING btree ("profile_time");--> statement-breakpoint
CREATE INDEX "profiles_qc_idx" ON "argo_profiles" USING btree ("quality_flag");--> statement-breakpoint
CREATE INDEX "profiles_spatial_idx" ON "argo_profiles" USING gist ("surface_location");--> statement-breakpoint
CREATE INDEX "log_float_op_idx" ON "processing_log" USING btree ("float_id","operation");--> statement-breakpoint
CREATE INDEX "log_time_idx" ON "processing_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "manifest_float_file_idx" ON "sync_manifest" USING btree ("float_id","file_name");--> statement-breakpoint
CREATE INDEX "manifest_status_idx" ON "sync_manifest" USING btree ("sync_status");