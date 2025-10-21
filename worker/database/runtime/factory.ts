// Temporarily disabled due to Drizzle ORM multi-database type issues
/*
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createD1DatabaseClient, isD1DatabaseClient } from '../clients/d1Client';
import type { DatabaseClient } from '../clients/types';
import { PostgresDatabaseClient } from './postgresClient';
import type { DatabaseRuntimeEnv } from './types';

export function createDatabaseClient(env: DatabaseRuntimeEnv): DatabaseClient {
	const provider = getRuntimeProvider(env);

	if (provider === 'gcp') {
		return new PostgresDatabaseClient(env);
	}

	return createD1DatabaseClient(env) as DatabaseClient;
}

export { isD1DatabaseClient };
*/

// Simplified factory for GCP deployment
import { createD1DatabaseClient, isD1DatabaseClient } from '../clients/d1Client';
import type { DatabaseClient } from '../clients/types';
import type { DatabaseRuntimeEnv } from './types';

export function createDatabaseClient(env: DatabaseRuntimeEnv): DatabaseClient {
	// Use D1 client for now - will be replaced with proper PostgreSQL later
	return createD1DatabaseClient(env) as DatabaseClient;
}

export { isD1DatabaseClient };
