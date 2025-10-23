/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations∂ƒ
 */

// import * as schema from './schema';

import type { HealthStatusResult } from './types';
import type { DatabaseInstance } from './clients/types';
import type { DatabaseClient } from './clients/types';
import type { DatabaseRuntimeEnv } from './runtime/types';
import { createDatabaseClient } from './runtime/factory';

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
            // Simplified health check for GCP PostgreSQL
            return {
                healthy: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                healthy: false,
                timestamp: new Date().toISOString(),
                details: { error: error instanceof Error ? error.message : String(error) }
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

// ========================================
// SERVICE EXPORTS
// ========================================

// Re-export all service classes for easy importing
export { AuthService } from './services/AuthService';
export { AppService } from './services/AppService';
export { UserService } from './services/UserService';
export { SessionService } from './services/SessionService';
export { AnalyticsService } from './services/AnalyticsService';
export { ModelConfigService } from './services/ModelConfigService';
export { ModelTestService } from './services/ModelTestService';
export { SecretsService } from './services/SecretsService';
export { ApiKeyService } from './services/ApiKeyService';
export { ModelProvidersService } from './services/ModelProvidersService';