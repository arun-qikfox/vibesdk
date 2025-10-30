import type { DatabaseClient, DatabaseInstance } from './types';
import { PostgresDatabaseClient } from '../runtime/postgresClient';

export function createPostgresClient(env: Env): DatabaseClient {
    // Now returns the REAL PostgresDatabaseClient instead of stub
    return new PostgresDatabaseClient(env);
}
