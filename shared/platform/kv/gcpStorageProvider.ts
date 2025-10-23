import type { KVProvider, KVGetOptions, KVListKey, KVListOptions, KVListResult, KVPutOptions } from './types';
import { createObjectStore } from '../storage';

type EnvRecord = Record<string, unknown>;

type StorageEntry = {
	value: string;
	metadata?: unknown;
	expiration?: number | null;
	updatedAt: number;
};

const DEFAULT_BUCKET = 'vibesdk-kv';

/**
 * GCS-based KV adapter used when running on GCP.
 * Uses Google Cloud Storage as a simple key-value store.
 */
export class GcpStorageKVProvider implements KVProvider {
	private readonly bucketName: string;
	private readonly useInMemory: boolean;
	private readonly memoryStore: Map<string, StorageEntry>;
	private readonly disabledReason?: string;

	constructor(env: unknown) {
		console.log('[GCS-KV] Constructor called with env:', {
			hasEnv: !!env,
			envKeys: env ? Object.keys(env as Record<string, unknown>) : []
		});

		const record = (env ?? {}) as EnvRecord;

		this.useInMemory = record.KV_IN_MEMORY === true;
		this.memoryStore = new Map<string, StorageEntry>();

		console.log('[GCS-KV] Memory mode:', this.useInMemory);

		// Use GCS_TEMPLATES_BUCKET as the KV bucket, or create a dedicated one
		this.bucketName = 
			(typeof record.GCS_KV_BUCKET === 'string' && record.GCS_KV_BUCKET.trim().length > 0
				? record.GCS_KV_BUCKET
				: typeof record.GCS_TEMPLATES_BUCKET === 'string' && record.GCS_TEMPLATES_BUCKET.trim().length > 0
				? record.GCS_TEMPLATES_BUCKET
				: DEFAULT_BUCKET);

		console.log('[GCS-KV] Bucket name:', this.bucketName);

		if (!this.useInMemory && !this.bucketName) {
			this.disabledReason = 'GCS KV provider requires a bucket name. Please configure GCS_KV_BUCKET or GCS_TEMPLATES_BUCKET.';
			console.log('[GCS-KV] Provider disabled:', this.disabledReason);
		} else {
			console.log('[GCS-KV] Provider enabled and ready');
		}
	}

	async get<T = unknown>(key: string, options?: KVGetOptions): Promise<T | null> {
		console.log('[GCS-KV] get() called with key:', key, 'options:', options);
		
		if (this.useInMemory) {
			console.log('[GCS-KV] Using in-memory store');
			return this.readFromMemory<T>(key, options);
		}
		this.ensureEnabled();

		try {
			console.log('[GCS-KV] Fetching object from GCS bucket:', this.bucketName);
			const objectStore = createObjectStore({
				...this.getEnvForObjectStore(),
				GCS_TEMPLATES_BUCKET: this.bucketName
			} as unknown as Record<string, unknown>);

			const objectKey = `kv/${key}`;
			console.log('[GCS-KV] Object key:', objectKey);

			const result = await objectStore.get(objectKey);
			console.log('[GCS-KV] GCS get result:', { 
				hasResult: !!result, 
				resultType: typeof result 
			});

			if (!result) {
				console.log('[GCS-KV] Object not found, returning null');
				return null;
			}

			// Parse the stored JSON
			const entry: StorageEntry = JSON.parse(result);
			console.log('[GCS-KV] Parsed entry:', { 
				hasValue: !!entry.value, 
				hasExpiration: !!entry.expiration,
				expiration: entry.expiration 
			});

			if (this.isExpired(entry)) {
				console.log('[GCS-KV] Entry expired, deleting and returning null');
				await objectStore.delete(objectKey).catch(() => undefined);
				return null;
			}

			const deserializedValue = this.deserializeValue<T>(entry.value, options);
			console.log('[GCS-KV] Returning deserialized value:', typeof deserializedValue);
			return deserializedValue;

		} catch (error) {
			console.log('[GCS-KV] Error fetching from GCS:', error);
			throw error;
		}
	}

