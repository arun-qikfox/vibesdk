import { sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	boolean,
	timestamp,
	bigint,
	jsonb,
	doublePrecision,
	index,
	uniqueIndex,
	serial,
	primaryKey,
} from 'drizzle-orm/pg-core';

// Schema enum arrays derived from config types
const REASONING_EFFORT_VALUES = ['low', 'medium', 'high'] as const;
const PROVIDER_OVERRIDE_VALUES = ['cloudflare', 'direct'] as const;
const DEPLOYMENT_TARGET_VALUES = ['gcp-cloud-run', 'cloudflare-workers'] as const;
const DEPLOYMENT_STATUS_VALUES = [
	'pending',
	'deploying',
	'active',
	'failed',
	'removed',
] as const;

// ========================================
// CORE USER AND IDENTITY MANAGEMENT
// ========================================

/**
 * Users table - Core user identity and profile information
 * Supports OAuth providers and user preferences
 */
export const users = pgTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull().unique(),
		username: text('username').unique(), // Optional username for public identity
		displayName: text('display_name').notNull(),
		avatarUrl: text('avatar_url'),
		bio: text('bio'),

		// OAuth and Authentication
		provider: text('provider').notNull(), // 'github', 'google', 'email'
		providerId: text('provider_id').notNull(),
		emailVerified: boolean('email_verified').default(false),
		passwordHash: text('password_hash'), // Only for provider: 'email'

		// Security enhancements
		failedLoginAttempts: integer('failed_login_attempts').default(0),
		lockedUntil: timestamp('locked_until', { withTimezone: true }),
		passwordChangedAt: timestamp('password_changed_at', {
			withTimezone: true,
		}),

		// User Preferences and Settings
		preferences: jsonb('preferences')
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),
		theme: text('theme')
			.$type<'light' | 'dark' | 'system'>()
			.default('system'),
		timezone: text('timezone').default('UTC'),

		// Account Status
		isActive: boolean('is_active').default(true),
		isSuspended: boolean('is_suspended').default(false),

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

		// Soft delete
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(table) => ({
		emailIdx: index('users_email_idx').on(table.email),
		providerIdx: uniqueIndex('users_provider_unique_idx').on(
			table.provider,
			table.providerId,
		),
		usernameIdx: index('users_username_idx').on(table.username),
		failedLoginAttemptsIdx: index('users_failed_login_attempts_idx').on(
			table.failedLoginAttempts,
		),
		lockedUntilIdx: index('users_locked_until_idx').on(table.lockedUntil),
		isActiveIdx: index('users_is_active_idx').on(table.isActive),
		lastActiveAtIdx: index('users_last_active_at_idx').on(
			table.lastActiveAt,
		),
	}),
);

/**
 * Sessions table - JWT session management with refresh token support
 */
export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Session Details
		deviceInfo: text('device_info'),
		userAgent: text('user_agent'),
		ipAddress: text('ip_address'),

		// Security metadata
		isRevoked: boolean('is_revoked').default(false),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		revokedReason: text('revoked_reason'),

		// Token Management
		accessTokenHash: text('access_token_hash').notNull(),
		refreshTokenHash: text('refresh_token_hash').notNull(),

		// Timing
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		lastActivity: timestamp('last_activity', { withTimezone: true }),
	},
	(table) => ({
		userIdIdx: index('sessions_user_id_idx').on(table.userId),
		expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
		accessTokenHashIdx: index('sessions_access_token_hash_idx').on(
			table.accessTokenHash,
		),
		refreshTokenHashIdx: index('sessions_refresh_token_hash_idx').on(
			table.refreshTokenHash,
		),
		lastActivityIdx: index('sessions_last_activity_idx').on(
			table.lastActivity,
		),
		isRevokedIdx: index('sessions_is_revoked_idx').on(table.isRevoked),
	}),
);

/**
 * API Keys table - Manage user API keys for programmatic access
 */
