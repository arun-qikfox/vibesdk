/**
 * Shared AI Model and Action Type Definitions
 * Used across Cloudflare Workers and GCP implementations
 */

// AI Model identifiers for different providers and capabilities
export enum AIModels {
    // Google Gemini models
    GEMINI_PRO = 'gemini-pro',
    GEMINI_FLASH = 'gemini-flash',
    GEMINI_FLASH_LITE = 'gemini-flash-lite',

    // Legacy Cloudflare models (for backward compatibility)
    CLOUDFLARE_GEMINI_PRO = '@cf/google/gemini-pro',
    CLOUDFLARE_GEMINI_FLASH = '@cf/google/gemini-flash'
}

// Agent action keys for different AI operations
export enum AgentActionKey {
    // Core agent operations
    GENERATE_APP = 'generate_app',
    BLUEPRINT_GENERATION = 'blueprint_generation',
    CODE_GENERATION = 'code_generation',
    REVIEW_CODE = 'review_code',
    ANALYZE_REQUIREMENTS = 'analyze_requirements',
    TEMPLATE_SELECTION = 'template_selection',

    // Additional operations
    FIX_CODE = 'fix_code',
    OPTIMIZE_CODE = 'optimize_code',
    DOCUMENT_CODE = 'document_code',
    TEST_GENERATION = 'test_generation'
}

// Model capability flags
export interface ModelCapabilities {
    supportsImages: boolean;
    supportsStructuredOutput: boolean;
    maxTokens: number;
    supportsFunctionCalling: boolean;
    contextWindow: number;
}

// Model configurations by provider
export const MODEL_CONFIGURATIONS: Record<AIModels, ModelCapabilities> = {
    [AIModels.GEMINI_PRO]: {
        supportsImages: true,
        supportsStructuredOutput: true,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        contextWindow: 1048576 // 1M tokens
    },
    [AIModels.GEMINI_FLASH]: {
        supportsImages: true,
        supportsStructuredOutput: true,
        maxTokens: 8192,
        supportsFunctionCalling: true,
        contextWindow: 1048576
    },
    [AIModels.GEMINI_FLASH_LITE]: {
        supportsImages: false,
        supportsStructuredOutput: false,
        maxTokens: 2048,
        supportsFunctionCalling: false,
        contextWindow: 32768
    },
    [AIModels.CLOUDFLARE_GEMINI_PRO]: {
        supportsImages: true,
        supportsStructuredOutput: true,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        contextWindow: 32768
    },
    [AIModels.CLOUDFLARE_GEMINI_FLASH]: {
        supportsImages: true,
        supportsStructuredOutput: true,
        maxTokens: 8192,
        supportsFunctionCalling: true,
        contextWindow: 32768
    }
};

// Action to model mapping for automatic model selection
export const ACTION_MODEL_MAPPING: Record<AgentActionKey, AIModels[]> = {
    [AgentActionKey.GENERATE_APP]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO],
    [AgentActionKey.BLUEPRINT_GENERATION]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO],
    [AgentActionKey.CODE_GENERATION]: [AIModels.GEMINI_FLASH, AIModels.CLOUDFLARE_GEMINI_FLASH],
    [AgentActionKey.REVIEW_CODE]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO],
    [AgentActionKey.ANALYZE_REQUIREMENTS]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO],
    [AgentActionKey.TEMPLATE_SELECTION]: [AIModels.GEMINI_FLASH, AIModels.CLOUDFLARE_GEMINI_FLASH],
    [AgentActionKey.FIX_CODE]: [AIModels.GEMINI_FLASH, AIModels.CLOUDFLARE_GEMINI_FLASH],
    [AgentActionKey.OPTIMIZE_CODE]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO],
    [AgentActionKey.DOCUMENT_CODE]: [AIModels.GEMINI_FLASH, AIModels.CLOUDFLARE_GEMINI_FLASH],
    [AgentActionKey.TEST_GENERATION]: [AIModels.GEMINI_PRO, AIModels.CLOUDFLARE_GEMINI_PRO]
};

// Helper functions
export function getModelCapabilities(model: AIModels): ModelCapabilities {
    return MODEL_CONFIGURATIONS[model] || MODEL_CONFIGURATIONS[AIModels.GEMINI_FLASH];
}

export function getPreferredModelForAction(action: AgentActionKey, availableModels: AIModels[]): AIModels {
    const preferredModels = ACTION_MODEL_MAPPING[action] || [AIModels.GEMINI_FLASH];

    // Return first available preferred model
    for (const model of preferredModels) {
        if (availableModels.includes(model)) {
            return model;
        }
    }

    // Fallback to first available model
    return availableModels[0] || AIModels.GEMINI_FLASH;
}

export function isGeminiModel(model: AIModels): boolean {
    return model.toString().includes('gemini');
}

export function isCloudflareModel(model: AIModels): boolean {
    return model.toString().startsWith('@cf/');
}
