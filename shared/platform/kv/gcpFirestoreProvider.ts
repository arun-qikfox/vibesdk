import type { KVProvider, KVGetOptions, KVListKey, KVListOptions, KVListResult, KVPutOptions } from './types';

type EnvRecord = Record<string, unknown>;

type MemoryEntry = {
	value: string;
	metadata?: unknown;
	expiration?: number | null;
};

const DEFAULT_COLLECTION = 'vibesdk-kv';

/**
 * Lightweight Firestore-based KV adapter used when running on GCP.
 * Falls back to an in-memory map when `KV_IN_MEMORY` is set (used in tests).
 */
export class GcpFirestoreKVProvider implements KVProvider {
	private readonly projectId: string | undefined;
	private readonly collectionName: string;
	private readonly useInMemory: boolean;
	private readonly memoryStore: Map<string, MemoryEntry>;
	private firestorePromise: Promise<any> | null = null;
	private firestoreModulePromise: Promise<typeof import('@google-cloud/firestore')> | null = null;
	private readonly disabledReason?: string;

	constructor(env: unknown) {
		const record = (env ?? {}) as EnvRecord;

		this.useInMemory = record.KV_IN_MEMORY === true;
		this.memoryStore = new Map<string, MemoryEntry>();

		this.collectionName =
			(typeof record.FIRESTORE_COLLECTION === 'string' && record.FIRESTORE_COLLECTION.trim().length > 0
				? record.FIRESTORE_COLLECTION
				: process.env.FIRESTORE_COLLECTION) || DEFAULT_COLLECTION;

		this.projectId =
			(typeof record.FIRESTORE_PROJECT_ID === 'string' && record.FIRESTORE_PROJECT_ID.trim().length > 0
				? record.FIRESTORE_PROJECT_ID
				: process.env.FIRESTORE_PROJECT_ID) ||
			process.env.GCP_PROJECT_ID ||
			process.env.GOOGLE_CLOUD_PROJECT;

		const emulatorHost =
			typeof record.FIRESTORE_EMULATOR_HOST === 'string'
				? record.FIRESTORE_EMULATOR_HOST
				: process.env.FIRESTORE_EMULATOR_HOST;

		if (emulatorHost) {
			process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
		}

		if (!this.useInMemory && !this.projectId) {
			this.disabledReason =
				'GCP KV provider is not yet implemented. Please configure Firestore/Redis integration.';
		}
	}

	async get<T = unknown>(key: string, options?: KVGetOptions): Promise<T | null> {
		if (this.useInMemory) {
			return this.readFromMemory<T>(key, options);
		}
		this.ensureEnabled();

		const doc = await this.getDocument(key);
		if (!doc.exists) {
			return null;
		}

		const data = doc.data() as MemoryEntry;
		if (this.isExpired(data)) {
			await doc.ref.delete().catch(() => undefined);
			return null;
		}

		return this.deserializeValue<T>(data.value, options);
	}

	async put(key: string, value: string, options?: KVPutOptions): Promise<void> {
		const expiration = this.computeExpiration(options);
		const metadata = this.normalizeMetadata(options?.metadata);

		if (this.useInMemory) {
			this.memoryStore.set(key, { value, metadata, expiration });
			return;
		}
		this.ensureEnabled();

		const collection = await this.getCollection();
		await collection.doc(key).set(
			{
				value,
				metadata,
				expiration: typeof expiration === 'number' ? expiration : null,
				updatedAt: Date.now(),
			},
			{ merge: true },
		);
	}

	async delete(key: string): Promise<void> {
		if (this.useInMemory) {
			this.memoryStore.delete(key);
			return;
		}
		this.ensureEnabled();

		const collection = await this.getCollection();
		await collection.doc(key).delete();
	}

	async list(options?: KVListOptions): Promise<KVListResult> {
		if (this.useInMemory) {
			return this.listFromMemory(options);
		}

		const limit = this.normalizeLimit(options?.limit);
		const prefix = options?.prefix ?? '';
		const cursor = options?.cursor;

		this.ensureEnabled();

		const firestoreModule = await this.loadFirestoreModule();
		const FieldPath = firestoreModule.FieldPath;
		let query = (await this.getCollection()).orderBy(FieldPath.documentId());

		if (prefix) {
			const end = prefix + '\uf8ff';
			query = query
				.where(FieldPath.documentId(), '>=', prefix)
				.where(FieldPath.documentId(), '<=', end);
		}

		if (cursor) {
			query = query.startAfter(cursor);
		}

		const snapshot = await query.limit(limit).get();
		const nowSeconds = this.nowSeconds();

		const keys: KVListKey[] = [];
		await Promise.all(
			snapshot.docs.map(async (doc: any) => {
				const data = doc.data() as MemoryEntry;
				if (data.expiration && data.expiration <= nowSeconds) {
					await doc.ref.delete().catch(() => undefined);
					return;
				}
				keys.push({
					name: doc.id,
					expiration: data.expiration ?? undefined,
					metadata: data.metadata,
				});
			}),
		);

		const complete = snapshot.size < limit;
		const nextCursor = complete
			? undefined
			: snapshot.docs[snapshot.docs.length - 1]?.id;

		return {
			keys,
			list_complete: complete,
			cursor: nextCursor,
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
			cursor: undefined,
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

	private isExpired(entry: MemoryEntry, nowSeconds = this.nowSeconds()): boolean {
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

	private async loadFirestoreModule() {
		this.ensureEnabled();
		if (!this.firestoreModulePromise) {
			this.firestoreModulePromise = import('@google-cloud/firestore');
		}
		return this.firestoreModulePromise;
	}

	private async getFirestore() {
		if (this.useInMemory) {
			throw new Error('Firestore client not available in memory mode.');
		}
		this.ensureEnabled();
		if (!this.firestorePromise) {
			const { Firestore } = await this.loadFirestoreModule();
			this.firestorePromise = Promise.resolve(new Firestore({ projectId: this.projectId }));
		}
		return this.firestorePromise;
	}

	private async getCollection() {
		const firestore = await this.getFirestore();
		return firestore.collection(this.collectionName);
	}

	private async getDocument(key: string) {
		this.ensureEnabled();
		const collection = await this.getCollection();
		return collection.doc(key).get();
	}

	private ensureEnabled(): void {
		if (this.disabledReason) {
			throw new Error(this.disabledReason);
		}
	}
}

export function createGcpKVProvider(env: unknown): KVProvider {
	return new GcpFirestoreKVProvider(env);
}
