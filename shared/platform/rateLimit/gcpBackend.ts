import { Firestore } from '@google-cloud/firestore';
import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';
import { getProjectId } from '../gcp/auth';

type EnvRecord = Record<string, unknown>;

type TokenBucketDocument = {
	key: string;
	tokens: number;
	lastRefill: number;
	dayStart: number;
	dailySpent: number;
	capacity: number;
	limit: number;
	periodMs: number;
	updatedAt: number;
};

type TokenBucketState = {
	tokens: number;
	lastRefill: number;
	dayStart: number;
	dailySpent: number;
};

const COLLECTION = 'rate_limit_buckets';
const firestoreClients = new Map<string, Firestore>();
const memoryBuckets = new Map<string, TokenBucketState>();

function nowMs(): number {
	return Date.now();
}

function startOfUtcDay(ms: number): number {
	const date = new Date(ms);
	date.setUTCHours(0, 0, 0, 0);
	return date.getTime();
}

function resolveCapacity(config: SlidingWindowConfig): number {
	const candidates = [
		config.burst,
		config.bucketSize,
		config.limit,
	].filter((value) => typeof value === 'number' && Number.isFinite(value) && value! > 0) as number[];
	return candidates.length > 0 ? Math.max(...candidates) : 1;
}

function resolveLimit(config: SlidingWindowConfig): number {
	return typeof config.limit === 'number' && Number.isFinite(config.limit) && config.limit > 0
		? config.limit
		: 1;
}

function resolvePeriodMs(config: SlidingWindowConfig): number {
	return typeof config.period === 'number' && Number.isFinite(config.period) && config.period > 0
		? config.period * 1000
		: 1000;
}

function ensureFirestore(env: EnvRecord): Firestore | null {
	try {
		const projectId = getProjectId(env);
		if (!projectId) {
			console.warn('[GCP RateLimit] GCP_PROJECT_ID is not configured; falling back to in-memory rate limiting.');
			return null;
		}
		if (firestoreClients.has(projectId)) {
			return firestoreClients.get(projectId)!;
		}
		const client = new Firestore({ projectId });
		firestoreClients.set(projectId, client);
		return client;
	} catch (error) {
		console.warn('[GCP RateLimit] Firestore client unavailable; falling back to in-memory rate limiting.', error);
		return null;
	}
}

function getMinRemaining(tokens: number, dailyRemaining: number | null): number {
	if (dailyRemaining === null) {
		return Math.max(0, Math.floor(tokens));
	}
	return Math.max(0, Math.floor(Math.min(tokens, dailyRemaining)));
}

function refillTokens(
	now: number,
	state: TokenBucketState,
	capacity: number,
	refillRatePerMs: number,
): TokenBucketState {
	const elapsed = Math.max(0, now - state.lastRefill);
	let tokens = state.tokens;
	if (elapsed > 0 && refillRatePerMs > 0) {
		const refill = elapsed * refillRatePerMs;
		tokens = Math.min(capacity, tokens + refill);
	}
	return {
		...state,
		tokens,
		lastRefill: now,
	};
}

function applyDailyReset(now: number, state: TokenBucketState): TokenBucketState {
	const currentDayStart = startOfUtcDay(now);
	if (state.dayStart !== currentDayStart) {
		return {
			...state,
			dayStart: currentDayStart,
			dailySpent: 0,
		};
	}
	return state;
}

function createInitialState(capacity: number, now: number): TokenBucketState {
	return {
		tokens: capacity,
		lastRefill: now,
		dayStart: startOfUtcDay(now),
		dailySpent: 0,
	};
}

function toDocument(
	key: string,
	state: TokenBucketState,
	capacity: number,
	limit: number,
	periodMs: number,
	now: number,
): TokenBucketDocument {
	return {
		key,
		tokens: Math.max(0, state.tokens),
		lastRefill: state.lastRefill,
		dayStart: state.dayStart,
		dailySpent: state.dailySpent,
		capacity,
		limit,
		periodMs,
		updatedAt: now,
	};
}

