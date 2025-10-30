/**
 * Authentication Middleware
 * Handles JWT validation and session management
 */

import { AuthUserSession } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { AuthService } from '../../database/services/AuthService';
import { extractToken } from '../../utils/authUtils';

const logger = createLogger('AuthMiddleware');
/**
 * Validate JWT token and return user
 */
export async function validateToken(
    token: string,
    env: Env
): Promise<AuthUserSession | null> {
    try {
        // Use AuthService for token validation and user retrieval
        const authService = new AuthService(env);
        return authService.validateTokenAndGetUser(token, env);
    } catch (error) {
        logger.error('Token validation error', error);
        return null;
    }
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
    request: Request,
    env: Env
): Promise<AuthUserSession | null> {
    try {
        // First try JWT token authentication
        const token = extractToken(request);

        if (token) {
            const userResponse = await validateToken(token, env);
            if (userResponse) {
                logger.debug('User authenticated via JWT', { userId: userResponse.user.id });
                return userResponse;
            }
        }

        // Fallback to session-based authentication for stub development
        // This mimics what the AuthController stub does for development
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader && cookieHeader.includes('session=')) {
            // Extract session ID from cookie created by the stub auth controller
            const sessionMatch = cookieHeader.match(/session=([^;]+)/);
            const sessionId = sessionMatch ? sessionMatch[1] : null;

            if (sessionId && sessionId.startsWith('session-')) {
                // Mock user that matches what the stub creates
                const userId = sessionId.replace('session-', '');
                const mockUser = {
                    id: userId,
                    email: `user-${userId}@example.com`,
                    displayName: `User ${userId}`,
                    username: userId.replace('user-', ''),
                    avatarUrl: undefined,
                    bio: undefined,
                    timezone: undefined,
                    provider: 'email' as const,
                    emailVerified: true as const,
                    createdAt: new Date()
                };

                logger.debug('User authenticated via session cookie (stub)', { sessionId, userId: mockUser.id });
                return {
                    user: mockUser,
                    sessionId: sessionId
                };
            }
        }

        logger.debug('No authentication found');
        return null;
    } catch (error) {
        logger.error('Auth middleware error', error);
        return null;
    }
}
