ALTER TABLE "processing_log" ALTER COLUMN "operation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_log" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_log" ADD COLUMN "successful_float_ids" bigint[] DEFAULT '{}'::bigint[];--> statement-breakpoint
ALTER TABLE "processing_log" ADD COLUMN "failed_float_ids" bigint[] DEFAULT '{}'::bigint[];--> statement-breakpoint
ALTER TABLE "processing_log" DROP COLUMN "float_id";