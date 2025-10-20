export interface SlidingWindowConfig {
	limit: number;
	period: number;
	burst?: number;
	burstWindow?: number;
	bucketSize?: number;
	dailyLimit?: number;
}

export interface RateLimitResult {
	success: boolean;
	remainingLimit?: number;
}

export interface RateLimitBackend {
	increment(key: string, config: SlidingWindowConfig, incrementBy?: number): Promise<RateLimitResult>;
	getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number>;
	resetLimit(key?: string): Promise<void>;
}

type EnvRecord = Record<string, unknown>;
type Factory = (env: EnvRecord) => RateLimitBackend;

const factories: Record<string, Factory> = {};

export function registerRateLimitBackend(provider: string, factory: Factory): void {
	factories[provider] = factory;
}

export function createRateLimitBackend(provider: string, env: EnvRecord): RateLimitBackend {
	const factory = factories[provider];
	if (!factory) {
		throw new Error(`Rate limit backend for provider "${provider}" is not registered.`);
	}
	return factory(env);
}
