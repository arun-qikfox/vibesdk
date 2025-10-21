CREATE TABLE "app_deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"target" text NOT NULL,
	"service_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "app_deployments" ADD CONSTRAINT "app_deployments_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_deployments_app_target_version_idx" ON "app_deployments" USING btree ("app_id","target","version");--> statement-breakpoint
CREATE INDEX "app_deployments_app_idx" ON "app_deployments" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_deployments_target_idx" ON "app_deployments" USING btree ("target");