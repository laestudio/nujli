ALTER TABLE "orders" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "extra_source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "submission_permission_at" timestamp with time zone;