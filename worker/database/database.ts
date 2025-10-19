/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations∂ƒ
 */

import * as schema from './schema';

import type { HealthStatusResult } from './types';
import type { DatabaseClient, DatabaseInstance } from './clients/types';
import { createDatabaseClient } from './runtime/factory';
import type { DatabaseRuntimeEnv } from './runtime/types';

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
    public readonly db: DatabaseInstance;
    private readonly client: DatabaseClient;

    constructor(env: DatabaseRuntimeEnv) {
        this.client = createDatabaseClient(env);
        this.db = this.client.getPrimary();
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
    public getReadDb(strategy: 'fast' | 'fresh' = 'fast'): DatabaseInstance {
        return this.client.getReadReplica(strategy);
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
export function createDatabaseService(env: DatabaseRuntimeEnv): DatabaseService {
    return new DatabaseService(env);
}
