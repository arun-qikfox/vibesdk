import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';

export function createCloudflareRateLimitBackend(namespace: DurableObjectNamespace): RateLimitBackend {
	return {
		async increment(key: string, config: SlidingWindowConfig, incrementBy = 1): Promise<RateLimitResult> {
			const stub = namespace.get(namespace.idFromName(key));
			const result = await stub.increment(key, config, incrementBy);
			return {
				success: result.success,
				remainingLimit: result.remainingLimit,
			};
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			const stub = namespace.get(namespace.idFromName(key));
			return stub.getRemainingLimit(key, config);
		},

		async resetLimit(key?: string): Promise<void> {
			const stub = namespace.get(namespace.idFromName(key ?? 'default'));
			await stub.resetLimit(key);
		},
	};
}
