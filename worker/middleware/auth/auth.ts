/**
 * Authentication Middleware
 * Handles JWT validation and session management
 */

import type { Env } from '../../types/env';
import { AuthUserSession } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { extractToken } from '../../utils/authUtils';
import { AuthService } from '../../database/services/AuthService';
import { SessionService } from '../../database/services/SessionService';
import { createDatabaseService } from '../../database/database';

const logger = createLogger('AuthMiddleware');

/**
 * Validate JWT token and return user
 */
export async function validateToken(
    token: string,
    env: Env
): Promise<AuthUserSession | null> {
    try {
        // Create database service and auth service
        const databaseService = createDatabaseService(env);
        const authService = new AuthService(env);
        const sessionService = new SessionService(env);

        // Validate token and get session
        const session = await sessionService.validateSession(token);
        if (!session) {
            return null;
        }

        // Get user from session
        const user = await authService.getUserById(session.userId);
        if (!user) {
            return null;
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            sessionId: session.id
        };
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
        // Extract token
        const token = extractToken(request);
        
        if (token) {
            const userResponse = await validateToken(token, env);
            if (userResponse) {
                logger.debug('User authenticated', { userId: userResponse.user.id });
                return userResponse;
            }
        }
        
        logger.debug('No authentication found');
        return null;
    } catch (error) {
        logger.error('Auth middleware error', error);
        return null;
    }
}