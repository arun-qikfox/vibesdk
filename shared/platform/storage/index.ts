import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import type { ObjectStore } from './types';
import { createCloudflareObjectStore } from './cloudflareObjectStore';
import { createGcpObjectStore } from './gcpObjectStore';

export function createObjectStore(env: unknown): ObjectStore {
    const provider = getRuntimeProvider(env);
    if (provider === 'gcp') {
        return createGcpObjectStore(env);
    }
    return createCloudflareObjectStore(env);
}

export type { ObjectStore, ObjectStoreGetOptions, ObjectStoreGetResult, ObjectStorePutOptions } from './types';