export const apiKeys = pgTable(
	'api_keys',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Key Details
		name: text('name').notNull(), // User-friendly name for the API key
		keyHash: text('key_hash').notNull().unique(), // Hashed API key for security
		keyPreview: text('key_preview').notNull(), // First few characters for display (e.g., "sk_prod_1234...")

		// Security and Access Control
		scopes: text('scopes').notNull(), // JSON array of allowed scopes
		isActive: boolean('is_active').default(true),

		// Usage Tracking
		lastUsed: timestamp('last_used', { withTimezone: true }),
		requestCount: integer('request_count').default(0), // Track usage

		// Timing
		expiresAt: timestamp('expires_at', { withTimezone: true }), // Optional expiration
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userIdIdx: index('api_keys_user_id_idx').on(table.userId),
		keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
		isActiveIdx: index('api_keys_is_active_idx').on(table.isActive),
		expiresAtIdx: index('api_keys_expires_at_idx').on(table.expiresAt),
	}),
);

// ========================================
// CORE APP AND GENERATION SYSTEM
// ========================================

/**
 * Apps table - Generated applications with comprehensive metadata
 */
export const apps = pgTable(
	'apps',
	{
		id: text('id').primaryKey(),

		// App Identity
		title: text('title').notNull(),
		description: text('description'),
		iconUrl: text('icon_url'), // App icon URL

		// Original Generation Data
		originalPrompt: text('original_prompt').notNull(), // The user's original request
		finalPrompt: text('final_prompt'), // The processed/refined prompt used for generation

		// Generated Content
		framework: text('framework'), // 'react', 'vue', 'svelte', etc.

		// Ownership and Context
		userId: text('user_id').references(() => users.id, {
			onDelete: 'cascade',
		}), // Null for anonymous
		sessionToken: text('session_token'), // For anonymous users

		// Visibility and Sharing
		visibility: text('visibility')
			.$type<'private' | 'public'>()
			.notNull()
			.default('private'),

		// Status and State
		status: text('status')
			.$type<'generating' | 'completed'>()
			.notNull()
			.default('generating'),

		// Deployment Information
		deploymentId: text('deployment_id'), // Deployment ID (extracted from deployment URL)

		// GitHub Repository Integration
		githubRepositoryUrl: text('github_repository_url'), // GitHub repository URL
		githubRepositoryVisibility: text('github_repository_visibility').$type<
			'public' | 'private'
		>(), // Repository visibility

		// App Metadata
		isArchived: boolean('is_archived').default(false),
		isFeatured: boolean('is_featured').default(false), // Featured by admins

		// Versioning (for future support)
		version: integer('version').default(1),
		parentAppId: text('parent_app_id'), // If forked from another app

		// Screenshot Information
		screenshotUrl: text('screenshot_url'), // URL to saved screenshot image
		screenshotCapturedAt: timestamp('screenshot_captured_at', {
			withTimezone: true,
		}), // When screenshot was last captured

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		lastDeployedAt: timestamp('last_deployed_at', { withTimezone: true }),
	},
	(table) => ({
		userIdx: index('apps_user_idx').on(table.userId),
		statusIdx: index('apps_status_idx').on(table.status),
		visibilityIdx: index('apps_visibility_idx').on(table.visibility),
		sessionTokenIdx: index('apps_session_token_idx').on(table.sessionToken),
		parentAppIdx: index('apps_parent_app_idx').on(table.parentAppId),
		// Performance indexes for common queries
		searchIdx: index('apps_search_idx').on(table.title, table.description),
		frameworkStatusIdx: index('apps_framework_status_idx').on(
			table.framework,
			table.status,
		),
		visibilityStatusIdx: index('apps_visibility_status_idx').on(
			table.visibility,
			table.status,
		),
		createdAtIdx: index('apps_created_at_idx').on(table.createdAt),
		updatedAtIdx: index('apps_updated_at_idx').on(table.updatedAt),
	}),
);

