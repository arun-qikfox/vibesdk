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

type EnvLike = Record<string, unknown> | undefined;

export function getRuntimeProvider(env?: EnvLike): RuntimeProvider {
    const fromEnv = env && typeof env[PROVIDER_KEY] !== 'undefined' ? env[PROVIDER_KEY] : undefined;
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

export function isCloudflareRuntime(env?: EnvLike): boolean {
    return getRuntimeProvider(env) === 'cloudflare';
}

export function isGcpRuntime(env?: EnvLike): boolean {
    return getRuntimeProvider(env) === 'gcp';
}

