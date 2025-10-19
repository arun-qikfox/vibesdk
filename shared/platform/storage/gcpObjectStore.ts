import type {
	ObjectStore,
	ObjectStoreGetOptions,
	ObjectStoreGetResult,
	ObjectStorePutOptions,
} from './types';

type EnvLike = Record<string, unknown> | undefined | null;

const METADATA_TOKEN_ENDPOINT =
	'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const STORAGE_METADATA_BASE = 'https://storage.googleapis.com/storage/v1/b';
const STORAGE_UPLOAD_BASE =
	'https://storage.googleapis.com/upload/storage/v1/b';
const STORAGE_DOWNLOAD_BASE =
	'https://storage.googleapis.com/download/storage/v1/b';

let cachedToken: { token: string; expiry: number } | null = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function readEnv(env: EnvLike, key: string): string | undefined {
	if (env && typeof env === 'object' && key in env) {
		const value = (env as Record<string, unknown>)[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value;
		}
	}
	if (typeof process !== 'undefined' && process.env && key in process.env) {
		const value = process.env[key];
		if (value && value.trim().length > 0) {
			return value;
		}
	}
	return undefined;
}

async function fetchMetadataToken(): Promise<{ token: string; expiry: number }> {
	const response = await fetch(METADATA_TOKEN_ENDPOINT, {
		headers: { 'Metadata-Flavor': 'Google' },
	});
	if (!response.ok) {
		throw new Error(
			`Failed to retrieve access token from metadata server (status ${response.status})`,
		);
	}
	const payload = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};
	return {
		token: payload.access_token,
		expiry: Date.now() + payload.expires_in * 1000,
	};
}

async function getAccessToken(env: EnvLike): Promise<string> {
	const explicitToken = readEnv(env, 'GCP_ACCESS_TOKEN');
	if (explicitToken) {
		return explicitToken;
	}
	if (cachedToken && cachedToken.expiry - 60_000 > Date.now()) {
		return cachedToken.token;
	}
	const token = await fetchMetadataToken();
	cachedToken = token;
	return token.token;
}

function normaliseKey(rawKey: string): string {
	let key = rawKey.trim();
	if (key.startsWith('/')) {
		key = key.slice(1);
	}
	if (key.length === 0) {
		return 'index.html';
	}
	return key;
}

async function readStream(stream: ReadableStream): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const result = await reader.read();
		if (result.done) {
			break;
		}
		const chunk = result.value;
		let array: Uint8Array;
		if (typeof chunk === 'string') {
			array = encoder.encode(chunk);
		} else if (chunk instanceof Uint8Array) {
			array = chunk;
		} else if (chunk instanceof ArrayBuffer) {
			array = new Uint8Array(chunk);
		} else {
			array = new Uint8Array(chunk);
		}
		total += array.byteLength;
		chunks.push(array);
	}
	const output = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

async function normaliseBody(
	value: string | ArrayBuffer | Uint8Array | ReadableStream,
): Promise<Uint8Array> {
	if (typeof value === 'string') {
		return encoder.encode(value);
	}
	if (value instanceof Uint8Array) {
		return value;
	}
	if (value instanceof ArrayBuffer) {
		return new Uint8Array(value);
	}
	return readStream(value);
}

function encodeObjectName(key: string): string {
	return encodeURIComponent(key);
}

function typedArrayToArrayBuffer(data: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(data.byteLength);
	new Uint8Array(buffer).set(data);
	return buffer;
}

function buildMultipartBody(
	key: string,
	data: Uint8Array,
	options?: ObjectStorePutOptions,
): { body: Uint8Array; contentType: string } {
	const boundary = `gcsmultipart-${Math.random().toString(16).slice(2)}`;
	const metadata: Record<string, unknown> = { name: key };
	const httpMetadata = options?.httpMetadata;
	if (httpMetadata?.contentType) {
		metadata.contentType = httpMetadata.contentType;
	}
	if (httpMetadata?.cacheControl) {
		metadata.cacheControl = httpMetadata.cacheControl;
	}
	if (httpMetadata?.contentLanguage) {
		metadata.contentLanguage = httpMetadata.contentLanguage;
	}
	if (httpMetadata?.contentDisposition) {
		metadata.contentDisposition = httpMetadata.contentDisposition;
	}
	if (options?.customMetadata && Object.keys(options.customMetadata).length) {
		metadata.metadata = options.customMetadata;
	}

	const metadataPart = encoder.encode(
		`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
			metadata,
		)}\r\n`,
	);
	const dataContentType =
		(options?.httpMetadata?.contentType &&
			options.httpMetadata.contentType) ||
		'application/octet-stream';
	const dataHeader = encoder.encode(
		`--${boundary}\r\nContent-Type: ${dataContentType}\r\n\r\n`,
	);
	const closing = encoder.encode(`\r\n--${boundary}--`);

	const totalLength =
		metadataPart.byteLength + dataHeader.byteLength + data.byteLength + closing.byteLength;
	const body = new Uint8Array(totalLength);
	let offset = 0;
	body.set(metadataPart, offset);
	offset += metadataPart.byteLength;
	body.set(dataHeader, offset);
	offset += dataHeader.byteLength;
	body.set(data, offset);
	offset += data.byteLength;
	body.set(closing, offset);

	return {
		body,
		contentType: `multipart/related; boundary=${boundary}`,
	};
}

