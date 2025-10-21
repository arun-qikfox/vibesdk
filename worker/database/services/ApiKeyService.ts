// Temporarily disabled due to database service issues
/*
import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import { createLogger } from '../../logger';

const logger = createLogger('ApiKeyService');

export interface ApiKey {
    id: string;
    userId: string;
    name: string;
    keyHash: string;
    keyPreview: string;
    permissions: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NewApiKey {
    userId: string;
    name: string;
    keyHash: string;
    keyPreview: string;
    permissions: string[];
    expiresAt?: Date | null;
    isActive?: boolean;
}

export interface ApiKeyUsage {
    id: string;
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
}

export interface NewApiKeyUsage {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    ipAddress: string;
    userAgent: string;
}

export class ApiKeyService extends BaseService {
    constructor(env: Env) {
        super(env);
    }

    async createApiKey(data: NewApiKey): Promise<{ success: boolean; apiKey?: ApiKey; error?: string }> {
        try {
            const id = generateId();
            const now = new Date();

            const result = await this.database.insert(schema.apiKeys).values({
                id,
                userId: data.userId,
                name: data.name,
                keyHash: data.keyHash,
                keyPreview: data.keyPreview,
                permissions: data.permissions,
                expiresAt: data.expiresAt || null,
                isActive: data.isActive ?? true,
                createdAt: now,
                updatedAt: now
            }).returning();

            logger.info('API key created successfully', { id, userId: data.userId, name: data.name });

            return {
                success: true,
                apiKey: result[0] as ApiKey
            };
        } catch (error) {
            logger.error('Error creating API key:', error);
            return {
                success: false,
                error: 'Failed to create API key'
            };
        }
    }

    async getApiKeyById(id: string): Promise<ApiKey | null> {
        try {
            const result = await this.database
                .select()
                .from(schema.apiKeys)
                .where(eq(schema.apiKeys.id, id))
                .limit(1);

            return result[0] as ApiKey || null;
        } catch (error) {
            logger.error('Error fetching API key by ID:', error);
            return null;
        }
    }

    async getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
        try {
            const result = await this.database
                .select()
                .from(schema.apiKeys)
                .where(and(
                    eq(schema.apiKeys.keyHash, keyHash),
                    eq(schema.apiKeys.isActive, true)
                ))
                .limit(1);

            return result[0] as ApiKey || null;
        } catch (error) {
            logger.error('Error fetching API key by hash:', error);
            return null;
        }
    }

    async getUserApiKeys(userId: string): Promise<ApiKey[]> {
        try {
            const result = await this.database
                .select()
                .from(schema.apiKeys)
                .where(eq(schema.apiKeys.userId, userId))
                .orderBy(desc(schema.apiKeys.createdAt));

            return result as ApiKey[];
        } catch (error) {
            logger.error('Error fetching user API keys:', error);
            return [];
        }
    }

    async updateApiKey(id: string, updates: Partial<Pick<ApiKey, 'name' | 'permissions' | 'expiresAt' | 'isActive'>>): Promise<{ success: boolean; apiKey?: ApiKey; error?: string }> {
        try {
            const now = new Date();

            const result = await this.database
                .update(schema.apiKeys)
                .set({
                    ...updates,
                    updatedAt: now
                })
                .where(eq(schema.apiKeys.id, id))
                .returning();

            if (result.length === 0) {
                return {
                    success: false,
                    error: 'API key not found'
                };
            }

            logger.info('API key updated successfully', { id });

            return {
                success: true,
                apiKey: result[0] as ApiKey
            };
        } catch (error) {
            logger.error('Error updating API key:', error);
            return {
                success: false,
                error: 'Failed to update API key'
            };
        }
    }

    async deleteApiKey(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const result = await this.database
                .delete(schema.apiKeys)
                .where(eq(schema.apiKeys.id, id))
                .returning();

            if (result.length === 0) {
                return {
                    success: false,
                    error: 'API key not found'
                };
            }

            logger.info('API key deleted successfully', { id });

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error deleting API key:', error);
            return {
                success: false,
                error: 'Failed to delete API key'
            };
        }
    }

    async recordApiKeyUsage(data: NewApiKeyUsage): Promise<{ success: boolean; error?: string }> {
        try {
            const id = generateId();
            const now = new Date();

            await this.database.insert(schema.apiKeyUsage).values({
                id,
                apiKeyId: data.apiKeyId,
                endpoint: data.endpoint,
                method: data.method,
                statusCode: data.statusCode,
                responseTime: data.responseTime,
                timestamp: now,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent
            });

            // Update last used timestamp
            await this.database
                .update(schema.apiKeys)
                .set({ lastUsedAt: now })
                .where(eq(schema.apiKeys.id, data.apiKeyId));

            return {
                success: true
            };
        } catch (error) {
            logger.error('Error recording API key usage:', error);
            return {
                success: false,
                error: 'Failed to record API key usage'
            };
        }
    }

    async getApiKeyUsageStats(apiKeyId: string, days: number = 30): Promise<{ success: boolean; stats?: any; error?: string }> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const result = await this.database
                .select({
                    endpoint: schema.apiKeyUsage.endpoint,
                    method: schema.apiKeyUsage.method,
                    statusCode: schema.apiKeyUsage.statusCode,
                    count: sql<number>`count(*)`,
                    avgResponseTime: sql<number>`avg(${schema.apiKeyUsage.responseTime})`
                })
                .from(schema.apiKeyUsage)
                .where(and(
                    eq(schema.apiKeyUsage.apiKeyId, apiKeyId),
                    sql`${schema.apiKeyUsage.timestamp} >= ${startDate}`
                ))
                .groupBy(schema.apiKeyUsage.endpoint, schema.apiKeyUsage.method, schema.apiKeyUsage.statusCode);

            return {
                success: true,
                stats: result
            };
        } catch (error) {
            logger.error('Error fetching API key usage stats:', error);
            return {
                success: false,
                error: 'Failed to fetch usage stats'
            };
        }
    }
}
*/

// Temporary placeholder to prevent import errors
export class ApiKeyService {
    constructor(_env: Env) {}
    async createApiKey(_data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async getApiKeyById(_id: string) {
        return null;
    }
    async getApiKeyByHash(_keyHash: string) {
        return null;
    }
    async getUserApiKeys(_userId: string) {
        return [];
    }
    async updateApiKey(_id: string, _updates: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async deleteApiKey(_id: string) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async recordApiKeyUsage(_data: any) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
    async getApiKeyUsageStats(_apiKeyId: string, _days: number = 30) {
        return { success: false, error: 'Feature temporarily disabled' };
    }
}