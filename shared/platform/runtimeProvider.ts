export type RuntimeProvider = 'cloudflare' | 'gcp';

const PROVIDER_KEY = 'RUNTIME_PROVIDER';

function normalizeProvider(value: unknown): RuntimeProvider {
    if (typeof value !== 'string') {
        return 'cloudflare';
    }

    const normalized = value.trim().toLowerCase();
    if (['gcp', 'google', 'google-cloud', 'gcp-cloud', 'gcp_runtime'].includes(normalized)) {
        return 'gcp';
    }

    return 'cloudflare';
}

function readProviderFromObject(source: unknown): string | undefined {
    if (source && typeof source === 'object') {
        const record = source as Record<string, unknown>;
        return typeof record[PROVIDER_KEY] === 'string' ? (record[PROVIDER_KEY] as string) : undefined;
    }
    return undefined;
}

export function getRuntimeProvider(env?: unknown): RuntimeProvider {
    const fromEnv = readProviderFromObject(env);
    if (fromEnv) {
        return normalizeProvider(fromEnv);
    }

    if (typeof process !== 'undefined' && process.env) {
        const fromProcess = process.env[PROVIDER_KEY];
        if (fromProcess) {
            return normalizeProvider(fromProcess);
        }
    }

    return 'cloudflare';
}

export function isCloudflareRuntime(env?: unknown): boolean {
    return getRuntimeProvider(env) === 'cloudflare';
}

export function isGcpRuntime(env?: unknown): boolean {
    return getRuntimeProvider(env) === 'gcp';
}
