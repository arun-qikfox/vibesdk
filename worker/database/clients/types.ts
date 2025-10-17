import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema';

export type DatabaseInstance = DrizzleD1Database<typeof schema> | PostgresJsDatabase<typeof schema>;

export interface DatabaseClient {
    readonly kind: 'd1' | 'postgres';
    getPrimary(): DatabaseInstance;
    getReadReplica(strategy?: 'fast' | 'fresh'): DatabaseInstance;
    dispose?(): Promise<void>;
}

