export interface GcpDatabaseEnv {
    DATABASE_URL?: string;
    DATABASE_SOCKET_PATH?: string;
    DATABASE_POOL_MIN?: string;
    DATABASE_POOL_MAX?: string;
    DATABASE_POOL_IDLE_SECONDS?: string;
    DATABASE_SSL_MODE?: string;
}

export type DatabaseRuntimeEnv = Env & Partial<GcpDatabaseEnv>;
