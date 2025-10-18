import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import type { KVProvider } from './types';
import { createCloudflareKVProvider } from './cloudflareKVProvider';
import { createGcpKVProvider } from './gcpFirestoreProvider';

export function createKVProvider(env: unknown): KVProvider {
    const provider = getRuntimeProvider(env);
    if (provider === 'gcp') {
        return createGcpKVProvider(env);
    }
    return createCloudflareKVProvider(env);
}

export type { KVProvider, KVListOptions, KVListResult, KVPutOptions } from './types';
