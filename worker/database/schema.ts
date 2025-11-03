import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import * as sqliteSchema from './schema.sqlite';
import * as postgresSchema from './schema.gcp';

type SqliteSchema = typeof sqliteSchema;

const schemaSource: SqliteSchema =
	getRuntimeProvider() === 'gcp'
		? (postgresSchema as unknown as SqliteSchema)
		: sqliteSchema;

const schema = schemaSource;

const {
	users,
	sessions,
	apiKeys,
	apps,
	favorites,
	stars,
	appLikes,
	commentLikes,
	appComments,
	appViews,
	oauthStates,
	authAttempts,
	passwordResetTokens,
	emailVerificationTokens,
	verificationOtps,
	auditLogs,
	userSecrets,
	userModelConfigs,
	userModelProviders,
	systemSettings,
	rateLimitBuckets,
	appDeployments,
} = schema;

export {
	schema,
	users,
	sessions,
	apiKeys,
	apps,
	favorites,
	stars,
	appLikes,
	commentLikes,
	appComments,
	appViews,
	oauthStates,
	authAttempts,
	passwordResetTokens,
	emailVerificationTokens,
	verificationOtps,
	auditLogs,
	userSecrets,
	userModelConfigs,
	userModelProviders,
	systemSettings,
	rateLimitBuckets,
	appDeployments,
};

// Agent state management tables (Strategy B) - only available in GCP
// These are exported conditionally to avoid type errors in non-GCP environments
const gcpSchema = postgresSchema;
export const agentSessions = gcpSchema.agentSessions;
export const agentPhases = gcpSchema.agentPhases;
export const templateAssets = gcpSchema.templateAssets;
export const agentExecutionLogs = gcpSchema.agentExecutionLogs;
export const websocketConnections = gcpSchema.websocketConnections;

export type DatabaseSchema = typeof schema;

export type {
	User,
	NewUser,
	Session,
	NewSession,
	ApiKey,
	NewApiKey,
	App,
	NewApp,
	Favorite,
	NewFavorite,
	Star,
	NewStar,
	AppLike,
	NewAppLike,
	CommentLike,
	NewCommentLike,
	AppComment,
	NewAppComment,
	AppView,
	NewAppView,
	OAuthState,
	NewOAuthState,
	AuthAttempt,
	NewAuthAttempt,
	PasswordResetToken,
	NewPasswordResetToken,
	EmailVerificationToken,
	NewEmailVerificationToken,
	AuditLog,
	NewAuditLog,
	UserSecret,
	NewUserSecret,
	UserModelConfig,
	NewUserModelConfig,
	UserModelProvider,
	NewUserModelProvider,
	SystemSetting,
	NewSystemSetting,
	RateLimitBucketRecord,
	NewRateLimitBucketRecord,
	AppDeployment,
	NewAppDeployment,
	AppDeploymentTarget,
	AppDeploymentStatus,
} from './schema.sqlite';
