// Temporarily disabled due to database service issues
/*
import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import { createLogger } from '../../logger';
import { generateApiKey } from '../../utils/cryptoUtils';

const logger = createLogger('SessionService');

export interface Session {
    id: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    ipAddress: string;
    userAgent: string;
}

export interface NewSession {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress: string;
    userAgent: string;
}

export interface PasswordResetToken {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    isUsed: boolean;
}

export interface NewPasswordResetToken {
    userId: string;
    token: string;
    expiresAt: Date;
}

export class SessionService extends BaseService {
    static config = {
        sessionTTL: 24 * 60 * 60 * 1000, // 24 hours
        refreshTokenTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
        passwordResetTTL: 60 * 60 * 1000, // 1 hour
    };

    constructor(env: Env) {
        super(env);
    }

    async createSession(data: NewSession): Promise<{ success: boolean; session?: Session; error?: string }> {
        try {
            const id = generateId();
            const now = new Date();

            const result = await this.db.insert(schema.sessions).values({
                id,
                userId: data.userId,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresAt: data.expiresAt,
                createdAt: now,
                updatedAt: now,
                isActive: true,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            }).returning();

            logger.info('Session created successfully', { id, userId: data.userId });

            return {
                success: true,
                session: result[0] as Session
            };
        } catch (error) {
            logger.error('Error creating session:', error);
            return {
                success: false,
                error: 'Failed to create session'
            };
        }
    }

    async getSessionByAccessToken(accessToken: string): Promise<Session | null> {
        try {
            const result = await this.db
                .select()
                .from(schema.sessions)
                .where(and(
                    eq(schema.sessions.accessToken, accessToken),
                    eq(schema.sessions.isActive, true),
                    sql`${schema.sessions.expiresAt} > NOW()`
                ))
                .limit(1);

            return result[0] as Session || null;
        } catch (error) {
            logger.error('Error fetching session by access token:', error);
            return null;
        }
    }

    async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
        try {
            const result = await this.db
                .select()
                .from(schema.sessions)
                .where(and(
                    eq(schema.sessions.refreshToken, refreshToken),
                    eq(schema.sessions.isActive, true)
                ))
                .limit(1);

            return result[0] as Session || null;
        } catch (error) {
            logger.error('Error fetching session by refresh token:', error);
            return null;
        }
    }

    async refreshAccessToken(refreshToken: string): Promise<{ success: boolean; user?: any; accessToken?: string; refreshToken?: string; error?: string }> {
        try {
            const session = await this.getSessionByRefreshToken(refreshToken);
            if (!session) {
                return {
                    success: false,
                    error: 'Invalid refresh token'
                };
            }

            // Generate new access token
            const newAccessToken = generateApiKey();
            const newExpiresAt = new Date(Date.now() + SessionService.config.sessionTTL);

            // Update session
            await this.db
                .update(schema.sessions)
                .set({
                    accessToken: newAccessToken,
                    expiresAt: newExpiresAt,
                    updatedAt: new Date()
                })
                .where(eq(schema.sessions.id, session.id));

            // Get user data
            const userResult = await this.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, session.userId))
                .limit(1);

            if (userResult.length === 0) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const user = userResult[0];

            logger.info('Access token refreshed successfully', { userId: session.userId });

            return {
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar
                },
                accessToken: newAccessToken,
                refreshToken: session.refreshToken
            };
        } catch (error) {
            logger.error('Error refreshing access token:', error);
            return {
                success: false,
                error: 'Failed to refresh access token'
            };
        }
    }

    async revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.db
                .update(schema.sessions)
                .set({ isActive: false })
                .where(eq(schema.sessions.id, sessionId));

            logger.info('Session revoked successfully', { sessionId });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error revoking session:', error);
            return {
                success: false,
                error: 'Failed to revoke session'
            };
        }
    }

    async revokeAllUserSessions(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.db
                .update(schema.sessions)
                .set({ isActive: false })
                .where(eq(schema.sessions.userId, userId));

            logger.info('All user sessions revoked successfully', { userId });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error revoking all user sessions:', error);
            return {
                success: false,
                error: 'Failed to revoke all user sessions'
            };
        }
    }

    async createPasswordResetToken(data: NewPasswordResetToken): Promise<{ success: boolean; token?: PasswordResetToken; error?: string }> {
        try {
            const id = generateId();
            const now = new Date();

            const result = await this.db.insert(schema.passwordResetTokens).values({
                id,
                userId: data.userId,
                token: data.token,
                expiresAt: data.expiresAt,
                createdAt: now,
                isUsed: false
            }).returning();

            logger.info('Password reset token created successfully', { id, userId: data.userId });

            return {
                success: true,
                token: result[0] as PasswordResetToken
            };
        } catch (error) {
            logger.error('Error creating password reset token:', error);
            return {
                success: false,
                error: 'Failed to create password reset token'
            };
        }
    }

    async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
        try {
            const result = await this.db
                .select()
                .from(schema.passwordResetTokens)
                .where(and(
                    eq(schema.passwordResetTokens.token, token),
                    eq(schema.passwordResetTokens.isUsed, false),
                    sql`${schema.passwordResetTokens.expiresAt} > NOW()`
                ))
                .limit(1);

            return result[0] as PasswordResetToken || null;
        } catch (error) {
            logger.error('Error fetching password reset token:', error);
            return null;
        }
    }

    async markPasswordResetTokenAsUsed(token: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.db
                .update(schema.passwordResetTokens)
                .set({ isUsed: true })
                .where(eq(schema.passwordResetTokens.token, token));

            logger.info('Password reset token marked as used', { token });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error marking password reset token as used:', error);
            return {
                success: false,
                error: 'Failed to mark token as used'
            };
        }
    }

    async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get user by email
            const userResult = await this.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, email))
                .limit(1);

            if (userResult.length === 0) {
                // Don't reveal if user exists or not
                return {
                    success: true
                };
            }

            const user = userResult[0];

            // Generate reset token
            const resetToken = generateApiKey();
            const expiresAt = new Date(Date.now() + SessionService.config.passwordResetTTL);

            // Create password reset token
            await this.createPasswordResetToken({
                userId: user.id,
                token: resetToken,
                expiresAt
            });

            // Here you would normally send an email with the reset token
            // For now, we'll just log it
            logger.info('Password reset token generated', { 
                userId: user.id, 
                email: user.email, 
                token: resetToken 
            });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error requesting password reset:', error);
            return {
                success: false,
                error: 'Failed to request password reset'
            };
        }
    }

    async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
        try {
            const resetToken = await this.getPasswordResetToken(token);
            if (!resetToken) {
                return {
                    success: false,
                    error: 'Invalid or expired token'
                };
            }

            // Hash the new password
            const hashedPassword = await Bun.password.hash(newPassword);

            // Update user password
            await this.db
                .update(schema.users)
                .set({ 
                    password: hashedPassword,
                    updatedAt: new Date()
                })
                .where(eq(schema.users.id, resetToken.userId));

            // Mark token as used
            await this.markPasswordResetTokenAsUsed(token);

            // Revoke all user sessions
            await this.revokeAllUserSessions(resetToken.userId);

            logger.info('Password reset successfully', { userId: resetToken.userId });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error resetting password:', error);
            return {
                success: false,
                error: 'Failed to reset password'
            };
        }
    }

    async cleanupExpiredSessions(): Promise<{ success: boolean; error?: string }> {
        try {
            const now = new Date();

            await this.db
                .delete(schema.sessions)
                .where(lt(schema.sessions.expiresAt, now));

            logger.info('Expired sessions cleaned up successfully');

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error cleaning up expired sessions:', error);
            return {
                success: false,
                error: 'Failed to cleanup expired sessions'
            };
        }
    }
}
*/

// Temporary placeholder to prevent import errors
export class SessionService {
    static config = {
        sessionTTL: 24 * 60 * 60 * 1000, // 24 hours
        refreshTokenTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
        passwordResetTTL: 60 * 60 * 1000, // 1 hour
    };

    constructor(_env: Env) {}
    async createSession(_data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async getSessionByAccessToken(_accessToken: string) {
        return null;
    }
    async getSessionByRefreshToken(_refreshToken: string) {
        return null;
    }
    async refreshAccessToken(_refreshToken: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async revokeSession(_sessionId: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async revokeAllUserSessions(_userId: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async createPasswordResetToken(_data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async getPasswordResetToken(_token: string) {
        return null;
    }
    async markPasswordResetTokenAsUsed(_token: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async requestPasswordReset(_email: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async resetPassword(_token: string, _newPassword: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async cleanupExpiredSessions() {
        return { success: false, error: 'Feature temporarily disabled' };
    }
}