import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createD1DatabaseClient, isD1DatabaseClient } from '../clients/d1Client';
import type { DatabaseClient } from '../clients/types';
import { PostgresDatabaseClient } from './postgresClient';
import type { DatabaseRuntimeEnv } from './types';

export function createDatabaseClient(env: DatabaseRuntimeEnv): DatabaseClient {
    const provider = getRuntimeProvider(env);
    console.log(`🔍 createDatabaseClient: runtime provider = '${provider}'`)

    if (provider === 'gcp') {
        console.log('✅ Creating PostgresDatabaseClient')
        return new PostgresDatabaseClient(env);
    }

    console.log('⚠️ Creating D1DatabaseClient (fallback)')
    return createD1DatabaseClient(env) as DatabaseClient;
}

export { isD1DatabaseClient };