async function withMemoryBucket<T>(
	key: string,
	config: SlidingWindowConfig,
	incrementBy: number,
	callback: (state: TokenBucketState, capacity: number, limit: number, periodMs: number) => T,
): Promise<T> {
	const now = nowMs();
	const capacity = resolveCapacity(config);
	const limit = resolveLimit(config);
	const periodMs = resolvePeriodMs(config);
	const refillRatePerMs = limit / periodMs;

	const current = memoryBuckets.get(key) ?? createInitialState(capacity, now);
	let state = applyDailyReset(now, current);
	state = refillTokens(now, state, capacity, refillRatePerMs);

	const result = callback(state, capacity, limit, periodMs);

	if ((result as RateLimitResult).success === true) {
		state.tokens = Math.max(0, state.tokens - incrementBy);
		state.dailySpent += incrementBy;
	}

	memoryBuckets.set(key, state);
	return result;
}

function createInMemoryBackend(): RateLimitBackend {
	return {
		async increment(
			key: string,
			config: SlidingWindowConfig,
			incrementBy = 1,
		): Promise<RateLimitResult> {
			return withMemoryBucket(key, config, incrementBy, (state, capacity, limit, periodMs) => {
				const refillRatePerMs = limit / periodMs;
				const dailyLimit = typeof config.dailyLimit === 'number' && config.dailyLimit > 0 ? config.dailyLimit : null;
				const now = nowMs();
				const dailyRemaining =
					dailyLimit !== null ? Math.max(0, dailyLimit - state.dailySpent) : null;
				const remainingTokens = state.tokens;
				const remaining = getMinRemaining(remainingTokens, dailyRemaining);
				if (dailyRemaining !== null && incrementBy > dailyRemaining) {
					return { success: false, remainingLimit: remaining };
				}
				if (remainingTokens < incrementBy) {
					return { success: false, remainingLimit: remaining };
				}
				return { success: true, remainingLimit: Math.max(0, remaining - incrementBy) };
			});
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			const now = nowMs();
			const capacity = resolveCapacity(config);
			const limit = resolveLimit(config);
			const periodMs = resolvePeriodMs(config);
			const refillRatePerMs = limit / periodMs;
			const state = memoryBuckets.get(key) ?? createInitialState(capacity, now);
			let updated = applyDailyReset(now, state);
			updated = refillTokens(now, updated, capacity, refillRatePerMs);
			const dailyLimit = typeof config.dailyLimit === 'number' && config.dailyLimit > 0 ? config.dailyLimit : null;
			return getMinRemaining(updated.tokens, dailyLimit !== null ? dailyLimit - updated.dailySpent : null);
		},

		async resetLimit(key?: string): Promise<void> {
			if (key) {
				memoryBuckets.delete(key);
			} else {
				memoryBuckets.clear();
			}
		},
	};
}

