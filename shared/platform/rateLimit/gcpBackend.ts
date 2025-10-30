import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';

type EnvRecord = Record<string, unknown>;

function notImplemented(method: string): never {
	throw new Error('GCP rate limit backend is not implemented. Attempted to call ' + method + '.');
}

export function createGcpRateLimitBackend(_env: EnvRecord): RateLimitBackend {
	return {
		async increment(_key: string, _config: SlidingWindowConfig, _incrementBy = 1): Promise<RateLimitResult> {
			notImplemented('increment');
		},

		async getRemainingLimit(_key: string, _config: SlidingWindowConfig): Promise<number> {
			notImplemented('getRemainingLimit');
		},

		async resetLimit(_key?: string): Promise<void> {
			notImplemented('resetLimit');
		},
	};
}
