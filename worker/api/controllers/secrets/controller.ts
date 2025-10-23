import { BaseController } from '../baseController';
import { ApiResponse, ControllerResponse } from '../types';
import { RouteContext } from '../../types/route-context';
import { SecretsService } from '../../../database/services/SecretsService';
import { createDatabaseService } from '../../../database/database';
import {
    SecretsData,
    SecretStoreData,
    SecretDeleteData,
    SecretTemplatesData,
} from './types';
import { createLogger } from '../../../logger';

export class SecretsController extends BaseController {
    static logger = createLogger('SecretsController');

    static async getSecrets(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretsData>>> {
        try {
            const user = context.user!;

            const secretsService = new SecretsService(env);
            const secrets = await secretsService.getUserSecrets(user.id);

            const responseData: SecretsData = {
                secrets: secrets.map(secret => ({
                    id: secret.id,
                    name: secret.name,
                    provider: secret.provider,
                    createdAt: secret.createdAt,
                    updatedAt: secret.updatedAt
                }))
            };

            return SecretsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching secrets:', error);
            return SecretsController.createErrorResponse<SecretsData>('Failed to fetch secrets', 500);
        }
    }

    static async storeSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretStoreData>>> {
        try {
            const user = context.user!;

            const bodyResult = await SecretsController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretStoreData>>;
            }

            const { name, provider, apiKey } = bodyResult.data as { 
                name?: string; 
                provider?: string; 
                apiKey?: string; 
            };

            if (!name || !provider || !apiKey) {
                return SecretsController.createErrorResponse<SecretStoreData>('Name, provider, and API key are required', 400);
            }

            const secretsService = new SecretsService(env);
            const result = await secretsService.createUserSecret(user.id, { name, provider, apiKey });

            if (!result.success) {
                return SecretsController.createErrorResponse<SecretStoreData>(result.error || 'Failed to store secret', 500);
            }

            const responseData: SecretStoreData = {
                secret: {
                    id: result.secret!.id,
                    name: result.secret!.name,
                    provider: result.secret!.provider,
                    createdAt: result.secret!.createdAt,
                    updatedAt: result.secret!.updatedAt
                },
                message: 'Secret stored successfully'
            };

            return SecretsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error storing secret:', error);
            return SecretsController.createErrorResponse<SecretStoreData>('Failed to store secret', 500);
        }
    }

    static async deleteSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretDeleteData>>> {
        try {
            const user = context.user!;

            const bodyResult = await SecretsController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretDeleteData>>;
            }

            const { id } = bodyResult.data as { id?: string };

            if (!id) {
                return SecretsController.createErrorResponse<SecretDeleteData>('Secret ID is required', 400);
            }

            const secretsService = new SecretsService(env);
            const result = await secretsService.deleteUserSecret(user.id, id);

            if (!result.success) {
                return SecretsController.createErrorResponse<SecretDeleteData>(result.error || 'Failed to delete secret', 500);
            }

            const responseData: SecretDeleteData = {
                success: true,
                message: 'Secret deleted successfully'
            };

            return SecretsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting secret:', error);
            return SecretsController.createErrorResponse<SecretDeleteData>('Failed to delete secret', 500);
        }
    }

    static async getSecretTemplates(_request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretTemplatesData>>> {
        try {
            const secretsService = new SecretsService(env);
            const templates = await secretsService.getSecretTemplates();

            const responseData: SecretTemplatesData = {
                templates: templates.map(template => ({
                    id: template.id,
                    name: template.name,
                    provider: template.provider,
                    description: template.description,
                    envVarName: template.envVarName,
                    required: template.required
                }))
            };

            return SecretsController.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching secret templates:', error);
            return SecretsController.createErrorResponse<SecretTemplatesData>('Failed to fetch secret templates', 500);
        }
    }
}