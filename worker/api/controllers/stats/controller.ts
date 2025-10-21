// Temporarily disabled due to database service issues
/*
import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { UserStatsData, UserActivityData } from './types';
import { AnalyticsService } from '../../../database/services/AnalyticsService';
import { createLogger } from '../../../logger';

export class StatsController extends BaseController {
    static logger = createLogger('StatsController');
    
    static async getUserStats(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UserStatsData>>> {
        try {
            const user = context.user!;

            const analyticsService = new AnalyticsService(env);
            const stats = await analyticsService.getUserStats(user.id);

            const responseData: UserStatsData = {
                totalApps: stats.totalApps,
                totalGenerations: stats.totalGenerations,
                totalViews: stats.totalViews,
                totalStars: stats.totalStars,
                averageRating: stats.averageRating,
                lastActivity: stats.lastActivity
            };

            return StatsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user stats:', error);
            return StatsController.createErrorResponse<UserStatsData>('Failed to fetch user statistics', 500);
        }
    }

    static async getUserActivity(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UserActivityData>>> {
        try {
            const user = context.user!;

            const analyticsService = new AnalyticsService(env);
            const activity = await analyticsService.getUserActivity(user.id);

            const responseData: UserActivityData = {
                activities: activity.map(act => ({
                    id: act.id,
                    type: act.type,
                    description: act.description,
                    timestamp: act.timestamp,
                    metadata: act.metadata
                }))
            };

            return StatsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user activity:', error);
            return StatsController.createErrorResponse<UserActivityData>('Failed to fetch user activity', 500);
        }
    }
}
*/

// Temporary placeholder to prevent import errors
import type { RouteContext } from '../../types/route-context';

export class StatsController {
    static async getUserStats(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getUserActivity(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
}