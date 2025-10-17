export type KVValueType = 'text' | 'json' | 'arrayBuffer' | 'stream';

export interface KVGetOptions {
    type?: KVValueType;
}

export interface KVPutOptions {
    expiration?: number;
    expirationTtl?: number;
    metadata?: unknown;
}

export interface KVListOptions {
    prefix?: string;
    cursor?: string;
    limit?: number;
}

export interface KVListKey {
    name: string;
    expiration?: number;
    metadata?: unknown;
}

export interface KVListResult {
    keys: KVListKey[];
    list_complete: boolean;
    cursor?: string;
}

export interface KVProvider {
    get<T = unknown>(key: string, options?: KVGetOptions): Promise<T | null>;
    put(key: string, value: string, options?: KVPutOptions): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: KVListOptions): Promise<KVListResult>;
}
