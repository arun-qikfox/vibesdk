/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations∂ƒ
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

import type { HealthStatusResult } from './types';
import { createDatabaseClient, isD1DatabaseClient } from './clients';
import type { D1DatabaseClient } from './clients/d1Client';

// ========================================
// TYPE DEFINITIONS AND INTERFACES
// ========================================

export type {
    User, NewUser, Session, NewSession,
    App, NewApp,
    AppLike, NewAppLike, AppComment, NewAppComment,
    AppView, NewAppView, OAuthState, NewOAuthState,
    SystemSetting, NewSystemSetting,
    UserSecret, NewUserSecret,
    UserModelConfig, NewUserModelConfig,
} from './schema';


/**
 * Core Database Service - Connection and Base Operations
 * 
 * Provides database connection, shared utilities, and core operations.
 * Domain-specific operations are handled by dedicated service classes.
 */
export class DatabaseService {
    public readonly db: DrizzleD1Database<typeof schema>;
    private readonly client: D1DatabaseClient;

    constructor(env: Env) {
        const client = createDatabaseClient(env);
        if (!isD1DatabaseClient(client)) {
            throw new Error('Postgres database adapter is not yet implemented. Set RUNTIME_PROVIDER=cloudflare until the adapter is available.');
        }
        this.client = client;
        this.db = this.client.getPrimary() as DrizzleD1Database<typeof schema>;
    }

    /**
     * Get a read-optimized database connection using D1 Sessions API
     * This routes queries to read replicas for lower global latency
     * 
     * @param strategy - Session strategy:
     *   - 'fast' (default): Routes to any replica for lowest latency
     *   - 'fresh': Routes first query to primary for latest data
     * @returns Drizzle database instance configured for read operations
     */
    public getReadDb(strategy: 'fast' | 'fresh' = 'fast'): DrizzleD1Database<typeof schema> {
        return this.client.getReadReplica(strategy) as DrizzleD1Database<typeof schema>;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async getHealthStatus(): Promise<HealthStatusResult> {
        try {
            await this.db.select().from(schema.systemSettings).limit(1);
            return {
                healthy: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                healthy: false,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

/**
 * Factory function to create database service instance
 */
export function createDatabaseService(env: Env): DatabaseService {
    return new DatabaseService(env);
}
