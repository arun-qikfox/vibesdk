import type { Env } from '../types/env';
import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import { createRateLimitBackend } from 'shared/platform/rateLimit';
import type { RateLimitBackend } from 'shared/platform/rateLimit';

type EnvRecord = Record<string, unknown>;

export function getRateLimitBackend(env: Env): RateLimitBackend | null {
	const record = env as unknown as EnvRecord;
	if (record.RateLimitBackend && typeof record.RateLimitBackend === 'object') {
		return record.RateLimitBackend as RateLimitBackend;
	}

	try {
		const backend = createRateLimitBackend(getRuntimeProvider(env), record);
		record.RateLimitBackend = backend;
		return backend;
	} catch (error) {
		console.warn('Rate limit backend unavailable', error);
		return null;
	}
}
