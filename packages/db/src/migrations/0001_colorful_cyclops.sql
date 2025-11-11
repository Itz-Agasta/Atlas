CREATE TABLE "argo_float_sensors" (
	"id" serial PRIMARY KEY NOT NULL,
	"float_id" bigint NOT NULL,
	"sensor_type" text NOT NULL,
	"sensor_maker" text,
	"sensor_model" text,
	"sensor_serial_no" text,
	"parameter_name" text,
	"calibration_data" jsonb,
	"calibration_date" timestamp,
	"calibration_comment" text,
	"units" text,
	"accuracy" real,
	"resolution" real,
	"created_at" timestamp DEFAULT NOW(),
	"updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "argo_profile_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"depth" real NOT NULL,
	"temperature" real,
	"salinity" real,
	"oxygen" real,
	"chlorophyll" real,
	"qc_temp" integer,
	"qc_salinity" integer,
	"qc_oxygen" integer,
	"qc_chlorophyll" integer,
	"created_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
ALTER TABLE "argo_float_sensors" ADD CONSTRAINT "argo_float_sensors_float_id_argo_float_metadata_float_id_fk" FOREIGN KEY ("float_id") REFERENCES "public"."argo_float_metadata"("float_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "argo_profile_measurements" ADD CONSTRAINT "argo_profile_measurements_profile_id_argo_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."argo_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "float_sensors_float_sensor_idx" ON "argo_float_sensors" USING btree ("float_id","sensor_type");--> statement-breakpoint
CREATE INDEX "float_sensors_parameter_idx" ON "argo_float_sensors" USING btree ("parameter_name");--> statement-breakpoint
CREATE INDEX "profile_measurements_profile_depth_idx" ON "argo_profile_measurements" USING btree ("profile_id","depth");--> statement-breakpoint
CREATE INDEX "profile_measurements_depth_idx" ON "argo_profile_measurements" USING btree ("depth");--> statement-breakpoint
CREATE INDEX "profile_measurements_temp_idx" ON "argo_profile_measurements" USING btree ("temperature");