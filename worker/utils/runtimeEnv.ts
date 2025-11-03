type EnvLike = Record<string, unknown>;

let cachedEnv: EnvLike | null = null;

function loadFromGlobal(): EnvLike | null {
    if (typeof globalThis !== 'undefined' && (globalThis as any).env) {
        return (globalThis as any).env as EnvLike;
    }
    return null;
}

export function getRuntimeEnv(): EnvLike {
    if (cachedEnv) {
        return cachedEnv;
    }

    const globalEnv = loadFromGlobal();
    if (globalEnv) {
        cachedEnv = globalEnv;
        return cachedEnv;
    }

    if (typeof process !== 'undefined' && process.env) {
        cachedEnv = process.env as unknown as EnvLike;
        return cachedEnv;
    }

    cachedEnv = {};
    return cachedEnv;
}
