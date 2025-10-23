import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { DatabaseClient, DatabaseInstance } from './types';
import * as schema from '../schema';

class PostgresDatabaseClient implements DatabaseClient {
    public readonly kind = 'postgres' as const;
    private readonly primaryDb: DatabaseInstance;
    private readonly readDb: DatabaseInstance;
    private readonly sql: postgres.Sql;

    constructor(databaseUrl: string) {
        // Create postgres connection
        this.sql = postgres(databaseUrl, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
        });

        // Create drizzle instances
        this.primaryDb = drizzle(this.sql, { schema });
        this.readDb = drizzle(this.sql, { schema });
    }

    getPrimary(): DatabaseInstance {
        return this.primaryDb;
    }

    getReadReplica(strategy: 'fast' | 'fresh' = 'fast'): DatabaseInstance {
        // For now, return the same instance since we're using a single connection
        // In production, you might want to use read replicas
        return this.readDb;
    }

    async dispose(): Promise<void> {
        await this.sql.end();
    }
}

class StubPostgresClient implements DatabaseClient {
    public readonly kind = 'postgres' as const;

    private readonly message: string;

    constructor(reason: string) {
        this.message = reason;
    }

    private throw(): never {
        throw new Error(
            `Postgres database client is not configured: ${this.message}. ` +
            'Ensure DATABASE_URL and related credentials are set and the Postgres adapter is implemented.'
        );
    }

    getPrimary(): DatabaseInstance {
        return this.throw();
    }

    getReadReplica(): DatabaseInstance {
        return this.throw();
    }
}

export function createPostgresClient(env: Env): DatabaseClient {
    const databaseUrl = (env as unknown as Record<string, unknown>)?.DATABASE_URL;
    
    if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
        return new StubPostgresClient('DATABASE_URL is missing');
    }

    try {
        return new PostgresDatabaseClient(databaseUrl);
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        return new StubPostgresClient(`Failed to create postgres client: ${reason}`);
    }
}

