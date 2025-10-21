// Temporarily disabled due to d1Client issues
/*
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createD1DatabaseClient, isD1DatabaseClient } from '../clients/d1Client';
import type { DatabaseClient } from '../clients/types';
// import { PostgresDatabaseClient } from './postgresClient'; // Temporarily disabled
import type { DatabaseRuntimeEnv } from './types';

export function createDatabaseClient(env: DatabaseRuntimeEnv): DatabaseClient {
    const provider = getRuntimeProvider(env);

    if (provider === 'gcp') {
        // Temporarily disabled PostgreSQL client
        // return new PostgresDatabaseClient(env);
        return createD1DatabaseClient(env) as DatabaseClient;
    }

    return createD1DatabaseClient(env) as DatabaseClient;
}

export { isD1DatabaseClient };
*/
