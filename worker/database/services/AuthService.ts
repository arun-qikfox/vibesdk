// @ts-nocheck
/**
 * Main Authentication Service
 * Orchestrates all auth operations including login, registration, and OAuth
 */

import * as schema from '../schema';
import { eq, and, sql, or, lt, isNull } from 'drizzle-orm';
import { JWTUtils } from '../../utils/jwtUtils';
import { generateSecureToken } from '../../utils/cryptoUtils';
import { SessionService } from './SessionService';
import { PasswordService } from '../../utils/passwordService';
import { GoogleOAuthProvider } from '../../services/oauth/google';
import { GitHubOAuthProvider } from '../../services/oauth/github';
import { BaseOAuthProvider } from '../../services/oauth/base';
import {
    SecurityError,
    SecurityErrorType
} from 'shared/types/errors';
import { AuthResult, AuthUserSession, OAuthUserInfo } from '../../types/auth-types';
import { generateId } from '../../utils/idGenerator';
import {
    AuthUser,
    OAuthProvider
} from '../../types/auth-types';
import { mapUserResponse } from '../../utils/authUtils';
import { createLogger } from '../../logger';
import { validateEmail, validatePassword } from '../../utils/validationUtils';
import { extractRequestMetadata } from '../../utils/authUtils';
import { BaseService } from './BaseService';

const logger = createLogger('AuthService');

/**
 * Login credentials
 */
export interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Registration data
 */
export interface RegistrationData {
    email: string;
    password: string;
    name?: string;
}

/**
 * Main Authentication Service
 */
export class AuthService extends BaseService {
    private readonly sessionService: SessionService;
    private readonly passwordService: PasswordService;

    constructor(
        env: Env,
    ) {
        super(env);
        this.sessionService = new SessionService(env);
        this.passwordService = new PasswordService();
    }

    /**
     * Register a new user
     */
    async register(data: RegistrationData, request: Request): Promise<AuthResult> {
        try {
            // Validate email format using centralized utility
            const emailValidation = validateEmail(data.email);
            if (!emailValidation.valid) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    emailValidation.error || 'Invalid email format',
                    400
                );
            }

