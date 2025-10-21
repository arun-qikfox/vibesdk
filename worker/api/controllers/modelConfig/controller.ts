// Temporarily disabled due to database service issues
/*
import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../types';
import { ModelConfigService } from '../../../database/services/ModelConfigService';
import { SecretsService } from '../../../database/services/SecretsService';
import { ModelTestService } from '../../../database/services/ModelTestService';
import { 
    AgentActionKey, 
    ModelConfig
} from '../../../agents/inferutils/config.types';
import { AGENT_CONFIG } from '../../../agents/inferutils/config';
import { createLogger } from '../../../logger';
import { 
    ModelConfigData,
    ModelConfigUpdateData,
    ModelConfigDeleteData,
    ModelTestData,
    ModelTestResultData,
    SecretData,
    SecretCreateData,
    SecretUpdateData,
    SecretDeleteData
} from './types';

export class ModelConfigController extends BaseController {
    static logger = createLogger('ModelConfigController');

    static async getModelConfigs(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigData>>> {
        try {
            const user = context.user!;

            const modelConfigService = new ModelConfigService(env);
            const userConfigs = await modelConfigService.getUserModelConfigs(user.id);

            const agents = Object.entries(AGENT_CONFIG).map(([key, config]) => ({
                key,
                name: config.name,
                description: config.description
            }));

            const userConfigsRecord: Record<string, any> = {};
            const defaultConfigs: Record<string, any> = {};

            for (const [actionKey, mergedConfig] of Object.entries(userConfigs)) {
                if (mergedConfig.isUserOverride) {
                    userConfigsRecord[actionKey] = {
                        name: mergedConfig.name,
                        max_tokens: mergedConfig.max_tokens,
                        temperature: mergedConfig.temperature,
                        reasoning_effort: mergedConfig.reasoning_effort,
                        fallbackModel: mergedConfig.fallbackModel,
                        isUserOverride: true
                    };
                }
                
                const defaultConfig = AGENT_CONFIG[actionKey as AgentActionKey];
                if (defaultConfig) {
                    defaultConfigs[actionKey] = {
                        name: defaultConfig.name,
                        max_tokens: defaultConfig.max_tokens,
                        temperature: defaultConfig.temperature,
                        reasoning_effort: defaultConfig.reasoning_effort,
                        fallbackModel: defaultConfig.fallbackModel
                    };
                }
            }

            const responseData: ModelConfigData = {
                agents,
                userConfigs: userConfigsRecord,
                defaultConfigs
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching model configs:', error);
            return ModelConfigController.createErrorResponse<ModelConfigData>('Failed to fetch model configurations', 500);
        }
    }

    static async updateModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigUpdateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelConfigUpdateData>>;
            }

            const { actionKey, config } = bodyResult.data as { 
                actionKey?: string; 
                config?: ModelConfig; 
            };

            if (!actionKey || !config) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Action key and config are required', 400);
            }

            if (!Object.keys(AGENT_CONFIG).includes(actionKey)) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Invalid action key', 400);
            }

            const modelConfigService = new ModelConfigService(env);
            const result = await modelConfigService.updateUserModelConfig(user.id, actionKey as AgentActionKey, config);

            if (!result.success) {
                return ModelConfigController.createErrorResponse<ModelConfigUpdateData>(result.error || 'Failed to update model configuration', 500);
            }

            const responseData: ModelConfigUpdateData = {
                actionKey: actionKey as AgentActionKey,
                config: result.config!,
                message: 'Model configuration updated successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating model config:', error);
            return ModelConfigController.createErrorResponse<ModelConfigUpdateData>('Failed to update model configuration', 500);
        }
    }

    static async deleteModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelConfigDeleteData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelConfigDeleteData>>;
            }

            const { actionKey } = bodyResult.data as { actionKey?: string };

            if (!actionKey) {
                return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Action key is required', 400);
            }

            if (!Object.keys(AGENT_CONFIG).includes(actionKey)) {
                return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Invalid action key', 400);
            }

            const modelConfigService = new ModelConfigService(env);
            const result = await modelConfigService.deleteUserModelConfig(user.id, actionKey as AgentActionKey);

            if (!result.success) {
                return ModelConfigController.createErrorResponse<ModelConfigDeleteData>(result.error || 'Failed to delete model configuration', 500);
            }

            const responseData: ModelConfigDeleteData = {
                actionKey: actionKey as AgentActionKey,
                message: 'Model configuration reset to default'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting model config:', error);
            return ModelConfigController.createErrorResponse<ModelConfigDeleteData>('Failed to delete model configuration', 500);
        }
    }

    static async testModelConfig(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelTestResultData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ModelTestResultData>>;
            }

            const { actionKey, config, testPrompt } = bodyResult.data as { 
                actionKey?: string; 
                config?: ModelConfig; 
                testPrompt?: string;
            };

            if (!actionKey || !config || !testPrompt) {
                return ModelConfigController.createErrorResponse<ModelTestResultData>('Action key, config, and test prompt are required', 400);
            }

            if (!Object.keys(AGENT_CONFIG).includes(actionKey)) {
                return ModelConfigController.createErrorResponse<ModelTestResultData>('Invalid action key', 400);
            }

            const modelTestService = new ModelTestService(env);
            const result = await modelTestService.testModelConfiguration(user.id, actionKey as AgentActionKey, config, testPrompt);

            if (!result.success) {
                return ModelConfigController.createErrorResponse<ModelTestResultData>(result.error || 'Model test failed', 500);
            }

            const responseData: ModelTestResultData = {
                actionKey: actionKey as AgentActionKey,
                config,
                testPrompt,
                result: result.result!,
                timestamp: result.timestamp!
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error testing model config:', error);
            return ModelConfigController.createErrorResponse<ModelTestResultData>('Failed to test model configuration', 500);
        }
    }

    static async getSecrets(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretData>>> {
        try {
            const user = context.user!;

            const secretsService = new SecretsService(env);
            const secrets = await secretsService.getUserSecrets(user.id);

            const responseData: SecretData = {
                secrets: secrets.map(secret => ({
                    id: secret.id,
                    name: secret.name,
                    provider: secret.provider,
                    createdAt: secret.createdAt,
                    updatedAt: secret.updatedAt
                }))
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching secrets:', error);
            return ModelConfigController.createErrorResponse<SecretData>('Failed to fetch secrets', 500);
        }
    }

    static async createSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretCreateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretCreateData>>;
            }

            const { name, provider, apiKey } = bodyResult.data as { 
                name?: string; 
                provider?: string; 
                apiKey?: string; 
            };

            if (!name || !provider || !apiKey) {
                return ModelConfigController.createErrorResponse<SecretCreateData>('Name, provider, and API key are required', 400);
            }

            const secretsService = new SecretsService(env);
            const result = await secretsService.createUserSecret(user.id, { name, provider, apiKey });

            if (!result.success) {
                return ModelConfigController.createErrorResponse<SecretCreateData>(result.error || 'Failed to create secret', 500);
            }

            const responseData: SecretCreateData = {
                secret: {
                    id: result.secret!.id,
                    name: result.secret!.name,
                    provider: result.secret!.provider,
                    createdAt: result.secret!.createdAt,
                    updatedAt: result.secret!.updatedAt
                },
                message: 'Secret created successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error creating secret:', error);
            return ModelConfigController.createErrorResponse<SecretCreateData>('Failed to create secret', 500);
        }
    }

    static async updateSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretUpdateData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretUpdateData>>;
            }

            const { id, name, provider, apiKey } = bodyResult.data as { 
                id?: string; 
                name?: string; 
                provider?: string; 
                apiKey?: string; 
            };

            if (!id || !name || !provider || !apiKey) {
                return ModelConfigController.createErrorResponse<SecretUpdateData>('ID, name, provider, and API key are required', 400);
            }

            const secretsService = new SecretsService(env);
            const result = await secretsService.updateUserSecret(user.id, id, { name, provider, apiKey });

            if (!result.success) {
                return ModelConfigController.createErrorResponse<SecretUpdateData>(result.error || 'Failed to update secret', 500);
            }

            const responseData: SecretUpdateData = {
                secret: {
                    id: result.secret!.id,
                    name: result.secret!.name,
                    provider: result.secret!.provider,
                    createdAt: result.secret!.createdAt,
                    updatedAt: result.secret!.updatedAt
                },
                message: 'Secret updated successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating secret:', error);
            return ModelConfigController.createErrorResponse<SecretUpdateData>('Failed to update secret', 500);
        }
    }

    static async deleteSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretDeleteData>>> {
        try {
            const user = context.user!;

            const bodyResult = await ModelConfigController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretDeleteData>>;
            }

            const { id } = bodyResult.data as { id?: string };

            if (!id) {
                return ModelConfigController.createErrorResponse<SecretDeleteData>('Secret ID is required', 400);
            }

            const secretsService = new SecretsService(env);
            const result = await secretsService.deleteUserSecret(user.id, id);

            if (!result.success) {
                return ModelConfigController.createErrorResponse<SecretDeleteData>(result.error || 'Failed to delete secret', 500);
            }

            const responseData: SecretDeleteData = {
                success: true,
                message: 'Secret deleted successfully'
            };

            return ModelConfigController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting secret:', error);
            return ModelConfigController.createErrorResponse<SecretDeleteData>('Failed to delete secret', 500);
        }
    }
}
*/

// Temporary placeholder to prevent import errors
import type { RouteContext } from '../../types/route-context';

export class ModelConfigController {
    static async getModelConfigs(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async updateModelConfig(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async deleteModelConfig(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async testModelConfig(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getSecrets(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async createSecret(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async updateSecret(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async deleteSecret(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getDefaults(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getByokProviders(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async getModelConfig(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
    static async resetAllConfigs(_request: Request, _env: Env, _ctx: ExecutionContext, _context: RouteContext) {
        return new Response(JSON.stringify({ success: false, error: 'Feature temporarily disabled' }), { status: 503 });
    }
}