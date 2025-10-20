import { getAccessToken, getProjectId, readEnvValue } from '../gcp/auth';
import type { SandboxJobAction, SandboxJobResult, SandboxJobStatus } from './jobTypes';

type EnvLike = Record<string, unknown> | undefined | null;

type FirestoreValue =
	| { stringValue: string }
	| { booleanValue: boolean }
	| { integerValue: string }
	| { doubleValue: number }
	| { nullValue: null }
	| { mapValue: { fields: Record<string, FirestoreValue> } }
	| { arrayValue: { values: FirestoreValue[] } };

type FirestoreDocument = {
	fields?: Record<string, FirestoreValue>;
};

const FIRESTORE_ENDPOINT = 'https://firestore.googleapis.com/v1';
const DEFAULT_COLLECTION = 'sandboxRuns';

function normaliseCollection(env: EnvLike): string {
	const fromEnv = readEnvValue(env, 'SANDBOX_RUN_COLLECTION');
	if (fromEnv && fromEnv.trim().length > 0) {
		return fromEnv.trim();
	}
	return DEFAULT_COLLECTION;
}

function encodeDocumentPath(collection: string, documentId: string): string {
	const safeId = encodeURIComponent(documentId);
	return `${collection}/${safeId}`;
}

function toFirestoreValue(value: unknown): FirestoreValue {
	if (value === null || value === undefined) {
		return { nullValue: null };
	}
	if (typeof value === 'string') {
		return { stringValue: value };
	}
	if (typeof value === 'boolean') {
		return { booleanValue: value };
	}
	if (typeof value === 'number') {
		if (Number.isInteger(value)) {
			return { integerValue: value.toString() };
		}
		return { doubleValue: value };
	}
	if (Array.isArray(value)) {
		return {
			arrayValue: {
				values: value.map((entry) => toFirestoreValue(entry)),
			},
		};
	}
	if (typeof value === 'object') {
		const fields: Record<string, FirestoreValue> = {};
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			fields[key] = toFirestoreValue(entry);
		}
		return { mapValue: { fields } };
	}
	return { stringValue: JSON.stringify(value) };
}

function fromFirestoreValue(value: FirestoreValue): unknown {
	if ('nullValue' in value) {
		return null;
	}
	if ('stringValue' in value) {
		return value.stringValue;
	}
	if ('booleanValue' in value) {
		return value.booleanValue;
	}
	if ('integerValue' in value) {
		return Number.parseInt(value.integerValue, 10);
	}
	if ('doubleValue' in value) {
		return value.doubleValue;
	}
	if ('arrayValue' in value) {
		const inner = value.arrayValue.values ?? [];
		return inner.map((entry) => fromFirestoreValue(entry));
	}
	if ('mapValue' in value) {
		const out: Record<string, unknown> = {};
		const fields = value.mapValue.fields ?? {};
		for (const [key, entry] of Object.entries(fields)) {
			out[key] = fromFirestoreValue(entry);
		}
		return out;
	}
	return null;
}

function toFirestoreDocument(result: SandboxJobResult): FirestoreDocument {
	const payload: Record<string, FirestoreValue> = {
		sessionId: toFirestoreValue(result.sessionId),
		action: toFirestoreValue(result.action),
		status: toFirestoreValue(result.status),
		updatedAt: toFirestoreValue(result.updatedAt),
	};
	if (result.message) {
		payload.message = toFirestoreValue(result.message);
	}
	if (result.error) {
		payload.error = toFirestoreValue(result.error);
	}
	if (result.logs) {
		payload.logs = toFirestoreValue(result.logs);
	}
	if (typeof result.output !== 'undefined') {
		payload.output = toFirestoreValue(result.output);
	}
	return { fields: payload };
}

function fromFirestoreDocument(doc?: FirestoreDocument): SandboxJobResult | null {
	if (!doc?.fields) {
		return null;
	}
	const fields = doc.fields;
	const getString = (key: string): string | undefined => {
		const value = fields[key];
		if (!value) {
			return undefined;
		}
		const decoded = fromFirestoreValue(value);
		return typeof decoded === 'string' ? decoded : JSON.stringify(decoded);
	};

	const sessionId = getString('sessionId');
	const action = getString('action') as SandboxJobAction | undefined;
	const status = getString('status') as SandboxJobStatus | undefined;
	const updatedAt = getString('updatedAt');
	if (!sessionId || !action || !status || !updatedAt) {
		return null;
	}

	const message = getString('message');
	const error = getString('error');
	const logsValue = fields.logs ? fromFirestoreValue(fields.logs) : undefined;
	const outputValue = fields.output ? fromFirestoreValue(fields.output) : undefined;

	return {
		sessionId,
		action,
		status,
		message,
		error,
		logs: Array.isArray(logsValue) ? (logsValue as string[]) : undefined,
		output: outputValue,
		updatedAt,
	};
}

export class FirestoreSandboxRunStore {
	private readonly env: EnvLike;
	private readonly collection: string;

	constructor(env: EnvLike, collection?: string) {
		this.env = env;
		this.collection = collection ?? normaliseCollection(env);
	}

	private async authorisedFetch(
		url: string,
		init: RequestInit & { method: string },
	): Promise<Response> {
		const projectId = getProjectId(this.env);
		if (!projectId) {
			throw new Error('GCP project ID is not configured. Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.');
		}
		const token = await getAccessToken(this.env);
		const headers = new Headers(init.headers ?? {});
		if (!headers.has('Authorization')) {
			headers.set('Authorization', `Bearer ${token}`);
		}
		headers.set('Content-Type', 'application/json');
		return fetch(url, { ...init, headers });
	}

	private documentUrl(documentId: string): string {
		const projectId = getProjectId(this.env);
		if (!projectId) {
			throw new Error('GCP project ID is not configured. Set GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.');
		}
		const path = encodeDocumentPath(this.collection, documentId);
		return `${FIRESTORE_ENDPOINT}/projects/${projectId}/databases/(default)/documents/${path}`;
	}

	async set(result: SandboxJobResult): Promise<void> {
		const url = this.documentUrl(result.sessionId);
		const body = JSON.stringify(toFirestoreDocument(result));
		const response = await this.authorisedFetch(url, { method: 'PATCH', body });
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to persist sandbox run (${response.status}): ${text}`);
		}
	}

	async markStatus(
		sessionId: string,
		action: SandboxJobAction,
		status: SandboxJobStatus,
		patch?: Partial<Omit<SandboxJobResult, 'sessionId' | 'action' | 'status' | 'updatedAt'>>,
	): Promise<void> {
		const now = new Date().toISOString();
		const result: SandboxJobResult = {
			sessionId,
			action,
			status,
			updatedAt: now,
			message: patch?.message,
			error: patch?.error,
			logs: patch?.logs as string[] | undefined,
			output: patch?.output,
		};
		await this.set(result);
	}

	async get(sessionId: string): Promise<SandboxJobResult | null> {
		const url = this.documentUrl(sessionId);
		const response = await this.authorisedFetch(url, { method: 'GET' });
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to read sandbox run (${response.status}): ${text}`);
		}
		const payload = (await response.json()) as FirestoreDocument;
		return fromFirestoreDocument(payload);
	}
}
