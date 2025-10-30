import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';

type RateLimitObjectStub = {
	increment(key: string, config: SlidingWindowConfig, incrementBy: number): Promise<RateLimitResult>;
	getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number>;
	resetLimit(key?: string): Promise<void>;
};

export function createCloudflareRateLimitBackend(namespace: DurableObjectNamespace): RateLimitBackend {
	return {
		async increment(key: string, config: SlidingWindowConfig, incrementBy = 1): Promise<RateLimitResult> {
			const stub = namespace.get(namespace.idFromName(key)) as unknown as RateLimitObjectStub;
			const result = await stub.increment(key, config, incrementBy);
			return {
				success: result.success,
				remainingLimit: result.remainingLimit,
			};
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			const stub = namespace.get(namespace.idFromName(key)) as unknown as RateLimitObjectStub;
			return stub.getRemainingLimit(key, config);
		},

		async resetLimit(key?: string): Promise<void> {
			const stub = namespace.get(namespace.idFromName(key ?? 'default')) as unknown as RateLimitObjectStub;
			await stub.resetLimit(key);
		},
	};
}
