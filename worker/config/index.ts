import { ConfigurableSecuritySettings, getConfigurableSecurityDefaults } from "./security";
import { createLogger } from "../logger";
import { createKVProvider } from 'shared/platform/kv';

const logger = createLogger('GlobalConfigurableSettings');

let cachedConfig: GlobalConfigurableSettings | null = null;

// Per-invocation cache to avoid multiple KV calls within single worker invocation
const invocationUserCache = new Map<string, GlobalConfigurableSettings>();

/**
 *  deep merge utility for configuration objects
 * 
 * Merge rules:
 * - undefined in source: use target value (default)
 * - null/empty array/empty string in source: use source value (intentional override)
 * - objects: recursively merge
 * - primitives and arrays: source overwrites target
 */
type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>
} : T;

type MergeableValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * Type guard to check if a value should be recursively merged
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.prototype.toString.call(value) === '[object Object]'
    );
}

/**
 * Deep merge implementation with full type safety
 */
function deepMerge<T>(
    target: T,
    source: DeepPartial<T>
): T {
    // Handle null/undefined source
    if (source === null || source === undefined) {
        return target;
    }
    
    // Handle non-object targets or sources
    if (!isPlainObject(target) || !isPlainObject(source)) {
        return (source !== undefined ? source : target) as T;
    }
    
    // Safe type assertion after guard checks
    const targetObj = target as Record<string, MergeableValue>;
    const sourceObj = source as Record<string, unknown>;
    const result = { ...targetObj } as Record<string, MergeableValue>;
    
    // Merge properties
    Object.entries(sourceObj).forEach(([key, sourceValue]) => {
        // Skip undefined - means "use default"
        if (sourceValue === undefined) {
            return;
        }
        
        const targetValue = targetObj[key];
        
        // Recursive merge for nested objects
        if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        } else {
            // Direct assignment for primitives, arrays, null, or empty values
            result[key] = sourceValue as MergeableValue;
        }
    });
    
    return result as T;
}

export interface GlobalMessagingSettings {
    globalUserMessage: string;
    changeLogs: string;
}

export interface GlobalConfigurableSettings {
    security: ConfigurableSecuritySettings;
    globalMessaging: GlobalMessagingSettings;
}

type StoredConfig = DeepPartial<GlobalConfigurableSettings>;

const CONFIG_KEY = 'platform_configs';

export async function getGlobalConfigurableSettings(env: Env): Promise<GlobalConfigurableSettings> {
    console.log('[Config] getGlobalConfigurableSettings called');
    
    if (cachedConfig) {
        console.log('[Config] Returning cached configuration');
        return cachedConfig;
    }
    
    console.log('[Config] Creating default configuration');
    // Get default configuration
    const defaultConfig: GlobalConfigurableSettings = {
        security: getConfigurableSecurityDefaults(),
        globalMessaging: {
            globalUserMessage: "",
            changeLogs: ""
        }
    };
    
    try {
        console.log('[Config] Creating KV provider');
        // Try to fetch override config from KV
        const kv = createKVProvider(env);
        console.log('[Config] KV provider created, fetching config with key:', CONFIG_KEY);
        
        const storedConfig = await kv.get<StoredConfig>(CONFIG_KEY);
        console.log('[Config] KV get result:', { 
            hasResult: !!storedConfig, 
            resultType: typeof storedConfig,
            isObject: storedConfig && typeof storedConfig === 'object'
        });
        
        if (!storedConfig) {
            console.log('[Config] No stored config found, using defaults');
            // No stored config, use defaults
            return defaultConfig;
        }
        
        console.log('[Config] Using stored configuration directly');
        // Stored configuration is already parsed by the KV provider
        
        console.log('[Config] Merging configurations');
        // Deep merge configurations (stored config overrides defaults)
        const mergedConfig = deepMerge<GlobalConfigurableSettings>(defaultConfig, storedConfig);
        
        logger.info('Loaded configuration with overrides from KV', { storedConfig, mergedConfig });
        cachedConfig = mergedConfig;
        console.log('[Config] Configuration loaded successfully from KV');
        return mergedConfig;
        
    } catch (error) {
        console.log('[Config] Error loading configuration from KV:', error);
        logger.error('Failed to load configuration from KV, using defaults', error);
        // On error, fallback to default configuration
        return defaultConfig;
    }
}

export async function getUserConfigurableSettings(env: Env, userId: string): Promise<GlobalConfigurableSettings> {
    const globalConfig = await getGlobalConfigurableSettings(env);
    if (!userId) {
        return globalConfig;
    }

    if (invocationUserCache.has(userId)) {
        const conf = invocationUserCache.get(userId)!
        logger.info(`Using cached configuration for user ${userId}`, conf);
        return conf;
    }
    try {
        // Try to fetch override config from KV
        const kv = createKVProvider(env);
        const storedConfig = await kv.get<StoredConfig>(`user_config:${userId}`);
        
        if (!storedConfig) {
            // No stored config, use defaults
            return globalConfig;
        }
        
        // Stored configuration is already parsed by the KV provider
        
        // Deep merge configurations (stored config overrides defaults)
        const mergedConfig = deepMerge<GlobalConfigurableSettings>(globalConfig, storedConfig);
        
        logger.info(`Loaded configuration with overrides from KV for user ${userId}`, { globalConfig, storedConfig, mergedConfig });
        invocationUserCache.set(userId, mergedConfig);
        return mergedConfig;
        
    } catch (error) {
        logger.error(`Failed to load configuration from KV for user ${userId}, using defaults`, error);
        // On error, fallback to default configuration
        return globalConfig;
    }
}
    
