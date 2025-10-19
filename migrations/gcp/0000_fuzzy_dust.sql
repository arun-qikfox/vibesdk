CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_preview" text NOT NULL,
	"scopes" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp with time zone,
	"request_count" integer DEFAULT 0,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "app_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" text,
	"is_edited" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "app_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "app_views" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"user_id" text,
	"session_token" text,
	"ip_address_hash" text,
	"referrer" text,
	"user_agent" text,
	"device_type" text,
	"viewed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon_url" text,
	"original_prompt" text NOT NULL,
	"final_prompt" text,
	"framework" text,
	"user_id" text,
	"session_token" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"deployment_id" text,
	"github_repository_url" text,
	"github_repository_visibility" text,
	"is_archived" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"parent_app_id" text,
	"screenshot_url" text,
	"screenshot_captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"last_deployed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"attempt_type" text NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"attempted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reaction_type" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"provider" text NOT NULL,
	"redirect_uri" text,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"user_id" text,
	"code_verifier" text,
	"nonce" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"expires_at" timestamp with time zone NOT NULL,
	"is_used" boolean DEFAULT false,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_info" text,
	"user_agent" text,
	"ip_address" text,
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"last_activity" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"starred_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_by" text,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_model_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_action_name" text NOT NULL,
	"model_name" text,
	"max_tokens" integer,
	"temperature" double precision,
	"reasoning_effort" text,
	"provider_override" text,
	"fallback_model" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "user_model_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"secret_id" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "user_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"secret_type" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"key_preview" text NOT NULL,
	"description" text,
	"expires_at" timestamp with time zone,
	"last_used" timestamp with time zone,
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"password_hash" text,
	"failed_login_attempts" integer DEFAULT 0,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"theme" text DEFAULT 'system',
	"timezone" text DEFAULT 'UTC',
	"is_active" boolean DEFAULT true,
	"is_suspended" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"last_active_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification_otps" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_comments" ADD CONSTRAINT "app_comments_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_comments" ADD CONSTRAINT "app_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_likes" ADD CONSTRAINT "app_likes_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_likes" ADD CONSTRAINT "app_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_views" ADD CONSTRAINT "app_views_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_views" ADD CONSTRAINT "app_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_app_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."app_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_configs" ADD CONSTRAINT "user_model_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_providers" ADD CONSTRAINT "user_model_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_providers" ADD CONSTRAINT "user_model_providers_secret_id_user_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."user_secrets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_secrets" ADD CONSTRAINT "user_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_is_active_idx" ON "api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "app_comments_app_idx" ON "app_comments" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_comments_user_idx" ON "app_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_comments_parent_idx" ON "app_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_likes_app_user_idx" ON "app_likes" USING btree ("app_id","user_id");--> statement-breakpoint
CREATE INDEX "app_likes_user_idx" ON "app_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_views_app_idx" ON "app_views" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_views_user_idx" ON "app_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_views_viewed_at_idx" ON "app_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "app_views_app_viewed_at_idx" ON "app_views" USING btree ("app_id","viewed_at");--> statement-breakpoint
CREATE INDEX "apps_user_idx" ON "apps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apps_status_idx" ON "apps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apps_visibility_idx" ON "apps" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "apps_session_token_idx" ON "apps" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "apps_parent_app_idx" ON "apps" USING btree ("parent_app_id");--> statement-breakpoint
CREATE INDEX "apps_search_idx" ON "apps" USING btree ("title","description");--> statement-breakpoint
CREATE INDEX "apps_framework_status_idx" ON "apps" USING btree ("framework","status");--> statement-breakpoint
CREATE INDEX "apps_visibility_status_idx" ON "apps" USING btree ("visibility","status");--> statement-breakpoint
CREATE INDEX "apps_created_at_idx" ON "apps" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "apps_updated_at_idx" ON "apps" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_lookup_idx" ON "auth_attempts" USING btree ("identifier","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_ip_idx" ON "auth_attempts" USING btree ("ip_address","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_success_idx" ON "auth_attempts" USING btree ("success","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_type_idx" ON "auth_attempts" USING btree ("attempt_type","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_likes_comment_user_idx" ON "comment_likes" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "comment_likes_user_idx" ON "comment_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comment_likes_comment_idx" ON "comment_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_lookup_idx" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_expiry_idx" ON "email_verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_app_idx" ON "favorites" USING btree ("user_id","app_id");--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorites_app_idx" ON "favorites" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_states_state_idx" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_lookup_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expiry_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_access_token_hash_idx" ON "sessions" USING btree ("access_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_last_activity_idx" ON "sessions" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX "sessions_is_revoked_idx" ON "sessions" USING btree ("is_revoked");--> statement-breakpoint
CREATE UNIQUE INDEX "stars_user_app_idx" ON "stars" USING btree ("user_id","app_id");--> statement-breakpoint
CREATE INDEX "stars_user_idx" ON "stars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stars_app_idx" ON "stars" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "stars_app_starred_at_idx" ON "stars" USING btree ("app_id","starred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_model_configs_user_agent_idx" ON "user_model_configs" USING btree ("user_id","agent_action_name");--> statement-breakpoint
CREATE INDEX "user_model_configs_user_idx" ON "user_model_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_model_configs_is_active_idx" ON "user_model_configs" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "user_model_providers_user_name_idx" ON "user_model_providers" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "user_model_providers_user_idx" ON "user_model_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_model_providers_is_active_idx" ON "user_model_providers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_secrets_user_idx" ON "user_secrets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_secrets_provider_idx" ON "user_secrets" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "user_secrets_user_provider_idx" ON "user_secrets" USING btree ("user_id","provider","secret_type");--> statement-breakpoint
CREATE INDEX "user_secrets_active_idx" ON "user_secrets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_unique_idx" ON "users" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_failed_login_attempts_idx" ON "users" USING btree ("failed_login_attempts");--> statement-breakpoint
CREATE INDEX "users_locked_until_idx" ON "users" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_last_active_at_idx" ON "users" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "verification_otps_email_idx" ON "verification_otps" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_otps_expires_at_idx" ON "verification_otps" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verification_otps_used_idx" ON "verification_otps" USING btree ("used");