function createFirestoreBackend(firestore: Firestore): RateLimitBackend {
	const collection = firestore.collection(COLLECTION);

	return {
		async increment(
			key: string,
			config: SlidingWindowConfig,
			incrementBy = 1,
		): Promise<RateLimitResult> {
			const now = nowMs();
			const capacity = resolveCapacity(config);
			const limit = resolveLimit(config);
			const periodMs = resolvePeriodMs(config);
			const refillRatePerMs = limit / periodMs;
			const dailyLimit =
				typeof config.dailyLimit === 'number' && config.dailyLimit > 0 ? config.dailyLimit : null;

			const docRef = collection.doc(key);

			return firestore.runTransaction(async (tx) => {
				const snapshot = await tx.get(docRef);
				let state: TokenBucketState;

				if (!snapshot.exists) {
					state = createInitialState(capacity, now);
				} else {
					const data = snapshot.data() as Partial<TokenBucketDocument>;
					state = {
						tokens: typeof data.tokens === 'number' ? data.tokens : capacity,
						lastRefill: typeof data.lastRefill === 'number' ? data.lastRefill : now,
						dayStart: typeof data.dayStart === 'number' ? data.dayStart : startOfUtcDay(now),
						dailySpent: typeof data.dailySpent === 'number' ? data.dailySpent : 0,
					};
				}

				state = applyDailyReset(now, state);
				state = refillTokens(now, state, capacity, refillRatePerMs);

				const dailyRemaining =
					dailyLimit !== null ? Math.max(0, dailyLimit - state.dailySpent) : null;
				const remainingTokens = state.tokens;
				const remaining = getMinRemaining(remainingTokens, dailyRemaining);

				if (dailyRemaining !== null && incrementBy > dailyRemaining) {
					await tx.set(
						toDocument(key, state, capacity, limit, periodMs, now),
						{ merge: true },
					);
					return { success: false, remainingLimit: remaining };
				}

				if (remainingTokens < incrementBy) {
					await tx.set(
						toDocument(key, state, capacity, limit, periodMs, now),
						{ merge: true },
					);
					return { success: false, remainingLimit: remaining };
				}

				state.tokens = Math.max(0, state.tokens - incrementBy);
				state.dailySpent += incrementBy;

				await tx.set(
					toDocument(key, state, capacity, limit, periodMs, now),
					{ merge: true },
				);

				const updatedDailyRemaining =
					dailyLimit !== null ? Math.max(0, dailyLimit - state.dailySpent) : null;

				return {
					success: true,
					remainingLimit: getMinRemaining(state.tokens, updatedDailyRemaining),
				};
			});
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			const now = nowMs();
			const capacity = resolveCapacity(config);
			const limit = resolveLimit(config);
			const periodMs = resolvePeriodMs(config);
			const refillRatePerMs = limit / periodMs;
			const dailyLimit =
				typeof config.dailyLimit === 'number' && config.dailyLimit > 0 ? config.dailyLimit : null;

			const docRef = collection.doc(key);
			const result = await firestore.runTransaction(async (tx) => {
				const snapshot = await tx.get(docRef);

				let state: TokenBucketState;
				if (!snapshot.exists) {
					state = createInitialState(capacity, now);
				} else {
					const data = snapshot.data() as Partial<TokenBucketDocument>;
					state = {
						tokens: typeof data.tokens === 'number' ? data.tokens : capacity,
						lastRefill: typeof data.lastRefill === 'number' ? data.lastRefill : now,
						dayStart: typeof data.dayStart === 'number' ? data.dayStart : startOfUtcDay(now),
						dailySpent: typeof data.dailySpent === 'number' ? data.dailySpent : 0,
					};
				}

				state = applyDailyReset(now, state);
				state = refillTokens(now, state, capacity, refillRatePerMs);

				await tx.set(
					toDocument(key, state, capacity, limit, periodMs, now),
					{ merge: true },
				);

				return {
					tokens: state.tokens,
					dailySpent: state.dailySpent,
				};
			});

			const dailyRemaining =
				dailyLimit !== null ? Math.max(0, dailyLimit - result.dailySpent) : null;

			return getMinRemaining(result.tokens, dailyRemaining);
		},

		async resetLimit(key?: string): Promise<void> {
			if (key) {
				await collection.doc(key).delete();
				return;
			}
			// Full reset: delete documents in batches to avoid timeouts.
			const snapshot = await collection.limit(500).get();
			if (snapshot.empty) {
				return;
			}
			const batch = firestore.batch();
			snapshot.docs.forEach((doc) => batch.delete(doc.ref));
			await batch.commit();
		},
	};
}

export function createGcpRateLimitBackend(env: EnvRecord): RateLimitBackend {
	const firestore = ensureFirestore(env);
	if (!firestore) {
		return createInMemoryBackend();
	}
	return createFirestoreBackend(firestore);
}
