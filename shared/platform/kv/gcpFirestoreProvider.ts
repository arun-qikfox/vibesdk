import type { KVProvider, KVGetOptions, KVListOptions, KVListResult, KVPutOptions } from './types';

class GcpFirestoreKVProvider implements KVProvider {
    constructor(_env: unknown) {}

    private throwNotImplemented(): never {
        throw new Error('GCP KV provider is not yet implemented. Please configure Firestore/Redis integration.');
    }

    async get<T = unknown>(_key: string, _options?: KVGetOptions): Promise<T | null> {
        this.throwNotImplemented();
    }

    async put(_key: string, _value: string, _options?: KVPutOptions): Promise<void> {
        this.throwNotImplemented();
    }

    async delete(_key: string): Promise<void> {
        this.throwNotImplemented();
    }

    async list(_options?: KVListOptions): Promise<KVListResult> {
        this.throwNotImplemented();
    }
}

export function createGcpKVProvider(env: unknown): KVProvider {
    return new GcpFirestoreKVProvider(env);
}