export const appDeployments = pgTable(
	'app_deployments',
	{
		id: serial('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),
		version: integer('version').notNull().default(1),
		target: text('target')
			.$type<(typeof DEPLOYMENT_TARGET_VALUES)[number]>()
			.notNull(),
		serviceUrl: text('service_url'),
		status: text('status')
			.$type<(typeof DEPLOYMENT_STATUS_VALUES)[number]>()
			.notNull()
			.default('pending'),
		metadata: jsonb('metadata')
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		appTargetVersionIdx: uniqueIndex(
			'app_deployments_app_target_version_idx',
		).on(table.appId, table.target, table.version),
		appIdx: index('app_deployments_app_idx').on(table.appId),
		targetIdx: index('app_deployments_target_idx').on(table.target),
	}),
);

/**
 * Favorites table - Track user favorite apps
 */
export const favorites = pgTable(
	'favorites',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userAppIdx: uniqueIndex('favorites_user_app_idx').on(
			table.userId,
			table.appId,
		),
		userIdx: index('favorites_user_idx').on(table.userId),
		appIdx: index('favorites_app_idx').on(table.appId),
	}),
);

/**
 * Stars table - Track app stars (like GitHub stars)
 */
export const stars = pgTable(
	'stars',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),
		starredAt: timestamp('starred_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userAppIdx: uniqueIndex('stars_user_app_idx').on(
			table.userId,
			table.appId,
		),
		userIdx: index('stars_user_idx').on(table.userId),
		appIdx: index('stars_app_idx').on(table.appId),
		appStarredAtIdx: index('stars_app_starred_at_idx').on(
			table.appId,
			table.starredAt,
		),
	}),
);

// ========================================
// COMMUNITY INTERACTIONS
// ========================================

/**
 * AppLikes table - User likes/reactions on apps
 */
export const appLikes = pgTable(
	'app_likes',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Reaction Details
		reactionType: text('reaction_type').notNull().default('like'), // 'like', 'love', 'helpful', etc.

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		appUserIdx: uniqueIndex('app_likes_app_user_idx').on(
			table.appId,
			table.userId,
		),
		userIdx: index('app_likes_user_idx').on(table.userId),
	}),
);

/**
 * CommentLikes table - User likes on comments
 */
export const commentLikes = pgTable(
	'comment_likes',
	{
		id: text('id').primaryKey(),
		commentId: text('comment_id')
			.notNull()
			.references(() => appComments.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Reaction Details
		reactionType: text('reaction_type').notNull().default('like'), // 'like', 'love', 'helpful', etc.

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		commentUserIdx: uniqueIndex('comment_likes_comment_user_idx').on(
			table.commentId,
			table.userId,
		),
		userIdx: index('comment_likes_user_idx').on(table.userId),
		commentIdx: index('comment_likes_comment_idx').on(table.commentId),
	}),
);

/**
 * AppComments table - Comments and discussions on apps
 */
export const appComments = pgTable(
	'app_comments',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Comment Content
		content: text('content').notNull(),
		parentCommentId: text('parent_comment_id'), // For threaded comments

		// Moderation
		isEdited: boolean('is_edited').default(false),
		isDeleted: boolean('is_deleted').default(false),

		// Removed likeCount and replyCount - use COUNT() queries with proper indexes instead

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		appIdx: index('app_comments_app_idx').on(table.appId),
		userIdx: index('app_comments_user_idx').on(table.userId),
		parentIdx: index('app_comments_parent_idx').on(table.parentCommentId),
	}),
);

// ========================================
// ANALYTICS AND TRACKING
// ========================================

/**
 * AppViews table - Track app views for analytics
 */
