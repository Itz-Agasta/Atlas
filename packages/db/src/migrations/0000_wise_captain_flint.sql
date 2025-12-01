CREATE TABLE "argo_float_metadata" (
	"float_id" bigint PRIMARY KEY NOT NULL,
	"wmo_number" text NOT NULL,
	"status" text DEFAULT 'UNKNOWN',
	"float_type" text DEFAULT 'unknown',
	"data_centre" text NOT NULL,
	"project_name" text,
	"operating_institution" text,
	"pi_name" text,
	"platform_type" text,
	"platform_maker" text,
	"float_serial_no" text,
	"launch_date" timestamp,
	"launch_lat" real,
	"launch_lon" real,
	"start_mission_date" timestamp,
	"end_mission_date" timestamp,
	"battery_capacity" integer,
	"created_at" timestamp DEFAULT NOW(),
	"updated_at" timestamp DEFAULT NOW(),
	CONSTRAINT "argo_float_metadata_wmo_number_unique" UNIQUE("wmo_number")
);
--> statement-breakpoint
CREATE TABLE "argo_float_status" (
	"float_id" bigint PRIMARY KEY NOT NULL,
	"location" geometry(point),
	"current_depth" integer,
	"cycle_number" integer,
	"last_update" timestamp,
	"last_temp" real,
	"last_salinity" real,
	"updated_at" timestamp DEFAULT NOW()
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
ALTER TABLE "argo_float_status" ADD CONSTRAINT "argo_float_status_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spatial_index" ON "argo_float_status" USING gist ("location");