            // Validate password using centralized utility
            const passwordValidation = validatePassword(data.password, undefined, {
                email: data.email,
                name: data.name
            });
            if (!passwordValidation.valid) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    passwordValidation.errors!.join(', '),
                    400
                );
            }
            
            // Check if user already exists
            const existingUsers = await this.database
                .select({
                    id: schema.users.id,
                    email: schema.users.email,
                    passwordHash: schema.users.passwordHash
                })
                .from(schema.users)
                .where(eq(schema.users.email, data.email.toLowerCase()))
                .limit(1);

            const existingUser = existingUsers[0];
            
            if (existingUser) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    'Email already registered',
                    400
                );
            }

            // Hash password
            const passwordHash = await this.passwordService.hash(data.password);

            // Create user
            const userId = generateId();
            const now = new Date();

            // Store user as verified immediately (no OTP verification required)
            await this.database.insert(schema.users).values({
                id: userId,
                email: data.email.toLowerCase(),
                passwordHash,
                displayName: data.name || data.email.split('@')[0],
                emailVerified: true, // Set as verified immediately
                provider: 'email',
                providerId: userId,
                createdAt: now,
                updatedAt: now
            });

            // Get the created user
            const newUsers = await this.database
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, userId))
                .limit(1);

            const newUser = newUsers[0];

            if (!newUser) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    'Failed to retrieve created user',
                    500
                );
            }

            // Log successful registration (catch any logging errors silently)
            try {
                await this.logAuthAttempt(data.email, 'register', true, request);
            } catch (logError) {
                logger.debug('Auth attempt logging failed during registration', { error: logError });
            }
            logger.info('User registered and logged in directly', { userId, email: data.email });

            // Create session and tokens immediately (log user in after registration)
            const { accessToken, session } = await this.sessionService.createSession(
                userId,
                request
            );

            return {
                user: mapUserResponse(newUser),
                sessionId: session.sessionId,
                expiresAt: session.expiresAt,
                accessToken,
            };
        } catch (error) {
            // Log failed registration attempt (catch any logging errors silently)
            try {
                await this.logAuthAttempt(data.email, 'register', false, request);
            } catch (logError) {
                logger.debug('Auth attempt logging failed during registration error', { error: logError });
            }

            if (error instanceof SecurityError) {
                throw error;
            }

            logger.error('Registration error', error);
            throw new SecurityError(
                SecurityErrorType.INVALID_INPUT,
                'Registration failed',
                500
            );
        }
    }

    /**
     * Login with email and password
     */
    async login(credentials: LoginCredentials, request: Request): Promise<AuthResult> {
        try {
            // Find user
            const users = await this.database
                .select({
                    id: schema.users.id,
                    email: schema.users.email,
                    passwordHash: schema.users.passwordHash,
                    displayName: schema.users.displayName || 'Unknown',
                    emailVerified: schema.users.emailVerified || false,
                    provider: schema.users.provider || 'email',
                    createdAt: schema.users.createdAt,
                    avatarUrl: schema.users.avatarUrl
                })
                .from(schema.users)
                .where(
                    and(
                        eq(schema.users.email, credentials.email.toLowerCase()),
                        sql`${schema.users.deletedAt} IS NULL`
                    )
                )
                .limit(1);

            const user = users[0];

            if (!user || !user.passwordHash) {
                await this.logAuthAttempt(credentials.email, 'login', false, request);
                throw new SecurityError(
                    SecurityErrorType.UNAUTHORIZED,
                    'Invalid email or password',
                    401
                );
            }

            // Verify password
            const passwordValid = await this.passwordService.verify(
                credentials.password,
                user.passwordHash
            );

            if (!passwordValid) {
                await this.logAuthAttempt(credentials.email, 'login', false, request);
                throw new SecurityError(
                    SecurityErrorType.UNAUTHORIZED,
                    'Invalid email or password',
                    401
                );
            }

            // Create session
            const { accessToken, session } = await this.sessionService.createSession(
                user.id,
                request
            );

            // Log successful attempt
            await this.logAuthAttempt(credentials.email, 'login', true, request);

            logger.info('User logged in', { userId: user.id, email: user.email });

            return {
                user: mapUserResponse(user),
                accessToken,
                sessionId: session.sessionId,
                expiresAt: session.expiresAt,
            };
        } catch (error) {
            if (error instanceof SecurityError) {
                throw error;
            }

            logger.error('Login error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'Login failed',
                500
            );
        }
    }

    /**
     * Logout
     */
    async logout(sessionId: string): Promise<void> {
        try {
            await this.sessionService.revokeSessionId(sessionId);
            logger.info('User logged out', { sessionId });
        } catch (error) {
            logger.error('Logout error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'Logout failed',
                500
            );
        }
    }

    async getOauthProvider(provider: OAuthProvider, request: Request): Promise<BaseOAuthProvider> {
        const url = new URL(request.url).origin;

        switch (provider) {
            case 'google':
                return GoogleOAuthProvider.create(this.env, url);
            case 'github':
                return GitHubOAuthProvider.create(this.env, url);
            default:
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    `OAuth provider ${provider} not configured`,
                    400
                );
        }
    }

    /**
     * Get OAuth authorization URL
     */
    async getOAuthAuthorizationUrl(
        provider: OAuthProvider,
        request: Request,
        intendedRedirectUrl?: string
    ): Promise<string> {
        const oauthProvider = await this.getOauthProvider(provider, request);
        if (!oauthProvider) {
            throw new SecurityError(
                SecurityErrorType.INVALID_INPUT,
                `OAuth provider ${provider} not configured`,
                400
            );
        }

        // Clean up expired OAuth states first
        await this.cleanupExpiredOAuthStates();

        // Validate and sanitize intended redirect URL
        let validatedRedirectUrl: string | null = null;
        if (intendedRedirectUrl) {
            validatedRedirectUrl = this.validateRedirectUrl(intendedRedirectUrl, request);
        }

        // Generate state for CSRF protection
        const state = generateSecureToken();

        // Generate PKCE code verifier
        const codeVerifier = BaseOAuthProvider.generateCodeVerifier();

        // Store OAuth state with intended redirect URL
        await this.database.insert(schema.oauthStates).values({
            id: generateId(),
            state,
            provider,
            codeVerifier,
            redirectUri: validatedRedirectUrl || oauthProvider['redirectUri'],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 600000), // 10 minutes
            isUsed: false,
            scopes: [],
            userId: null,
            nonce: null
        });

        // Get authorization URL
        const authUrl = await oauthProvider.getAuthorizationUrl(state, codeVerifier);

        logger.info('OAuth authorization initiated', { provider });

        return authUrl;
    }

    /**
     * Clean up expired OAuth states
     */
    private async cleanupExpiredOAuthStates(): Promise<void> {
        try {
            const now = new Date();
            await this.database
                .delete(schema.oauthStates)
                .where(
                    or(
                        lt(schema.oauthStates.expiresAt, now),
                        eq(schema.oauthStates.isUsed, true)
                    )
                );

            logger.debug('Cleaned up expired OAuth states');
        } catch (error) {
            logger.error('Error cleaning up OAuth states', error);
        }
    }

    /**
     * Handle OAuth callback
     */
    async handleOAuthCallback(
        provider: OAuthProvider,
        code: string,
        state: string,
        request: Request
    ): Promise<AuthResult> {
        try {
            const oauthProvider = await this.getOauthProvider(provider, request);
            if (!oauthProvider) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    `OAuth provider ${provider} not configured`,
                    400
                );
            }

            // Verify state
            const now = new Date();
            const oauthStates = await this.database
                .select()
                .from(schema.oauthStates)
                .where(
                    and(
                        eq(schema.oauthStates.state, state),
                        eq(schema.oauthStates.provider, provider),
                        eq(schema.oauthStates.isUsed, false)
                    )
                )
                .limit(1);

            const oauthState = oauthStates[0];

            if (!oauthState || new Date(oauthState.expiresAt) < now) {
                throw new SecurityError(
                    SecurityErrorType.CSRF_VIOLATION,
                    'Invalid or expired OAuth state',
                    400
                );
            }

            // Mark state as used
            await this.database
                .update(schema.oauthStates)
                .set({ isUsed: true })
                .where(eq(schema.oauthStates.id, oauthState.id));

            // Exchange code for tokens
            const tokens = await oauthProvider.exchangeCodeForTokens(
                code,
                oauthState.codeVerifier || undefined
            );

            // Get user info
            const oauthUserInfo = await oauthProvider.getUserInfo(tokens.accessToken);

            // Find or create user
            const user = await this.findOrCreateOAuthUser(provider, oauthUserInfo);

            // Create session
            const { accessToken: sessionAccessToken, session } = await this.sessionService.createSession(
                user.id,
                request
            );

            // Log auth attempt
            await this.logAuthAttempt(user.email, `oauth_${provider}`, true, request);

            logger.info('OAuth login successful', { userId: user.id, provider });

            return {
                user: mapUserResponse(user),
                accessToken: sessionAccessToken,
                sessionId: session.sessionId,
                expiresAt: session.expiresAt,
                redirectUrl: oauthState.redirectUri || undefined
            };
        } catch (error) {
            await this.logAuthAttempt('', `oauth_${provider}`, false, request);

            if (error instanceof SecurityError) {
                throw error;
            }

            logger.error('OAuth callback error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'OAuth authentication failed',
                500
            );
        }
    }

    /**
     * Find or create OAuth user
     */
    private async findOrCreateOAuthUser(
        provider: OAuthProvider,
        oauthUserInfo: OAuthUserInfo
    ): Promise<schema.User> {
        // Check if user exists with this email
        let existingUsers = await this.database
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, oauthUserInfo.email.toLowerCase()))
            .limit(1);

        let user = existingUsers[0];

        if (!user) {
            // Create new user
            const userId = generateId();
            const now = new Date();

            await this.database.insert(schema.users).values({
                id: userId,
                email: oauthUserInfo.email.toLowerCase(),
                displayName: oauthUserInfo.name || oauthUserInfo.email.split('@')[0],
                avatarUrl: oauthUserInfo.picture,
                emailVerified: oauthUserInfo.emailVerified || false,
                provider: provider,
                providerId: oauthUserInfo.id,
                createdAt: now,
                updatedAt: now
            });

            const newUsers = await this.database
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, userId))
                .limit(1);

            user = newUsers[0];
        } else {
            // Always update OAuth info and user data on login
            await this.database
                .update(schema.users)
                .set({
                    displayName: oauthUserInfo.name || user.displayName,
                    avatarUrl: oauthUserInfo.picture || user.avatarUrl,
                    provider: provider,
                    providerId: oauthUserInfo.id,
                    emailVerified: oauthUserInfo.emailVerified || user.emailVerified,
                    updatedAt: new Date()
                })
                .where(eq(schema.users.id, user.id));

            // Refresh user data after updates
            const updatedUsers = await this.database
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, user.id))
                .limit(1);

            user = updatedUsers[0];
        }

        return user!;
    }

    /**
     * Log authentication attempt
     */
    private async logAuthAttempt(
        identifier: string,
        attemptType: string,
        success: boolean,
        request?: Request
    ): Promise<void> {
        try {
            // Skip logging if no request provided (e.g., Express request adapter issues)
            if (!request) {
                return;
            }

            // Extract request metadata with graceful fallback
            let requestMetadata;
            try {
                requestMetadata = extractRequestMetadata(request);
            } catch (extractError) {
                // Use default metadata if extraction fails
                logger.debug('Request metadata extraction failed, using defaults', extractError);
                requestMetadata = {
                    ipAddress: 'unknown',
                    userAgent: 'unknown'
                };
            }

            const normalizedIp =
                requestMetadata.ipAddress &&
                requestMetadata.ipAddress !== 'unknown'
                    ? requestMetadata.ipAddress
                    : 'unknown';
            const normalizedUserAgent =
                requestMetadata.userAgent &&
                requestMetadata.userAgent !== 'unknown'
                    ? requestMetadata.userAgent
                    : null;

            await this.database.insert(schema.authAttempts).values({
                identifier: identifier.toLowerCase(),
                attemptType: attemptType as 'login' | 'register' | 'oauth_google' | 'oauth_github' | 'refresh' | 'reset_password',
                success: success,
                ipAddress: normalizedIp,
                userAgent: normalizedUserAgent,
            });
        } catch (error) {
            logger.debug('Failed to log auth attempt (non-critical)', error);
        }
    }

    /**
     * Validate and sanitize redirect URL to prevent open redirect attacks
     */
    private validateRedirectUrl(redirectUrl: string, request: Request): string | null {
        try {
            const requestUrl = new URL(request.url);

            // Handle relative URLs by constructing absolute URL with same origin
            const redirectUrlObj = redirectUrl.startsWith('/')
                ? new URL(redirectUrl, requestUrl.origin)
                : new URL(redirectUrl);

            // Only allow same-origin redirects for security
            if (redirectUrlObj.origin !== requestUrl.origin) {
                logger.warn('OAuth redirect URL rejected: different origin', {
                    redirectUrl: redirectUrl,
                    requestOrigin: requestUrl.origin,
                    redirectOrigin: redirectUrlObj.origin
                });
                return null;
            }

            // Prevent redirecting to authentication endpoints to avoid loops
            const authPaths = ['/api/auth/', '/logout'];
            if (authPaths.some(path => redirectUrlObj.pathname.startsWith(path))) {
                logger.warn('OAuth redirect URL rejected: auth endpoint', {
                    redirectUrl: redirectUrl,
                    pathname: redirectUrlObj.pathname
                });
                return null;
            }

            return redirectUrl;
        } catch (error) {
            logger.warn('Invalid OAuth redirect URL format', { redirectUrl, error });
            return null;
        }
    }
}
