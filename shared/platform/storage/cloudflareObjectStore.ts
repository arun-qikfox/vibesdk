import type { ObjectStore, ObjectStoreGetOptions, ObjectStoreGetResult, ObjectStorePutOptions } from './types';

function toGetResult(response: R2ObjectBody): ObjectStoreGetResult {
    const stream = 'body' in response ? response.body : null;
    return {
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
        json: <T = unknown>() => response.json<T>(),
        stream: () => stream,
        httpMetadata: response.httpMetadata ? {
            contentType: response.httpMetadata.contentType,
            contentLanguage: response.httpMetadata.contentLanguage,
            contentDisposition: response.httpMetadata.contentDisposition,
            cacheControl: response.httpMetadata.cacheControl,
        } : undefined,
        customMetadata: response.customMetadata as Record<string, string> | undefined,
    };
}

export class CloudflareObjectStore implements ObjectStore {
    constructor(private readonly bucket: R2Bucket) {}

    async get(key: string, options?: ObjectStoreGetOptions): Promise<ObjectStoreGetResult | null> {
        const getOptions: R2GetOptions | undefined = options?.range
            ? { range: { offset: options.range.offset, length: options.range.length } }
            : undefined;
        const result = await this.bucket.get(key, getOptions);
        if (!result) {
            return null;
        }
        return toGetResult(result);
    }

    async put(key: string, value: string | ArrayBuffer | Uint8Array | ReadableStream, options?: ObjectStorePutOptions): Promise<void> {
        const putOptions: R2PutOptions | undefined = options
            ? {
                httpMetadata: options.httpMetadata,
                customMetadata: options.customMetadata,
            }
            : undefined;
        await this.bucket.put(key, value, putOptions);
    }

    async delete(key: string): Promise<void> {
        await this.bucket.delete(key);
    }
}

export function createCloudflareObjectStore(env: unknown): ObjectStore {
    const bucket = (env as { TEMPLATES_BUCKET?: R2Bucket }).TEMPLATES_BUCKET;
    if (!bucket) {
        throw new Error('TEMPLATES_BUCKET binding is not available on this environment');
    }
    return new CloudflareObjectStore(bucket);
}
