import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as Sentry from '@sentry/cloudflare';
import * as schema from '../schema';
import type { DatabaseClient } from './types';

export class D1DatabaseClient implements DatabaseClient {
    public readonly kind = 'd1' as const;

    private readonly d1: D1Database;
    private readonly primary: DrizzleD1Database<typeof schema>;
    private readonly enableReplicas: boolean;

    constructor(env: Env) {
        const instrumented = Sentry.instrumentD1WithSentry(env.DB);
        this.d1 = instrumented;
        this.primary = drizzle(instrumented, { schema });
        this.enableReplicas = env.ENABLE_READ_REPLICAS === 'true';
    }

    getPrimary(): DrizzleD1Database<typeof schema> {
        return this.primary;
    }

    getReadReplica(strategy: 'fast' | 'fresh' = 'fast'): DrizzleD1Database<typeof schema> {
        if (!this.enableReplicas) {
            return this.primary;
        }

        const sessionType = strategy === 'fresh' ? 'first-primary' : 'first-unconstrained';
        const session = this.d1.withSession(sessionType);
        return drizzle(session as unknown as D1Database, { schema });
    }
}

export function createD1DatabaseClient(env: Env): DatabaseClient {
    return new D1DatabaseClient(env);
}

export function isD1DatabaseClient(client: DatabaseClient): client is D1DatabaseClient {
    return client.kind === 'd1';
}
