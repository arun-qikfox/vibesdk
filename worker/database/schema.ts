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
};

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
	VerificationOtp,
	NewVerificationOtp,
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
} from './schema.sqlite';
