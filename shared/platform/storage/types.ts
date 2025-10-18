export interface ObjectStoreGetResult {
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
    stream(): ReadableStream | null;
    httpMetadata?: {
        contentType?: string;
        contentLanguage?: string;
        contentDisposition?: string;
        cacheControl?: string;
    };
    customMetadata?: Record<string, string> | undefined;
}

export interface ObjectStorePutOptions {
    httpMetadata?: {
        contentType?: string;
        contentLanguage?: string;
        contentDisposition?: string;
        cacheControl?: string;
    };
    customMetadata?: Record<string, string>;
}

export type ObjectStoreGetOptions = {
    range?: {
        offset: number;
        length?: number;
    };
};

export interface ObjectStore {
    get(key: string, options?: ObjectStoreGetOptions): Promise<ObjectStoreGetResult | null>;
    put(key: string, value: string | ArrayBuffer | Uint8Array | ReadableStream, options?: ObjectStorePutOptions): Promise<void>;
    delete(key: string): Promise<void>;
}
