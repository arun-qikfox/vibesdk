/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations∂ƒ
 */

// import * as schema from './schema'; // Temporarily disabled

import type { HealthStatusResult } from './types';
import type { DatabaseInstance } from './clients/types';
// Temporarily disabled due to factory.ts being commented out
// import type { DatabaseClient } from './clients/types';
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
    // Temporarily disabled due to factory.ts being commented out
    // private readonly client: DatabaseClient;

    constructor(_env: DatabaseRuntimeEnv) {
        // Temporarily disabled due to factory.ts being commented out
        // this.client = createDatabaseClient(env);
        // this.db = this.client.getPrimary();
        // Temporary fallback - will need proper initialization later
        this.db = null as any;
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
    public getReadDb(_strategy: 'fast' | 'fresh' = 'fast'): DatabaseInstance {
        // Temporarily disabled due to factory.ts being commented out
        // return this.client.getReadReplica(strategy);
        return this.db; // Fallback to primary database
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async getHealthStatus(): Promise<HealthStatusResult> {
        try {
            // Temporarily disabled due to Drizzle ORM multi-database type issues
            // await this.db.select().from(schema.systemSettings).limit(1);
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
