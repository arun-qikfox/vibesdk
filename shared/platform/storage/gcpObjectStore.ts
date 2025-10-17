import type { ObjectStore, ObjectStoreGetOptions, ObjectStoreGetResult, ObjectStorePutOptions } from './types';

class GcpObjectStore implements ObjectStore {
    constructor(_env: unknown) {}

    private throwNotImplemented(): never {
        throw new Error('GCP object store is not implemented yet. Configure Google Cloud Storage support.');
    }

    async get(_key: string, _options?: ObjectStoreGetOptions): Promise<ObjectStoreGetResult | null> {
        return this.throwNotImplemented();
    }

    async put(_key: string, _value: string | ArrayBuffer | Uint8Array | ReadableStream, _options?: ObjectStorePutOptions): Promise<void> {
        this.throwNotImplemented();
    }

    async delete(_key: string): Promise<void> {
        this.throwNotImplemented();
    }
}

export function createGcpObjectStore(env: unknown): ObjectStore {
    return new GcpObjectStore(env);
}