export const appViews = pgTable(
	'app_views',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'cascade' }),

		// Viewer Information
		userId: text('user_id').references(() => users.id, {
			onDelete: 'cascade',
		}), // Null for anonymous
		sessionToken: text('session_token'), // For anonymous tracking
		ipAddressHash: text('ip_address_hash'), // Hashed IP for privacy

		// View Context
		referrer: text('referrer'),
		userAgent: text('user_agent'),
		deviceType: text('device_type'), // 'desktop', 'mobile', 'tablet'

		// Timing
		viewedAt: timestamp('viewed_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		durationSeconds: integer('duration_seconds'), // How long they viewed
	},
	(table) => ({
		appIdx: index('app_views_app_idx').on(table.appId),
		userIdx: index('app_views_user_idx').on(table.userId),
		viewedAtIdx: index('app_views_viewed_at_idx').on(table.viewedAt),
		appViewedAtIdx: index('app_views_app_viewed_at_idx').on(
			table.appId,
			table.viewedAt,
		),
	}),
);

// ========================================
// OAUTH AND EXTERNAL INTEGRATIONS
// ========================================

/**
 * OAuthStates table - Manage OAuth flow states securely
 */
export const oauthStates = pgTable(
	'oauth_states',
	{
		id: text('id').primaryKey(),
		state: text('state').notNull().unique(), // OAuth state parameter
		provider: text('provider').notNull(), // 'github', 'google', etc.

		// Flow Context
		redirectUri: text('redirect_uri'),
		scopes: jsonb('scopes')
			.$type<string[]>()
			.default(sql`'[]'::jsonb`),
		userId: text('user_id').references(() => users.id), // If linking to existing account

		// Security
		codeVerifier: text('code_verifier'), // For PKCE
		nonce: text('nonce'),

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		isUsed: boolean('is_used').default(false),
	},
	(table) => ({
		stateIdx: uniqueIndex('oauth_states_state_idx').on(table.state),
		expiresAtIdx: index('oauth_states_expires_at_idx').on(table.expiresAt),
	}),
);

// ========================================
// NORMALIZED RELATIONSHIPS
// ========================================

/**
 * Auth Attempts table - Security monitoring and rate limiting
 */
export const authAttempts = pgTable(
	'auth_attempts',
	{
		id: serial('id').primaryKey(),
		identifier: text('identifier').notNull(),
		attemptType: text('attempt_type')
			.$type<
				| 'login'
				| 'register'
				| 'oauth_google'
				| 'oauth_github'
				| 'refresh'
				| 'reset_password'
			>()
			.notNull(),
		success: boolean('success').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		attemptedAt: timestamp('attempted_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		lookupIdx: index('auth_attempts_lookup_idx').on(
			table.identifier,
			table.attemptedAt,
		),
		ipIdx: index('auth_attempts_ip_idx').on(
			table.ipAddress,
			table.attemptedAt,
		),
		successIdx: index('auth_attempts_success_idx').on(
			table.success,
			table.attemptedAt,
		),
		attemptTypeIdx: index('auth_attempts_type_idx').on(
			table.attemptType,
			table.attemptedAt,
		),
	}),
);

/**
 * Password Reset Tokens table - Secure password reset functionality
 */
export const passwordResetTokens = pgTable(
	'password_reset_tokens',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		used: boolean('used').default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		lookupIdx: index('password_reset_tokens_lookup_idx').on(
			table.tokenHash,
		),
		expiryIdx: index('password_reset_tokens_expiry_idx').on(
			table.expiresAt,
		),
	}),
);

/**
 * Email Verification Tokens table - Email verification functionality
 */
export const emailVerificationTokens = pgTable(
	'email_verification_tokens',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		email: text('email').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		used: boolean('used').default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		lookupIdx: index('email_verification_tokens_lookup_idx').on(
			table.tokenHash,
		),
		expiryIdx: index('email_verification_tokens_expiry_idx').on(
			table.expiresAt,
		),
	}),
);

/**
 * Verification OTPs table - Store OTP codes for email verification
 */
