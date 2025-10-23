import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { SecretsService } from '../../../database/services/SecretsService';
import { ModelProvidersService } from '../../../database/services/ModelProvidersService';
import { createDatabaseService } from '../../../database/database';
import { z } from 'zod';
import {
    ModelProvidersListData,
    ModelProviderData,
    ModelProviderCreateData,
    ModelProviderUpdateData,
    ModelProviderDeleteData,
    ModelProviderTestData,
    ModelProviderTestResultData
} from './types';
import { createLogger } from '../../../logger';

export class ModelProvidersController extends BaseController {
    static logger = createLogger('ModelProvidersController');

    static async getModelProviders(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProvidersListData>>> {
        try {
            const user = context.user!;

            const modelProvidersService = new ModelProvidersService(env);
            const providers = await modelProvidersService.getUserModelProviders(user.id);

            const responseData: ModelProvidersListData = {
                providers: providers.map(provider => ({
                    id: provider.id,
                    name: provider.name,
                    provider: provider.provider,
                    baseUrl: provider.baseUrl,
                    apiKey: provider.apiKey,
                    models: provider.models,
                    isActive: provider.isActive,
                    createdAt: provider.createdAt,
                    updatedAt: provider.updatedAt
                }))
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching model providers:', error);
            return ModelProvidersController.createErrorResponse<ModelProvidersListData>('Failed to fetch model providers', 500);
        }
    }

    static async getModelProvider(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderData>>> {
        try {
            const user = context.user!;

            const providerId = context.pathParams.id;
            if (!providerId) {
                return ModelProvidersController.createErrorResponse<ModelProviderData>('Provider ID is required', 400);
            }

            const modelProvidersService = new ModelProvidersService(env);
            const provider = await modelProvidersService.getUserModelProvider(user.id, providerId);

            if (!provider) {
                return ModelProvidersController.createErrorResponse<ModelProviderData>('Model provider not found', 404);
            }

            const responseData: ModelProviderData = {
                provider: {
                    id: provider.id,
                    name: provider.name,
                    provider: provider.provider,
                    baseUrl: provider.baseUrl,
                    apiKey: provider.apiKey,
                    models: provider.models,
                    isActive: provider.isActive,
                    createdAt: provider.createdAt,
                    updatedAt: provider.updatedAt
                }
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching model provider:', error);
            return ModelProvidersController.createErrorResponse<ModelProviderData>('Failed to fetch model provider', 500);
        }
    }

    static async createModelProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderCreateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelProvidersController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelProviderCreateData>>;
            }

            const { name, provider, baseUrl, apiKey, models } = bodyResult.data as { 
                name?: string; 
                provider?: string; 
                baseUrl?: string; 
                apiKey?: string; 
                models?: string[]; 
            };

            if (!name || !provider || !baseUrl || !apiKey || !models) {
                return ModelProvidersController.createErrorResponse<ModelProviderCreateData>('Name, provider, baseUrl, apiKey, and models are required', 400);
            }

            const modelProvidersService = new ModelProvidersService(env);
            const result = await modelProvidersService.createUserModelProvider(user.id, {
                name,
                provider,
                baseUrl,
                apiKey,
                models
            });

            if (!result.success) {
                return ModelProvidersController.createErrorResponse<ModelProviderCreateData>(result.error || 'Failed to create model provider', 500);
            }

            const responseData: ModelProviderCreateData = {
                provider: {
                    id: result.provider!.id,
                    name: result.provider!.name,
                    provider: result.provider!.provider,
                    baseUrl: result.provider!.baseUrl,
                    apiKey: result.provider!.apiKey,
                    models: result.provider!.models,
                    isActive: result.provider!.isActive,
                    createdAt: result.provider!.createdAt,
                    updatedAt: result.provider!.updatedAt
                },
                message: 'Model provider created successfully'
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error creating model provider:', error);
            return ModelProvidersController.createErrorResponse<ModelProviderCreateData>('Failed to create model provider', 500);
        }
    }

    static async updateModelProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderUpdateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelProvidersController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelProviderUpdateData>>;
            }

            const { id, name, provider, baseUrl, apiKey, models, isActive } = bodyResult.data as { 
                id?: string; 
                name?: string; 
                provider?: string; 
                baseUrl?: string; 
                apiKey?: string; 
                models?: string[]; 
                isActive?: boolean; 
            };

            if (!id || !name || !provider || !baseUrl || !apiKey || !models) {
                return ModelProvidersController.createErrorResponse<ModelProviderUpdateData>('ID, name, provider, baseUrl, apiKey, and models are required', 400);
            }

            const modelProvidersService = new ModelProvidersService(env);
            const result = await modelProvidersService.updateUserModelProvider(user.id, id, {
                name,
                provider,
                baseUrl,
                apiKey,
                models,
                isActive
            });

            if (!result.success) {
                return ModelProvidersController.createErrorResponse<ModelProviderUpdateData>(result.error || 'Failed to update model provider', 500);
            }

            const responseData: ModelProviderUpdateData = {
                provider: {
                    id: result.provider!.id,
                    name: result.provider!.name,
                    provider: result.provider!.provider,
                    baseUrl: result.provider!.baseUrl,
                    apiKey: result.provider!.apiKey,
                    models: result.provider!.models,
                    isActive: result.provider!.isActive,
                    createdAt: result.provider!.createdAt,
                    updatedAt: result.provider!.updatedAt
                },
                message: 'Model provider updated successfully'
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating model provider:', error);
            return ModelProvidersController.createErrorResponse<ModelProviderUpdateData>('Failed to update model provider', 500);
        }
    }

    static async deleteModelProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderDeleteData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelProvidersController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelProviderDeleteData>>;
            }

            const { id } = bodyResult.data as { id?: string };

            if (!id) {
                return ModelProvidersController.createErrorResponse<ModelProviderDeleteData>('Provider ID is required', 400);
            }

            const modelProvidersService = new ModelProvidersService(env);
            const result = await modelProvidersService.deleteUserModelProvider(user.id, id);

            if (!result.success) {
                return ModelProvidersController.createErrorResponse<ModelProviderDeleteData>(result.error || 'Failed to delete model provider', 500);
            }

            const responseData: ModelProviderDeleteData = {
                success: true,
                message: 'Model provider deleted successfully'
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting model provider:', error);
            return ModelProvidersController.createErrorResponse<ModelProviderDeleteData>('Failed to delete model provider', 500);
        }
    }

    static async testModelProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderTestResultData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelProvidersController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelProviderTestResultData>>;
            }

            const { id, testPrompt } = bodyResult.data as { 
                id?: string; 
                testPrompt?: string; 
            };

            if (!id || !testPrompt) {
                return ModelProvidersController.createErrorResponse<ModelProviderTestResultData>('Provider ID and test prompt are required', 400);
            }

            const modelProvidersService = new ModelProvidersService(env);
            const result = await modelProvidersService.testModelProvider(user.id, id, testPrompt);

            if (!result.success) {
                return ModelProvidersController.createErrorResponse<ModelProviderTestResultData>(result.error || 'Model provider test failed', 500);
            }

            const responseData: ModelProviderTestResultData = {
                providerId: id,
                testPrompt,
                result: result.result!,
                timestamp: result.timestamp!
            };

            return ModelProvidersController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error testing model provider:', error);
            return ModelProvidersController.createErrorResponse<ModelProviderTestResultData>('Failed to test model provider', 500);
        }
    }
}