import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';

export function createCloudflareRateLimitBackend(namespace: DurableObjectNamespace): RateLimitBackend {
	return {
		async increment(key: string, config: SlidingWindowConfig, incrementBy = 1): Promise<RateLimitResult> {
			const stub = namespace.get(namespace.idFromName(key));
			const result = await stub.fetch(new Request('https://dummy/increment', {
				method: 'POST',
				body: JSON.stringify({ key, config, incrementBy })
			}));
			const data = await result.json() as RateLimitResult;
			return data;
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			const stub = namespace.get(namespace.idFromName(key));
			const result = await stub.fetch(new Request('https://dummy/remaining', {
				method: 'POST',
				body: JSON.stringify({ key, config })
			}));
			const data = await result.json() as { remainingLimit: number };
			return data.remainingLimit;
		},

		async resetLimit(key?: string): Promise<void> {
			const stub = namespace.get(namespace.idFromName(key ?? 'default'));
			await stub.fetch(new Request('https://dummy/reset', {
				method: 'POST',
				body: JSON.stringify({ key })
			}));
		},
	};
}
