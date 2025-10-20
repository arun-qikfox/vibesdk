import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createDatabaseService } from 'worker/database';
import type { DatabaseRuntimeEnv } from 'worker/database/runtime/types';
import { rateLimitBuckets } from 'worker/database/schema';
import type { RateLimitBackend, RateLimitResult, SlidingWindowConfig } from './backend';

type EnvRecord = Record<string, unknown>;

const TABLE_DDL = sql`
	CREATE TABLE IF NOT EXISTS rate_limit_buckets (
		key TEXT NOT NULL,
		window_start BIGINT NOT NULL,
		count INTEGER NOT NULL DEFAULT 0,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (key, window_start)
	)
`;

function computeWindows(config: SlidingWindowConfig) {
	const now = Date.now();
	const bucketSizeMs = (config.bucketSize ?? 10) * 1000;
	const mainWindowMs = config.period * 1000;
	const burstWindowMs = (config.burstWindow ?? config.period) * 1000;
	const dailyWindowMs = config.dailyLimit ? 24 * 60 * 60 * 1000 : 0;

	const currentBucket = Math.floor(now / bucketSizeMs) * bucketSizeMs;
	const windows = {
		now,
		bucketSizeMs,
		currentBucket,
		mainWindowMs,
		burstWindowMs,
		dailyWindowMs,
		maxWindow: Math.max(mainWindowMs, burstWindowMs, dailyWindowMs),
	};
	return windows;
}

export function createGcpRateLimitBackend(env: EnvRecord): RateLimitBackend {
	const dbService = createDatabaseService(env as unknown as DatabaseRuntimeEnv);
	const db = dbService.db as PostgresJsDatabase;

	let ensured = false;
	async function ensureTable() {
		if (!ensured) {
			await db.execute(TABLE_DDL);
			ensured = true;
		}
	}

	function sumCounts(rows: Array<{ windowStart: number; count: number }>, threshold: number) {
		return rows
			.filter((row) => row.windowStart >= threshold)
			.reduce((sum, row) => sum + row.count, 0);
	}

	return {
		async increment(key: string, config: SlidingWindowConfig, incrementBy = 1): Promise<RateLimitResult> {
			await ensureTable();

			const windows = computeWindows(config);
			const earliestWindowStart =
				Math.floor((windows.now - windows.maxWindow) / windows.bucketSizeMs) * windows.bucketSizeMs;

			const result = await db.transaction(async (tx) => {
				const rows = await tx
					.select({
						windowStart: rateLimitBuckets.windowStart,
						count: rateLimitBuckets.count,
					})
					.from(rateLimitBuckets)
					.where(
						and(
							eq(rateLimitBuckets.key, key),
							gte(rateLimitBuckets.windowStart, earliestWindowStart),
						),
					);

				const mainCount = sumCounts(rows, windows.now - windows.mainWindowMs);
				if (mainCount + incrementBy > config.limit) {
					return { success: false, remainingLimit: 0 };
				}

				if (config.burst) {
					const burstCount = sumCounts(rows, windows.now - windows.burstWindowMs);
					if (burstCount + incrementBy > config.burst) {
						return { success: false, remainingLimit: 0 };
					}
				}

				if (config.dailyLimit) {
					const dailyCount = sumCounts(rows, windows.now - windows.dailyWindowMs);
					if (dailyCount + incrementBy > config.dailyLimit) {
						return { success: false, remainingLimit: 0 };
					}
				}

				await tx
					.insert(rateLimitBuckets)
					.values({
						key,
						windowStart: windows.currentBucket,
						count: incrementBy,
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
						set: {
							count: sql`${rateLimitBuckets.count} + ${incrementBy}`,
							updatedAt: sql`NOW()`,
						},
					});

				await tx
					.delete(rateLimitBuckets)
					.where(
						and(
							eq(rateLimitBuckets.key, key),
							lt(rateLimitBuckets.windowStart, earliestWindowStart),
						),
					);

				const updatedRows = await tx
					.select({
						windowStart: rateLimitBuckets.windowStart,
						count: rateLimitBuckets.count,
					})
					.from(rateLimitBuckets)
					.where(
						and(
							eq(rateLimitBuckets.key, key),
							gte(rateLimitBuckets.windowStart, windows.now - windows.mainWindowMs),
						),
					);

				const totalCount = updatedRows.reduce((sum, row) => sum + row.count, 0);
				const remaining = Math.max(0, config.limit - totalCount);

				return {
					success: true,
					remainingLimit: remaining,
				};
			});

			return result;
		},

		async getRemainingLimit(key: string, config: SlidingWindowConfig): Promise<number> {
			await ensureTable();

			const windows = computeWindows(config);
			const rows = await db
				.select({
					windowStart: rateLimitBuckets.windowStart,
					count: rateLimitBuckets.count,
				})
				.from(rateLimitBuckets)
				.where(
					and(
						eq(rateLimitBuckets.key, key),
						gte(rateLimitBuckets.windowStart, windows.now - windows.mainWindowMs),
					),
				);

				const total = rows.reduce((sum, row) => sum + row.count, 0);
				return Math.max(0, config.limit - total);
		},

		async resetLimit(key?: string): Promise<void> {
			await ensureTable();

			if (key) {
				await db.delete(rateLimitBuckets).where(eq(rateLimitBuckets.key, key));
			} else {
				await db.delete(rateLimitBuckets);
			}
		},
	};
}
