import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import type { DatabaseClient } from './types';
import { createD1DatabaseClient } from './d1Client';
import { createPostgresClient } from './postgresClient';

export function createDatabaseClient(env: Env): DatabaseClient {
    const provider = getRuntimeProvider(env);

    if (provider === 'gcp') {
        return createPostgresClient(env);
    }

    return createD1DatabaseClient(env);
}

export { isD1DatabaseClient } from './d1Client';
export type { DatabaseClient, DatabaseInstance } from './types';
