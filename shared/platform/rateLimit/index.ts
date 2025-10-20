import { registerRateLimitBackend, createRateLimitBackend } from './backend';
import { createCloudflareRateLimitBackend } from './cloudflareBackend';
import { createGcpRateLimitBackend } from './gcpBackend';

registerRateLimitBackend('cloudflare', (env) => {
	const namespace = (env as Record<string, unknown>).DORateLimitStore as DurableObjectNamespace | undefined;
	if (!namespace) {
		throw new Error('DORateLimitStore binding is not available on this environment.');
	}
	return createCloudflareRateLimitBackend(namespace);
});

registerRateLimitBackend('gcp', (env) => createGcpRateLimitBackend(env));

export { createRateLimitBackend };
export type { RateLimitBackend, SlidingWindowConfig, RateLimitResult } from './backend';