export const verificationOtps = pgTable(
	'verification_otps',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		otp: text('otp').notNull(), // Hashed OTP code
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		used: boolean('used').default(false),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		emailIdx: index('verification_otps_email_idx').on(table.email),
		expiresAtIdx: index('verification_otps_expires_at_idx').on(
			table.expiresAt,
		),
		usedIdx: index('verification_otps_used_idx').on(table.used),
	}),
);

/**
 * AuditLogs table - Track important changes for compliance
 */
export const auditLogs = pgTable(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => users.id, {
			onDelete: 'set null',
		}),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		action: text('action').notNull(),
		oldValues: jsonb('old_values').$type<Record<string, unknown> | null>(),
		newValues: jsonb('new_values').$type<Record<string, unknown> | null>(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userIdx: index('audit_logs_user_idx').on(table.userId),
		entityIdx: index('audit_logs_entity_idx').on(
			table.entityType,
			table.entityId,
		),
		createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
	}),
);

// ========================================
// USER SECRETS AND API KEYS
// ========================================

/**
 * User Secrets table - Stores encrypted API keys and secrets for code generation
 * Used by code generator to access external services (Stripe, OpenAI, etc.)
 */
export const userSecrets = pgTable(
	'user_secrets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Secret identification
		name: text('name').notNull(), // User-friendly name (e.g., "My Stripe API Key")
		provider: text('provider').notNull(), // Service provider (stripe, openai, etc.)
		secretType: text('secret_type').notNull(), // api_key, account_id, secret_key, token, etc.

		// Encrypted secret data
		encryptedValue: text('encrypted_value').notNull(), // AES-256 encrypted secret
		keyPreview: text('key_preview').notNull(), // First/last few chars for identification

		// Configuration and metadata
		description: text('description'), // Optional user description
		expiresAt: timestamp('expires_at', { withTimezone: true }), // Optional expiration

		// Usage tracking
		lastUsed: timestamp('last_used', { withTimezone: true }),
		usageCount: integer('usage_count').default(0),

		// Status and security
		isActive: boolean('is_active').default(true),

		// Metadata
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userIdx: index('user_secrets_user_idx').on(table.userId),
		providerIdx: index('user_secrets_provider_idx').on(table.provider),
		userProviderIdx: index('user_secrets_user_provider_idx').on(
			table.userId,
			table.provider,
			table.secretType,
		),
		activeIdx: index('user_secrets_active_idx').on(table.isActive),
	}),
);

// ========================================
// USER MODEL CONFIGURATIONS
// ========================================

/**
 * User Model Configurations table - User-specific AI model settings that override defaults
 */
export const userModelConfigs = pgTable(
	'user_model_configs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Configuration Details
		agentActionName: text('agent_action_name').notNull(), // Maps to AgentActionKey from config.ts
		modelName: text('model_name'), // Override for AIModels - null means use default
		maxTokens: integer('max_tokens'), // Override max tokens - null means use default
		temperature: doublePrecision('temperature'), // Override temperature - null means use default
		reasoningEffort:
			text('reasoning_effort').$type<
				(typeof REASONING_EFFORT_VALUES)[number]
			>(), // Override reasoning effort
		providerOverride:
			text('provider_override').$type<
				(typeof PROVIDER_OVERRIDE_VALUES)[number]
			>(), // Override provider
		fallbackModel: text('fallback_model'), // Override fallback model

		// Status and Metadata
		isActive: boolean('is_active').default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userAgentIdx: uniqueIndex('user_model_configs_user_agent_idx').on(
			table.userId,
			table.agentActionName,
		),
		userIdx: index('user_model_configs_user_idx').on(table.userId),
		isActiveIdx: index('user_model_configs_is_active_idx').on(
			table.isActive,
		),
	}),
);

/**
 * User Model Providers table - Custom OpenAI-compatible providers
 */
