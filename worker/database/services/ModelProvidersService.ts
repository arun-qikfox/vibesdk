// Temporarily disabled due to database service issues
/*
import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';

export interface CreateProviderData {
    name: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
}

export interface UpdateProviderData {
    name?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    models?: string[];
    isActive?: boolean;
}

export interface ModelProvider {
    id: string;
    userId: string;
    name: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ModelProviderTestResult {
    success: boolean;
    result?: string;
    timestamp?: Date;
    error?: string;
}

export class ModelProvidersService extends BaseService {
    constructor(env: Env) {
        super(env);
    }

    async createUserModelProvider(userId: string, data: CreateProviderData): Promise<{ success: boolean; provider?: ModelProvider; error?: string }> {
        try {
            const id = generateId();
            const now = new Date();

            const result = await this.database.insert(schema.modelProviders).values({
                id,
                userId,
                name: data.name,
                provider: data.provider,
                baseUrl: data.baseUrl,
                apiKey: data.apiKey,
                models: data.models,
                isActive: true,
                createdAt: now,
                updatedAt: now
            }).returning();

            return {
                success: true,
                provider: result[0] as ModelProvider
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to create model provider'
            };
        }
    }

    async getUserModelProviders(userId: string): Promise<ModelProvider[]> {
        try {
            const result = await this.database
                .select()
                .from(schema.modelProviders)
                .where(eq(schema.modelProviders.userId, userId));

            return result as ModelProvider[];
        } catch (error) {
            return [];
        }
    }

    async getUserModelProvider(userId: string, providerId: string): Promise<ModelProvider | null> {
        try {
            const result = await this.database
                .select()
                .from(schema.modelProviders)
                .where(and(
                    eq(schema.modelProviders.id, providerId),
                    eq(schema.modelProviders.userId, userId)
                ))
                .limit(1);

            return result[0] as ModelProvider || null;
        } catch (error) {
            return null;
        }
    }

    async updateUserModelProvider(userId: string, providerId: string, data: UpdateProviderData): Promise<{ success: boolean; provider?: ModelProvider; error?: string }> {
        try {
            const now = new Date();

            const result = await this.database
                .update(schema.modelProviders)
                .set({
                    ...data,
                    updatedAt: now
                })
                .where(and(
                    eq(schema.modelProviders.id, providerId),
                    eq(schema.modelProviders.userId, userId)
                ))
                .returning();

            if (result.length === 0) {
                return {
                    success: false,
                    error: 'Model provider not found'
                };
            }

            return {
                success: true,
                provider: result[0] as ModelProvider
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to update model provider'
            };
        }
    }

    async deleteUserModelProvider(userId: string, providerId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.database
                .delete(schema.modelProviders)
                .where(and(
                    eq(schema.modelProviders.id, providerId),
                    eq(schema.modelProviders.userId, userId)
                ))
                .returning();

            if (result.length === 0) {
                return {
                    success: false,
                    error: 'Model provider not found'
                };
            }

            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to delete model provider'
            };
        }
    }

    async testModelProvider(userId: string, providerId: string, testPrompt: string): Promise<{ success: boolean; result?: string; timestamp?: Date; error?: string }> {
        try {
            const provider = await this.getUserModelProvider(userId, providerId);
            if (!provider) {
                return {
                    success: false,
                    error: 'Model provider not found'
                };
            }

            // This would normally make an actual API call to test the provider
            // For now, we'll just simulate a successful test
            const result = `Test completed for provider ${provider.name}`;
            const timestamp = new Date();

            return {
                success: true,
                result,
                timestamp
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to test model provider'
            };
        }
    }
}
*/

// Temporary placeholder to prevent import errors
export class ModelProvidersService {
    constructor(_env: Env) {}
    async createUserModelProvider(_userId: string, _data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async getUserModelProviders(_userId: string) {
        return [];
    }
    async getUserModelProvider(_userId: string, _providerId: string) {
        return null;
    }
    async updateUserModelProvider(_userId: string, _providerId: string, _data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async deleteUserModelProvider(_userId: string, _providerId: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async testModelProvider(_userId: string, _providerId: string, _testPrompt: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
}