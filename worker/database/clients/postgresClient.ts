import type { DatabaseClient, DatabaseInstance } from './types';

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
    const reason = typeof databaseUrl === 'string' && databaseUrl.length > 0
        ? 'adapter implementation pending'
        : 'DATABASE_URL is missing';

    return new StubPostgresClient(reason);
}

