// Temporarily disabled due to database service issues
/*
import { AuthService } from '../../../database/services/AuthService';
import { SessionService } from '../../../database/services/SessionService';
import { UserService } from '../../../database/services/UserService';
import { ApiKeyService } from '../../../database/services/ApiKeyService';
import { generateApiKey } from '../../../utils/cryptoUtils';
import { 
    loginSchema, 
    registerSchema, 
    passwordResetRequestSchema,
    passwordResetSchema,
    changePasswordSchema,
    updateProfileSchema,
    deleteAccountSchema
} from './schemas';
import { BaseController } from '../baseController';
import { ApiResponse, ControllerResponse } from '../types';
import { RouteContext } from '../../types/route-context';
import { createLogger } from '../../../logger';
import { 
    LoginData, 
    RegisterData, 
    PasswordResetRequestData,
    PasswordResetData,
    ChangePasswordData,
    UpdateProfileData,
    DeleteAccountData,
    LogoutData
} from './types';

export class AuthController extends BaseController {
    static logger = createLogger('AuthController');

    static async register(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<RegisterData>>> {
        try {
            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<RegisterData>>;
            }

            const validationResult = registerSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<RegisterData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { email, password, name } = validationResult.data;

            const authService = new AuthService(env);
            const result = await authService.registerUser({
                email,
                password,
                name,
                accessTokenExpiry: SessionService.config.sessionTTL
            });

            if (!result.success) {
                const statusCode = result.error === 'User already exists' ? 409 : 500;
                return AuthController.createErrorResponse<RegisterData>(result.error || 'Registration failed', statusCode);
            }

            const responseData: RegisterData = {
                user: result.user!,
                accessToken: result.accessToken!,
                refreshToken: result.refreshToken!,
                accessTokenExpiry: SessionService.config.sessionTTL
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Registration error:', error);
            return AuthController.createErrorResponse<RegisterData>('Internal server error', 500);
        }
    }

    static async login(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<LoginData>>> {
        try {
            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<LoginData>>;
            }

            const validationResult = loginSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<LoginData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { email, password } = validationResult.data;

            const authService = new AuthService(env);
            const result = await authService.authenticateUser({
                email,
                password,
                accessTokenExpiry: SessionService.config.sessionTTL
            });

            if (!result.success) {
                const statusCode = result.error === 'Invalid credentials' ? 401 : 500;
                return AuthController.createErrorResponse<LoginData>(result.error || 'Login failed', statusCode);
            }

            const responseData: LoginData = {
                user: result.user!,
                accessToken: result.accessToken!,
                refreshToken: result.refreshToken!,
                accessTokenExpiry: SessionService.config.sessionTTL
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Login error:', error);
            return AuthController.createErrorResponse<LoginData>('Internal server error', 500);
        }
    }

    static async refreshToken(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<LoginData>>> {
        try {
            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<LoginData>>;
            }

            const { refreshToken } = bodyResult.data as { refreshToken?: string };
            if (!refreshToken) {
                return AuthController.createErrorResponse<LoginData>('Refresh token is required', 400);
            }

            const sessionService = new SessionService(env);
            const result = await sessionService.refreshAccessToken(refreshToken);

            if (!result.success) {
                const statusCode = result.error === 'Invalid refresh token' ? 401 : 500;
                return AuthController.createErrorResponse<LoginData>(result.error || 'Token refresh failed', statusCode);
            }

            const responseData: LoginData = {
                user: result.user!,
                accessToken: result.accessToken!,
                refreshToken: result.refreshToken!,
                accessTokenExpiry: SessionService.config.sessionTTL
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Token refresh error:', error);
            return AuthController.createErrorResponse<LoginData>('Internal server error', 500);
        }
    }

    static async getProfile(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UpdateProfileData>>> {
        try {
            const user = context.user!;

            const userService = new UserService(env);
            const userProfile = await userService.getUserProfile(user.id);

            if (!userProfile) {
                return AuthController.createErrorResponse<UpdateProfileData>('User not found', 404);
            }

            const responseData: UpdateProfileData = {
                user: userProfile
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get profile error:', error);
            return AuthController.createErrorResponse<UpdateProfileData>('Internal server error', 500);
        }
    }

    static async updateProfile(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UpdateProfileData>>> {
        try {
            const user = context.user!;

            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<UpdateProfileData>>;
            }

            const validationResult = updateProfileSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<UpdateProfileData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { name, email } = validationResult.data;

            const authService = new AuthService(env);
            const result = await authService.updateUserProfile(user.id, { name, email });

            if (!result.success) {
                const statusCode = result.error === 'User not found' ? 404 : 
                                 result.error === 'Email already exists' ? 409 : 500;
                return AuthController.createErrorResponse<UpdateProfileData>(result.error || 'Profile update failed', statusCode);
            }

            const responseData: UpdateProfileData = {
                user: result.user!
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Update profile error:', error);
            return AuthController.createErrorResponse<UpdateProfileData>('Internal server error', 500);
        }
    }

    static async changePassword(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ChangePasswordData>>> {
        try {
            const user = context.user!;

            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ChangePasswordData>>;
            }

            const validationResult = changePasswordSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<ChangePasswordData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { currentPassword, newPassword } = validationResult.data;

            const authService = new AuthService(env);
            const result = await authService.changePassword(user.id, currentPassword, newPassword);

            if (!result.success) {
                const statusCode = result.error === 'Invalid current password' ? 401 : 
                                 result.error === 'User not found' ? 404 : 500;
                return AuthController.createErrorResponse<ChangePasswordData>(result.error || 'Password change failed', statusCode);
            }

            const responseData: ChangePasswordData = {
                success: true,
                message: 'Password changed successfully'
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Change password error:', error);
            return AuthController.createErrorResponse<ChangePasswordData>('Internal server error', 500);
        }
    }

    static async requestPasswordReset(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<PasswordResetRequestData>>> {
        try {
            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<PasswordResetRequestData>>;
            }

            const validationResult = passwordResetRequestSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<PasswordResetRequestData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { email } = validationResult.data;

            const sessionService = new SessionService(env);
            const result = await sessionService.requestPasswordReset(email);

            const responseData: PasswordResetRequestData = {
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Password reset request error:', error);
            return AuthController.createErrorResponse<PasswordResetRequestData>('Internal server error', 500);
        }
    }

    static async resetPassword(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<PasswordResetData>>> {
        try {
            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<PasswordResetData>>;
            }

            const validationResult = passwordResetSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<PasswordResetData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { token, newPassword } = validationResult.data;

            const sessionService = new SessionService(env);
            const result = await sessionService.resetPassword(token, newPassword);

            if (!result.success) {
                const statusCode = result.error === 'Invalid or expired token' ? 400 : 500;
                return AuthController.createErrorResponse<PasswordResetData>(result.error || 'Password reset failed', statusCode);
            }

            const responseData: PasswordResetData = {
                success: true,
                message: 'Password reset successfully'
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Password reset error:', error);
            return AuthController.createErrorResponse<PasswordResetData>('Internal server error', 500);
        }
    }

    static async logout(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<LogoutData>>> {
        try {
            const user = context.user!;

            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<LogoutData>>;
            }

            const { refreshToken } = bodyResult.data as { refreshToken?: string };
            if (!refreshToken) {
                return AuthController.createErrorResponse<LogoutData>('Refresh token is required', 400);
            }

            const authService = new AuthService(env);
            const result = await authService.logoutUser(user.id, refreshToken);

            if (!result.success) {
                return AuthController.createErrorResponse<LogoutData>(result.error || 'Logout failed', 500);
            }

            const responseData: LogoutData = {
                success: true,
                message: 'Logged out successfully',
                accessTokenExpiry: SessionService.config.sessionTTL
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Logout error:', error);
            return AuthController.createErrorResponse<LogoutData>('Internal server error', 500);
        }
    }

    static async deleteAccount(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<DeleteAccountData>>> {
        try {
            const user = context.user!;

            const bodyResult = await AuthController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<DeleteAccountData>>;
            }

            const validationResult = deleteAccountSchema.safeParse(bodyResult.data);
            if (!validationResult.success) {
                return AuthController.createErrorResponse<DeleteAccountData>(
                    `Validation error: ${validationResult.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { password } = validationResult.data;

            const authService = new AuthService(env);
            const result = await authService.deleteUserAccount(user.id, password);

            if (!result.success) {
                const statusCode = result.error === 'Invalid password' ? 401 : 
                                 result.error === 'User not found' ? 404 : 500;
                return AuthController.createErrorResponse<DeleteAccountData>(result.error || 'Account deletion failed', statusCode);
            }

            const responseData: DeleteAccountData = {
                success: true,
                message: 'Account deleted successfully'
            };

            return AuthController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Delete account error:', error);
            return AuthController.createErrorResponse<DeleteAccountData>('Internal server error', 500);
        }
    }
}
*/

// Temporary placeholder to prevent import errors
import type { RouteContext } from '../../types/route-context';

export class AuthController {
    static async register(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async login(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async refreshToken(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getProfile(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async updateProfile(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async changePassword(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async requestPasswordReset(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async resetPassword(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async logout(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async deleteAccount(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getCsrfToken(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getAuthProviders(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async verifyEmail(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async resendVerificationOtp(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async checkAuth(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getActiveSessions(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async revokeSession(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async initiateOAuth(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async handleOAuthCallback(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
}