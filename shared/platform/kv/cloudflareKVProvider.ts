import type { KVProvider, KVListOptions, KVListResult, KVPutOptions, KVValueType } from './types';

function mapPutOptions(options?: KVPutOptions): KVNamespacePutOptions | undefined {
    if (!options) {
        return undefined;
    }
    const mapped: KVNamespacePutOptions = {};
    if (typeof options.expiration === 'number') {
        mapped.expiration = options.expiration;
    }
    if (typeof options.expirationTtl === 'number') {
        mapped.expirationTtl = options.expirationTtl;
    }
    if (typeof options.metadata !== 'undefined') {
        mapped.metadata = options.metadata as Record<string, unknown>;
    }
    return mapped;
}

function mapListOptions(options?: KVListOptions): KVNamespaceListOptions | undefined {
    if (!options) {
        return undefined;
    }
    const result: KVNamespaceListOptions = {};
    if (options.prefix) {
        result.prefix = options.prefix;
    }
    if (options.cursor) {
        result.cursor = options.cursor;
    }
    if (typeof options.limit === 'number') {
        result.limit = options.limit;
    }
    return result;
}

export class CloudflareKVProvider implements KVProvider {
    constructor(private readonly kv: KVNamespace) {}

    async get<T = unknown>(key: string, options?: { type?: KVValueType }): Promise<T | null> {
        const type = options?.type;
        if (type) {
            return this.kv.get(key, type as any) as Promise<T | null>;
        }
        return this.kv.get(key) as Promise<T | null>;
    }

    async put(key: string, value: string, options?: KVPutOptions): Promise<void> {
        await this.kv.put(key, value, mapPutOptions(options));
    }

    async delete(key: string): Promise<void> {
        await this.kv.delete(key);
    }

    async list(options?: KVListOptions): Promise<KVListResult> {
        const result = await this.kv.list(mapListOptions(options));
        const cursor = 'cursor' in result ? (result as { cursor?: string }).cursor : undefined;
        return {
            keys: result.keys.map((key) => ({
                name: key.name,
                expiration: key.expiration,
                metadata: key.metadata,
            })),
            list_complete: result.list_complete,
            cursor,
        };
    }
}

type CloudflareBindings = { VibecoderStore?: KVNamespace } & Record<string, unknown>;

export function createCloudflareKVProvider(env: unknown): KVProvider {
    const binding = (env as CloudflareBindings).VibecoderStore;
    if (!binding) {
        throw new Error('VibecoderStore binding is not configured on the environment.');
    }
    return new CloudflareKVProvider(binding);
}
