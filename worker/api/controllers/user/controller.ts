import { BaseController } from '../baseController';
import { ApiResponse, ControllerResponse } from '../types';
import { RouteContext } from '../../types/route-context';
import { UserService } from '../../../database/services/UserService';
import { AppService } from '../../../database/services/AppService';
import { createDatabaseService } from '../../../database/database';
import { Visibility, AppSortOption, SortOrder, TimePeriod } from '../../../database/types';
import { UserAppsData, ProfileUpdateData } from './types';
import { createLogger } from '../../../logger';

const logger = createLogger('UserController');

export class UserController extends BaseController {
    static logger = logger;

    static async getUserApps(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UserAppsData>>> {
        try {
            const user = context.user!;
            const url = new URL(request.url);
            
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
            const page = parseInt(url.searchParams.get('page') || '1');
            const offset = (page - 1) * limit;
            const sort = (url.searchParams.get('sort') || 'recent') as AppSortOption;
            const order = (url.searchParams.get('order') || 'desc') as SortOrder;
            const period = (url.searchParams.get('period') || 'all') as TimePeriod;
            const visibility = (url.searchParams.get('visibility') || 'all') as Visibility;
            const framework = url.searchParams.get('framework') || undefined;
            const search = url.searchParams.get('search') || undefined;
            
            const appService = new AppService(env);
            const result = await appService.getUserApps({
                userId: user.id,
                limit,
                offset,
                sort,
                order,
                period,
                visibility,
                framework,
                search
            });
            
            const responseData: UserAppsData = {
                apps: result.data.map(app => ({
                    id: app.id,
                    title: app.title,
                    description: app.description,
                    framework: app.framework,
                    visibility: app.visibility,
                    status: app.status,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt,
                    viewCount: app.viewCount,
                    starCount: app.starCount,
                    deploymentId: app.deploymentId,
                    githubUrl: app.githubUrl
                })),
                pagination: result.pagination
            };
            
            return UserController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user apps:', error);
            return UserController.createErrorResponse<UserAppsData>('Failed to fetch user apps', 500);
        }
    }

    static async updateProfile(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ProfileUpdateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await UserController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ProfileUpdateData>>;
            }

            const { name, email, bio, avatar } = bodyResult.data as { 
                name?: string; 
                email?: string; 
                bio?: string; 
                avatar?: string; 
            };

            const userService = new UserService(env);
            const result = await userService.updateUserProfile(user.id, {
                name,
                email,
                bio,
                avatar
            });

            if (!result.success) {
                const statusCode = result.error === 'User not found' ? 404 : 
                                 result.error === 'Email already exists' ? 409 : 500;
                return UserController.createErrorResponse<ProfileUpdateData>(result.error || 'Profile update failed', statusCode);
            }

            const responseData: ProfileUpdateData = {
                user: {
                    id: result.user!.id,
                    name: result.user!.name,
                    email: result.user!.email,
                    bio: result.user!.bio,
                    avatar: result.user!.avatar,
                    createdAt: result.user!.createdAt,
                    updatedAt: result.user!.updatedAt
                },
                message: 'Profile updated successfully'
            };

            return UserController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating profile:', error);
            return UserController.createErrorResponse<ProfileUpdateData>('Failed to update profile', 500);
        }
    }
}