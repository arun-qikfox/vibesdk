import { getRuntimeProvider } from 'shared/platform/runtimeProvider';
import type { KVProvider } from './types';
import { createCloudflareKVProvider } from './cloudflareKVProvider';
import { createGcpStorageKVProvider } from './gcpStorageProvider';

export function createKVProvider(env: unknown): KVProvider {
	console.log('[KV] createKVProvider called with env:', {
		hasEnv: !!env,
		envKeys: env ? Object.keys(env as Record<string, unknown>) : [],
		runtimeProvider: getRuntimeProvider(env)
	});

	const provider = getRuntimeProvider(env);
	console.log('[KV] Detected runtime provider:', provider);

	if (provider === 'gcp') {
		console.log('[KV] Creating GCP Storage KV provider');
		const gcpProvider = createGcpStorageKVProvider(env);
		console.log('[KV] GCP Storage KV provider created successfully');
		return gcpProvider;
	}

	console.log('[KV] Creating Cloudflare KV provider');
	const cfProvider = createCloudflareKVProvider(env);
	console.log('[KV] Cloudflare KV provider created successfully');
	return cfProvider;
}

export type { KVProvider, KVListOptions, KVListResult, KVPutOptions } from './types';