export const userModelProviders = pgTable(
	'user_model_providers',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		// Provider Details
		name: text('name').notNull(), // User-friendly name (e.g., "My Local Ollama")
		baseUrl: text('base_url').notNull(), // OpenAI-compatible API base URL
		secretId: text('secret_id').references(() => userSecrets.id), // API key stored in userSecrets

		// Status and Metadata
		isActive: boolean('is_active').default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		userNameIdx: uniqueIndex('user_model_providers_user_name_idx').on(
			table.userId,
			table.name,
		),
		userIdx: index('user_model_providers_user_idx').on(table.userId),
		isActiveIdx: index('user_model_providers_is_active_idx').on(
			table.isActive,
		),
	}),
);

// ========================================
// SYSTEM CONFIGURATION
// ========================================

/**
 * SystemSettings table - Global system configuration
 */
export const systemSettings = pgTable(
	'system_settings',
	{
		id: text('id').primaryKey(),
		key: text('key').notNull().unique(),
		value: jsonb('value').$type<Record<string, unknown>>(),
		description: text('description'),

		// Metadata
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedBy: text('updated_by').references(() => users.id),
	},
	(table) => ({
		keyIdx: uniqueIndex('system_settings_key_idx').on(table.key),
	}),
);

export const rateLimitBuckets = pgTable(
	'rate_limit_buckets',
	{
		key: text('key').notNull(),
		windowStart: bigint('window_start', { mode: 'number' }).notNull(),
		count: integer('count').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.key, table.windowStart] }),
	}),
);

// ========================================
// STRATEGY B: AGENT STATE MANAGEMENT
// ========================================

/**
 * Agent Sessions (Durable Object equivalent)
 * Stores session information and state for long-running agent executions
 */
export const agentSessions = pgTable(
	'agent_sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.references(() => users.id, { onDelete: 'cascade' }),
		appId: text('app_id')
			.references(() => apps.id, { onDelete: 'cascade' }),

		// Session state
		status: text('status')
			.$type<'initialized' | 'blueprint_generated' | 'executing' | 'reviewing' | 'completed' | 'failed'>()
			.notNull()
			.default('initialized'),

		// Execution data (blueprints, current state)
		blueprint: jsonb('blueprint')
			.$type<Record<string, unknown>>(),
		phases: jsonb('phases')
			.$type<Array<Record<string, unknown>>>()
			.default(sql`'[]'::jsonb`),
		executionData: jsonb('execution_data')
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),
		state: jsonb('state')
			.$type<Record<string, unknown>>(),

		// Timing
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		abortedAt: timestamp('aborted_at', { withTimezone: true }),

		// Error handling
		errorMessage: text('error_message'),
		errorDetails: jsonb('error_details')
			.$type<Record<string, unknown>>(),

		// Resource tracking
		gcpAiTokensUsed: integer('gcp_ai_tokens_used').default(0),
		gcpStorageOperations: integer('gcp_storage_operations').default(0),
		executionTimeSeconds: integer('execution_time_seconds').default(0),
	},
	(table) => ({
		userIdIdx: index('idx_agent_sessions_user_id').on(table.userId),
		appIdIdx: index('idx_agent_sessions_app_id').on(table.appId),
		statusIdx: index('idx_agent_sessions_status').on(table.status),
		createdAtIdx: index('idx_agent_sessions_created_at').on(table.createdAt),
		updatedAtIdx: index('idx_agent_sessions_updated_at').on(table.updatedAt),
	}),
);

/**
 * Agent Phases (Execution Steps)
 * Tracks individual phases within an agent session
 */