	async put(key: string, value: string, options?: KVPutOptions): Promise<void> {
		console.log('[GCS-KV] put() called with key:', key, 'value length:', value.length);
		
		const expiration = this.computeExpiration(options);
		const metadata = this.normalizeMetadata(options?.metadata);

		if (this.useInMemory) {
			console.log('[GCS-KV] Using in-memory store');
			this.memoryStore.set(key, { value, metadata, expiration, updatedAt: Date.now() });
			return;
		}
		this.ensureEnabled();

		try {
			console.log('[GCS-KV] Storing object in GCS bucket:', this.bucketName);
			const objectStore = createObjectStore({
				...this.getEnvForObjectStore(),
				GCS_TEMPLATES_BUCKET: this.bucketName
			} as unknown as Record<string, unknown>);

			const objectKey = `kv/${key}`;
			const entry: StorageEntry = {
				value,
				metadata,
				expiration: typeof expiration === 'number' ? expiration : null,
				updatedAt: Date.now()
			};

			console.log('[GCS-KV] Storing entry:', { 
				objectKey, 
				hasValue: !!entry.value,
				hasExpiration: !!entry.expiration 
			});

			await objectStore.put(objectKey, JSON.stringify(entry));
			console.log('[GCS-KV] Successfully stored in GCS');

		} catch (error) {
			console.log('[GCS-KV] Error storing in GCS:', error);
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		console.log('[GCS-KV] delete() called with key:', key);
		
		if (this.useInMemory) {
			console.log('[GCS-KV] Using in-memory store');
			this.memoryStore.delete(key);
			return;
		}
		this.ensureEnabled();

		try {
			console.log('[GCS-KV] Deleting object from GCS bucket:', this.bucketName);
			const objectStore = createObjectStore({
				...this.getEnvForObjectStore(),
				GCS_TEMPLATES_BUCKET: this.bucketName
			} as unknown as Record<string, unknown>);

			const objectKey = `kv/${key}`;
			console.log('[GCS-KV] Deleting object key:', objectKey);

			await objectStore.delete(objectKey);
			console.log('[GCS-KV] Successfully deleted from GCS');

		} catch (error) {
			console.log('[GCS-KV] Error deleting from GCS:', error);
			throw error;
		}
	}

	async list(options?: KVListOptions): Promise<KVListResult> {
		console.log('[GCS-KV] list() called with options:', options);
		
		if (this.useInMemory) {
			console.log('[GCS-KV] Using in-memory store');
			return this.listFromMemory(options);
		}
		this.ensureEnabled();

		// GCS doesn't have native list functionality in our object store
		// For now, return empty result
		console.log('[GCS-KV] List operation not implemented for GCS, returning empty result');
		return {
			keys: [],
			list_complete: true,
			cursor: undefined
		};
	}

	private async readFromMemory<T>(key: string, options?: KVGetOptions): Promise<T | null> {
		const entry = this.memoryStore.get(key);
		if (!entry || this.isExpired(entry)) {
			if (entry) {
				this.memoryStore.delete(key);
			}
			return null;
		}
		return this.deserializeValue<T>(entry.value, options);
	}

	private listFromMemory(options?: KVListOptions): KVListResult {
		const prefix = options?.prefix ?? '';
		const limit = this.normalizeLimit(options?.limit);
		const keys: KVListKey[] = [];
		const nowSeconds = this.nowSeconds();

		for (const [name, entry] of this.memoryStore.entries()) {
			if (prefix && !name.startsWith(prefix)) {
				continue;
			}
			if (this.isExpired(entry, nowSeconds)) {
				this.memoryStore.delete(name);
				continue;
			}
			keys.push({ name, expiration: entry.expiration ?? undefined, metadata: entry.metadata });
			if (keys.length >= limit) {
				break;
			}
		}

		return {
			keys,
			list_complete: keys.length < limit,
			cursor: undefined
		};
	}

	private deserializeValue<T>(value: string, options?: KVGetOptions): T | null {
		const type = options?.type ?? 'text';
		if (value == null) {
			return null;
		}

		if (type === 'json') {
			return JSON.parse(value) as T;
		}

		if (type === 'arrayBuffer') {
			const buffer = new TextEncoder().encode(value).buffer;
			return buffer as unknown as T;
		}

		if (type === 'stream') {
			const encoder = new TextEncoder();
			const chunk = encoder.encode(value);
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(chunk);
					controller.close();
				},
			});
			return stream as unknown as T;
		}

		// default: text
		return value as unknown as T;
	}

	private computeExpiration(options?: KVPutOptions): number | null {
		if (!options) {
			return null;
		}
		if (typeof options.expiration === 'number') {
			return options.expiration;
		}
		if (typeof options.expirationTtl === 'number') {
			const ttl = Math.max(0, Math.floor(options.expirationTtl));
			return this.nowSeconds() + ttl;
		}
		return null;
	}

	private isExpired(entry: StorageEntry, nowSeconds = this.nowSeconds()): boolean {
		return typeof entry.expiration === 'number' && entry.expiration <= nowSeconds;
	}

	private normalizeMetadata(metadata: unknown): unknown {
		if (typeof metadata === 'undefined') {
			return undefined;
		}

		try {
			return JSON.parse(JSON.stringify(metadata));
		} catch (_error) {
			return undefined;
		}
	}

	private normalizeLimit(limit?: number): number {
		if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
			return Math.min(Math.floor(limit), 1000);
		}
		return 100;
	}

	private nowSeconds(): number {
		return Math.floor(Date.now() / 1000);
	}

	private ensureEnabled(): void {
		if (this.disabledReason) {
			throw new Error(this.disabledReason);
		}
	}

	private getEnvForObjectStore(): Record<string, unknown> {
		// Return minimal env needed for object store
		return {
			GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
			GCP_ACCESS_TOKEN: process.env.GCP_ACCESS_TOKEN
		};
	}
}

export function createGcpStorageKVProvider(env: unknown): KVProvider {
	console.log('[GCS-KV] createGcpStorageKVProvider called with env:', {
		hasEnv: !!env,
		envKeys: env ? Object.keys(env as Record<string, unknown>) : []
	});
	
	const provider = new GcpStorageKVProvider(env);
	console.log('[GCS-KV] GcpStorageKVProvider instance created');
	
	return provider;
}