function buildObjectStoreResult(
	bufferPromise: Promise<ArrayBuffer>,
	meta: {
		contentType?: string;
		contentLanguage?: string;
		contentDisposition?: string;
		cacheControl?: string;
		metadata?: Record<string, string>;
		etag?: string;
	},
): ObjectStoreGetResult & { etag?: string } {
	const textPromise = bufferPromise.then((buf) =>
		decodeBuffer(new Uint8Array(buf)),
	);
	return {
		arrayBuffer: () => bufferPromise,
		text: () => textPromise,
		json: async <T = unknown>() => JSON.parse(await textPromise) as T,
		stream: () =>
			new ReadableStream({
				start(controller) {
					bufferPromise
						.then((buf) => {
							controller.enqueue(new Uint8Array(buf));
							controller.close();
						})
						.catch((error) => controller.error(error));
				},
			}),
		httpMetadata: {
			contentType: meta.contentType,
			contentLanguage: meta.contentLanguage,
			contentDisposition: meta.contentDisposition,
			cacheControl: meta.cacheControl,
		},
		customMetadata: meta.metadata,
		etag: meta.etag,
	};
}

function decodeBuffer(buffer: Uint8Array): string {
	return decoder.decode(buffer);
}

class GcpObjectStore implements ObjectStore {
	constructor(private readonly env: EnvLike) {}

	private get bucket(): string {
		const value = readEnv(this.env, 'GCS_TEMPLATES_BUCKET');
		if (!value) {
			throw new Error(
				'GCS_TEMPLATES_BUCKET is not configured. Set this environment variable to the Google Cloud Storage bucket name.',
			);
		}
		return value;
	}

	private async authorisedFetch(
		url: string,
		init: RequestInit,
		accessToken: string,
	): Promise<Response> {
		const headers = new Headers(init.headers);
		if (!headers.has('Authorization')) {
			headers.set('Authorization', `Bearer ${accessToken}`);
		}
		return fetch(url, { ...init, headers });
	}

	async get(key: string, _options?: ObjectStoreGetOptions): Promise<ObjectStoreGetResult | null> {
		const objectName = normaliseKey(key);
		const encoded = encodeObjectName(objectName);
		const bucket = this.bucket;
		const token = await getAccessToken(this.env);
		const metadataUrl = `${STORAGE_METADATA_BASE}/${bucket}/o/${encoded}`;
		const metadataResponse = await this.authorisedFetch(
			metadataUrl,
			{ method: 'GET', headers: { Accept: 'application/json' } },
			token,
		);
		if (metadataResponse.status === 404) {
			return null;
		}
		if (!metadataResponse.ok) {
			const message = await metadataResponse.text();
			throw new Error(
				`Failed to fetch metadata for "${objectName}" (status ${metadataResponse.status}): ${message}`,
			);
		}
		const metadata = (await metadataResponse.json()) as {
			contentType?: string;
			contentLanguage?: string;
			contentDisposition?: string;
			cacheControl?: string;
			metadata?: Record<string, string>;
			etag?: string;
		};
		const downloadUrl = `${STORAGE_DOWNLOAD_BASE}/${bucket}/o/${encoded}?alt=media`;
		const downloadResponse = await this.authorisedFetch(
			downloadUrl,
			{ method: 'GET', headers: { Accept: '*/*' } },
			token,
		);
		if (downloadResponse.status === 404) {
			return null;
		}
		if (!downloadResponse.ok) {
			const message = await downloadResponse.text();
			throw new Error(
				`Failed to download object "${objectName}" (status ${downloadResponse.status}): ${message}`,
			);
		}
		const bufferPromise = downloadResponse.arrayBuffer();
		return buildObjectStoreResult(bufferPromise, metadata);
	}

	async put(
		key: string,
		value: string | ArrayBuffer | Uint8Array | ReadableStream,
		options?: ObjectStorePutOptions,
	): Promise<void> {
		const objectName = normaliseKey(key);
		const bucket = this.bucket;
		const encoded = encodeObjectName(objectName);
		const data = await normaliseBody(value);
		const { body, contentType } = buildMultipartBody(objectName, data, options);
		const token = await getAccessToken(this.env);
		const uploadUrl = `${STORAGE_UPLOAD_BASE}/${bucket}/o?uploadType=multipart&name=${encoded}`;
		const bodyInit = typedArrayToArrayBuffer(body);
		const response = await this.authorisedFetch(
			uploadUrl,
			{
				method: 'POST',
				body: bodyInit,
				headers: {
					'Content-Type': contentType,
					Accept: 'application/json',
				},
			},
			token,
		);
		if (!response.ok) {
			const message = await response.text();
			throw new Error(
				`Failed to upload object "${objectName}" (status ${response.status}): ${message}`,
			);
		}
	}

	async delete(key: string): Promise<void> {
		const objectName = normaliseKey(key);
		const encoded = encodeObjectName(objectName);
		const bucket = this.bucket;
		const token = await getAccessToken(this.env);
		const deleteUrl = `${STORAGE_METADATA_BASE}/${bucket}/o/${encoded}`;
		const response = await this.authorisedFetch(
			deleteUrl,
			{ method: 'DELETE' },
			token,
		);
		if (!response.ok && response.status !== 404) {
			const message = await response.text();
			throw new Error(
				`Failed to delete object "${objectName}" (status ${response.status}): ${message}`,
			);
		}
	}
}

export function createGcpObjectStore(env: unknown): ObjectStore {
	return new GcpObjectStore(env as EnvLike);
}