export const agentPhases = pgTable(
	'agent_phases',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => agentSessions.id, { onDelete: 'cascade' }),

		// Phase identification
		phaseName: text('phase_name').notNull(),
		phaseType: text('phase_type')
			.$type<'blueprint' | 'analysis' | 'code_generation' | 'integration' | 'review' | 'deployment' | 'completion'>()
			.notNull(),
		phaseKey: text('phase_key'), // Unique key within session

		// Status and execution
		status: text('status')
			.$type<'pending' | 'running' | 'completed' | 'failed' | 'skipped'>()
			.notNull()
			.default('pending'),
		priority: integer('priority').default(1),

		// Data flow
		config: jsonb('config')
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),
		inputData: jsonb('input_data')
			.$type<Record<string, unknown>>(),
		result: jsonb('result')
			.$type<Record<string, unknown>>(),
		outputFiles: jsonb('output_files')
			.$type<Array<Record<string, unknown>>>()
			.default(sql`'[]'::jsonb`),

		// Error handling
		errorMessage: text('error_message'),
		errorDetails: jsonb('error_details')
			.$type<Record<string, unknown>>(),
		retryCount: integer('retry_count').default(0),

		// Timing
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		queuedAt: timestamp('queued_at', { withTimezone: true }),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),

		// Dependencies (simplified as JSON array)
		dependsOn: jsonb('depends_on')
			.$type<Array<string>>()
			.default(sql`'[]'::jsonb`),

		// Resource usage tracking
		phaseTokensUsed: integer('phase_tokens_used').default(0),
		phaseExecutionTimeSeconds: integer('phase_execution_time_seconds').default(0),
	},
	(table) => ({
		sessionIdIdx: index('idx_agent_phases_session_id').on(table.sessionId),
		statusIdx: index('idx_agent_phases_status').on(table.status),
		typeIdx: index('idx_agent_phases_type').on(table.phaseType),
		priorityIdx: index('idx_agent_phases_priority').on(table.priority),
		createdAtIdx: index('idx_agent_phases_created_at').on(table.createdAt),
	}),
);

/**
 * Template Assets Cache
 * Caches template files for faster agent execution
 */
