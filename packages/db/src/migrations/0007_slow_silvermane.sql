CREATE TABLE "processing_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"successful_float_ids" bigint[] DEFAULT '{}'::bigint[],
	"failed_float_ids" bigint[] DEFAULT '{}'::bigint[],
	"error_details" json,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT NOW()
);
