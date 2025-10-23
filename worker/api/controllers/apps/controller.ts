// Full Apps Controller with Database Integration
// Provides complete app management functionality with PostgreSQL backend

import { BaseController } from '../baseController';
import { ApiResponse, ControllerResponse } from '../types';
import { RouteContext } from '../../types/route-context';
import { createLogger } from '../../../logger';
import { AppService } from '../../../database/services/AppService';
import { createDatabaseService } from '../../../database/database';

export class AppController extends BaseController {
    static logger = createLogger('AppController');

    static async getUserApps(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Get user's apps from database
            const apps = await appService.getUserApps(userId);

            const responseData = {
                success: true,
                apps: apps
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get user apps error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async getRecentApps(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Get recent apps from database
            const apps = await appService.getRecentApps(userId);

            const responseData = {
                success: true,
                apps: apps
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get recent apps error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async getFavoriteApps(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Get favorite apps from database
            const apps = await appService.getFavoriteApps(userId);

            const responseData = {
                success: true,
                apps: apps
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get favorite apps error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async toggleFavorite(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            const bodyResult = await AppController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<any>>;
            }

            const { appId } = bodyResult.data as { appId: string };

            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Toggle favorite status
            const result = await appService.toggleFavorite(userId, appId);

            const responseData = {
                success: true,
                isFavorite: result.isFavorite,
                message: result.isFavorite ? 'Added to favorites' : 'Removed from favorites'
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Toggle favorite error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async getPublicApps(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get public apps from database
            const apps = await appService.getPublicApps();

            const responseData = {
                success: true,
                apps: apps
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get public apps error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async getApp(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            const url = new URL(request.url);
            const appId = url.searchParams.get('id');

            if (!appId) {
                return AppController.createErrorResponse('App ID is required', 400);
            }

            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get app from database
            const app = await appService.getApp(appId);

            if (!app) {
                return AppController.createErrorResponse('App not found', 404);
            }

            const responseData = {
                success: true,
                app: app
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Get app error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async updateAppVisibility(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            const bodyResult = await AppController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<any>>;
            }

            const { appId, visibility } = bodyResult.data as { appId: string; visibility: string };

            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Update app visibility
            await appService.updateAppVisibility(appId, userId, visibility);

            const responseData = {
                success: true,
                message: 'App visibility updated successfully'
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Update app visibility error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }

    static async deleteApp(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<any>>> {
        try {
            const bodyResult = await AppController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<any>>;
            }

            const { appId } = bodyResult.data as { appId: string };

            // Create database service and app service
            const databaseService = createDatabaseService(env);
            const appService = new AppService(env);

            // Get user from session
            const userId = context.user?.id;
            if (!userId) {
                return AppController.createErrorResponse('User not authenticated', 401);
            }

            // Delete app
            await appService.deleteApp(appId, userId);

            const responseData = {
                success: true,
                message: 'App deleted successfully'
            };

            return AppController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Delete app error:', error);
            return AppController.createErrorResponse('Internal server error', 500);
        }
    }
}