export const templateAssets = pgTable(
	'template_assets',
	{
		id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
		templateName: text('template_name').notNull(),
		assetPath: text('asset_path').notNull(),

		// Content and caching
		contentHash: text('content_hash').notNull(),
		cachedContent: text('cached_content'),
		isLargeFile: boolean('is_large_file').default(false),

		// Metadata
		fileSizeBytes: integer('file_size_bytes'),
		mimeType: text('mime_type'),
		lastAccessed: timestamp('last_accessed', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		updatedAt: timestamp('updated_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),

		// GCS integration
		gcsBucket: text('gcs_bucket'),
		gcsPath: text('gcs_path'),

		// Usage tracking
		accessCount: integer('access_count').default(0),
		lastUsedInSession: text('last_used_in_session').references(() => agentSessions.id, {
			onDelete: 'set null',
		}),
	},
	(table) => ({
		templateIdx: index('idx_template_assets_template_name').on(table.templateName),
		hashIdx: index('idx_template_assets_content_hash').on(table.contentHash),
		accessedIdx: index('idx_template_assets_last_accessed').on(table.lastAccessed),
		countIdx: index('idx_template_assets_access_count').on(table.accessCount),
		templatePathIdx: uniqueIndex('template_assets_template_path_idx').on(
			table.templateName,
			table.assetPath,
		),
	}),
);

/**
 * Agent Execution Logs
 * Detailed logging for debugging and monitoring
 */
export const agentExecutionLogs = pgTable(
	'agent_execution_logs',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().default(sql`gen_random_uuid()::text`),
		sessionId: text('session_id')
			.references(() => agentSessions.id, { onDelete: 'cascade' }),
		phaseId: text('phase_id')
			.references(() => agentPhases.id, { onDelete: 'cascade' }),

		// Log details
		level: text('level')
			.$type<'debug' | 'info' | 'warn' | 'error'>()
			.notNull()
			.default('info'),
		message: text('message').notNull(),
		details: jsonb('details')
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),

		// Context
		component: text('component'),
		operation: text('operation'),
		correlationId: text('correlation_id'),

		// Performance
		durationMs: integer('duration_ms'),
		memoryUsageMb: integer('memory_usage_mb'),
		gcpOperationsCount: integer('gcp_operations_count').default(0),

		// Timing
		timestamp: timestamp('timestamp', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
	},
	(table) => ({
		sessionIdx: index('idx_execution_logs_session_id').on(table.sessionId),
		phaseIdx: index('idx_execution_logs_phase_id').on(table.phaseId),
		levelIdx: index('idx_execution_logs_level').on(table.level),
		timestampIdx: index('idx_execution_logs_timestamp').on(table.timestamp),
		componentIdx: index('idx_execution_logs_component').on(table.component),
	}),
);

/**
 * WebSocket Connections
 * Tracks real-time WebSocket connections for agent sessions
 */
export const websocketConnections = pgTable(
	'websocket_connections',
	{
		id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
		sessionId: text('session_id')
			.references(() => agentSessions.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.references(() => users.id, { onDelete: 'cascade' }),

		// Connection details
		connectionId: text('connection_id').unique().notNull(),
		clientIp: text('client_ip'),
		userAgent: text('user_agent'),
		protocolVersion: text('protocol_version').default('1.0'),

		// Status
		status: text('status')
			.$type<'connected' | 'disconnected' | 'error' | 'closed'>()
			.notNull()
			.default('connected'),
		connectedAt: timestamp('connected_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),
		disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
		lastPing: timestamp('last_ping', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP`,
		),

		// Performance tracking
		messagesSent: integer('messages_sent').default(0),
		messagesReceived: integer('messages_received').default(0),
		bytesSent: integer('bytes_sent').default(0),
		bytesReceived: integer('bytes_received').default(0),

		// Error tracking
		errorCount: integer('error_count').default(0),
		lastError: text('last_error'),

		// Cleanup (computed column equivalent)
		expiresAt: timestamp('expires_at', { withTimezone: true }).default(
			sql`CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
		),
	},
	(table) => ({
		sessionIdx: index('idx_websocket_connections_session_id').on(table.sessionId),
		userIdx: index('idx_websocket_connections_user_id').on(table.userId),
		statusIdx: index('idx_websocket_connections_status').on(table.status),
		expiresIdx: index('idx_websocket_connections_expires_at').on(table.expiresAt),
		connectionIdIdx: uniqueIndex('idx_websocket_connections_connection_id').on(table.connectionId),
	}),
);

// ========================================
// TYPE EXPORTS FOR APPLICATION USE
// ========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;

export type AppLike = typeof appLikes.$inferSelect;
export type NewAppLike = typeof appLikes.$inferInsert;

export type CommentLike = typeof commentLikes.$inferSelect;
export type NewCommentLike = typeof commentLikes.$inferInsert;

export type AppComment = typeof appComments.$inferSelect;
export type NewAppComment = typeof appComments.$inferInsert;

export type AppView = typeof appViews.$inferSelect;
export type NewAppView = typeof appViews.$inferInsert;

export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;

export type AuthAttempt = typeof authAttempts.$inferSelect;
export type NewAuthAttempt = typeof authAttempts.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type EmailVerificationToken =
	typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken =
	typeof emailVerificationTokens.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type UserSecret = typeof userSecrets.$inferSelect;
export type NewUserSecret = typeof userSecrets.$inferInsert;

export type UserModelConfig = typeof userModelConfigs.$inferSelect;
export type NewUserModelConfig = typeof userModelConfigs.$inferInsert;
export type UserModelProvider = typeof userModelProviders.$inferSelect;
export type NewUserModelProvider = typeof userModelProviders.$inferInsert;

export type Star = typeof stars.$inferSelect;
export type NewStar = typeof stars.$inferInsert;

export type RateLimitBucketRecord = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucketRecord = typeof rateLimitBuckets.$inferInsert;

export type AppDeployment = typeof appDeployments.$inferSelect;
export type NewAppDeployment = typeof appDeployments.$inferInsert;
export type AppDeploymentTarget =
	(typeof DEPLOYMENT_TARGET_VALUES)[number];
export type AppDeploymentStatus =
	(typeof DEPLOYMENT_STATUS_VALUES)[number];
