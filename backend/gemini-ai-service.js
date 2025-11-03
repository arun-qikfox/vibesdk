/**
 * GCP Gemini AI Service
 * Direct integration with Google's Gemini AI models (Pro & Flash)
 * Eliminates Cloudflare AI gateway dependency for Strategy B implementation
 *
 * Features:
 * - Gemini Pro: Complex reasoning for blueprint generation
 * - Gemini Flash: Fast responses for code generation
 * - Structured prompts for consistent agent behavior
 * - Direct GCP integration with proper authentication
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

// Import shared types for consistency
const { AIModels, AgentActionKey } = require('../shared/types/models');

/**
 * Gemini AI Service Configuration
 * Environment-driven configuration for different Gemini models
 */
class GeminiConfig {
    static getModels() {
        return {
            // Complex reasoning for blueprint generation and analysis
            [AIModels.GEMINI_PRO]: {
                model: 'gemini-1.5-pro-latest',
                temperature: 0.7,
                maxTokens: 4096,
                topP: 0.95,
                topK: 40
            },

            // Fast responses for code generation
            [AIModels.GEMINI_FLASH]: {
                model: 'gemini-1.5-flash-latest',
                temperature: 0.2, // Lower temperature for more deterministic code output
                maxTokens: 8192,
                topP: 0.95,
                topK: 40
            },

            // Fast and lightweight for simple tasks
            [AIModels.GEMINI_FLASH_LITE]: {
                model: 'gemini-1.0-pro',
                temperature: 0.1,
                maxTokens: 2048,
                topP: 0.8,
                topK: 20
            }
        };
    }

    static getDefaultModel(actionKey) {
        const modelMap = {
            [AgentActionKey.GENERATE_APP]: AIModels.GEMINI_PRO,
            [AgentActionKey.BLUEPRINT_GENERATION]: AIModels.GEMINI_PRO,
            [AgentActionKey.CODE_GENERATION]: AIModels.GEMINI_FLASH,
            [AgentActionKey.REVIEW_CODE]: AIModels.GEMINI_PRO,
            [AgentActionKey.ANALYZE_REQUIREMENTS]: AIModels.GEMINI_PRO,
            [AgentActionKey.TEMPLATE_SELECTION]: AIModels.GEMINI_FLASH
        };

        return modelMap[actionKey] || AIModels.GEMINI_FLASH;
    }
}

/**
 * Structured Prompts for Agent Actions
 * Predefined prompts for consistent agent behavior
 */
class AgentPrompts {
    static getBlueprintPrompt(query, templates, context = {}) {
        return {
            systemPrompt: `You are an expert software architect creating detailed execution plans for web application development.

Your task is to analyze user requirements and create a comprehensive blueprint that includes:
1. Technical stack selection (framework, libraries, tools)
2. Project structure and file organization
3. Implementation phases with clear deliverables
4. API design and data flow
5. Deployment and testing strategies

Consider the available templates and choose the most appropriate ones, or suggest modifications.

Available templates: ${templates.map(t => `${t.name}: ${t.description}`).join(', ')}

Always structure your response as valid JSON with this exact schema:
{
  "projectType": "web-app|mobile-app|api-service",
  "primaryFramework": "react|vue|svelte|nextjs|nuxt",
  "techStack": {
    "frontend": ["framework", "styling", "state-management"],
    "backend": ["runtime", "framework", "database"],
    "deployment": ["platform", "containerization"]
  },
  "projectStructure": {
    "folders": ["src", "components", "pages", "utils"],
    "keyFiles": ["package.json", "config", "entry-point"]
  },
  "implementationPhases": [
    {
      "name": "setup",
      "description": "Project initialization and dependencies",
      "deliverables": ["package.json", "folder structure"]
    }
  ],
  "apiprocessDesign": {
    "endpoints": ["/api/users", "/api/data"],
    "dataFlow": "description of how data moves through the system"
  },
  "estimatedComplexity": "low|medium|high",
  "selectedTemplate": "template-name",
  "customizationNotes": ["any modifications needed"]
}`,
            userPrompt: `Create a detailed blueprint for this application request: "${query}"

Additional context:
- User experience level: ${context.userLevel || 'intermediate'}
- Preferred technologies: ${context.preferredTech || 'modern web technologies'}
- Project scale: ${context.projectScale || 'small to medium'}
- Timeline expectations: ${context.timeline || 'standard development cycle'}

Provide a complete, actionable blueprint in the specified JSON format.`
        };
    }

    static getCodeGenerationPrompt(phase, context, existingCode = {}) {
        return {
            systemPrompt: `You are an expert software developer generating high-quality, production-ready code.

Guidelines for code generation:
1. Write clean, well-structured, and well-documented code
2. Follow language-specific best practices and conventions
3. Include proper error handling and edge cases
4. Add meaningful comments for complex logic
5. Ensure code is testable and maintainable
6. Use modern language features appropriately
7. Follow security best practices

Generate code for the "${phase}" phase based on the blueprint and existing context.`,
            userPrompt: `Generate code for the "${phase}" phase.

Blueprint context: ${JSON.stringify(context.blueprint, null, 2)}
Existing code structure: ${Object.keys(existingCode).length > 0 ? JSON.stringify(existingCode, null, 2) : 'Starting from scratch'}

Requirements:
- Phase: ${phase}
- Language: ${context.language || 'typescript'}
- Framework: ${context.framework || 'react'}
- Target files: ${context.targetFiles?.join(', ') || 'as determined by phase'}

Generate complete, functional code for this phase. Include all necessary imports, types, and implementation details.`
        };
    }

    static getReviewPrompt(code, context) {
        return {
            systemPrompt: `You are an expert code reviewer analyzing code quality, security, and best practices.

Review focus areas:
1. Code quality and maintainability
2. Security vulnerabilities and best practices
3. Performance considerations
4. Error handling and edge cases
5. Code style and conventions
6. Testing considerations

Provide actionable feedback with prioritized recommendations.`,
            userPrompt: `Review the following code for quality, security, and best practices:

Code to review:
${code}

Context:
- Language: ${context.language || 'typescript'}
- Framework: ${context.framework || 'react'}
- Component/Purpose: ${context.component || 'unknown'}
- Target environment: ${context.environment || 'modern web application'}

Provide a structured review with:
1. Overall quality assessment (1-10 scale)
2. Critical issues (security, bugs)
3. Improvement suggestions (prioritized)
4. Best practice compliance check
5. Code maintainability score`
        };
    }
}

/**
 * GCP Gemini AI Service
 * Handles direct integration with Google's Gemini AI models
 */
class GeminiAIService {
    constructor(env) {
        this.env = env;

        // Initialize Gemini AI client
        const apiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is required');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.models = GeminiConfig.getModels();

        // Setup logging
        this.logger = {
            info: (msg, data) => console.log(`[GeminiAI] ${msg}`, data || ''),
            error: (msg, error) => console.error(`[GeminiAI] ${msg}`, error),
            debug: (msg, data) => console.debug(`[GeminiAI] ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`[GeminiAI] ${msg}`, data || '')
        };
    }

    /**
     * Generate content using specified Gemini model
     */
    async generateContent(modelName, prompt, options = {}) {
        try {
            this.logger.info(`Generating content with model: ${modelName}`);

            const modelConfig = this.models[modelName];
            if (!modelConfig) {
                throw new Error(`Unknown model: ${modelName}`);
            }

            const model = this.genAI.getGenerativeModel({
                model: modelConfig.model,
                generationConfig: {
                    temperature: options.temperature || modelConfig.temperature,
                    maxOutputTokens: options.maxTokens || modelConfig.maxTokens,
                    topP: options.topP || modelConfig.topP,
                    topK: options.topK || modelConfig.topK
                }
            });

            // Handle images if provided
            let finalPrompt = prompt;
            if (options.images && options.images.length > 0) {
                // Gemini supports multimodal input - convert images to proper format
                const imageParts = await Promise.all(options.images.map(async (image) => {
                    return await this.convertImageForGemini(image);
                }));

                finalPrompt = [prompt, ...imageParts];
            }

            const result = await model.generateContent(finalPrompt);
            const response = await result.response;

            const generatedText = response.text();
            const usage = this.extractUsageInfo(response);

            this.logger.info(`Content generated successfully`, {
                model: modelName,
                inputTokens: usage?.inputTokens,
                outputTokens: usage?.outputTokens,
                totalTokens: usage?.totalTokens
            });

            return {
                text: generatedText,
                usage: {
                    inputTokens: usage?.inputTokens || 0,
                    outputTokens: usage?.outputTokens || 0,
                    totalTokens: usage?.totalTokens || 0,
                    model: modelName
                },
                metadata: {
                    model: modelName,
                    timestamp: new Date().toISOString(),
                    requestId: this.generateRequestId()
                }
            };

        } catch (error) {
            this.logger.error('Failed to generate content', error);
            throw new Error(`Gemini AI generation failed: ${error.message}`);
        }
    }

    /**
     * Blueprint generation for Strategy B agent system
     */
    async generateBlueprint(query, templates, context = {}) {
        try {
            this.logger.info('Generating blueprint with Gemini', { query: query.substring(0, 100) + '...' });

            const modelName = AIModels.GEMINI_PRO; // Always use Pro for blueprint generation
            const prompts = AgentPrompts.getBlueprintPrompt(query, templates, context);

            const fullPrompt = `${prompts.systemPrompt}\n\nUser Request:\n${prompts.userPrompt}`;

            const result = await this.generateContent(modelName, fullPrompt);
            const blueprint = this.parseBlueprintResponse(result.text);

            return {
                blueprint,
                usage: result.usage,
                metadata: result.metadata,
                rawResponse: result.text
            };

        } catch (error) {
            this.logger.error('Blueprint generation failed', error);
            throw new Error(`Blueprint generation failed: ${error.message}`);
        }
    }

    /**
     * Code generation for specific implementation phases
     */
    async generateCode(phase, context, existingCode = {}) {
        try {
            this.logger.info('Generating code with Gemini', { phase, language: context.language });

            const modelName = context.language === 'typescript' ? AIModels.GEMINI_FLASH : AIModels.GEMINI_FLASH;
            const prompts = AgentPrompts.getCodeGenerationPrompt(phase, context, existingCode);

            const fullPrompt = `${prompts.systemPrompt}\n\n${prompts.userPrompt}`;

            const result = await this.generateContent(modelName, fullPrompt, {
                temperature: 0.1, // Lower temperature for more deterministic code
                maxTokens: 8192  // Allow longer code responses
            });

            const codeBlocks = this.extractCodeBlocks(result.text);

            return {
                code: codeBlocks,
                usage: result.usage,
                metadata: result.metadata,
                rawResponse: result.text
            };

        } catch (error) {
            this.logger.error('Code generation failed', error);
            throw new Error(`Code generation failed: ${error.message}`);
        }
    }

    /**
     * Code review and quality analysis
     */
    async reviewCode(code, context = {}) {
        try {
            this.logger.info('Reviewing code with Gemini', { codeLength: code.length });

            const modelName = AIModels.GEMINI_PRO; // Use Pro for thorough review
            const prompts = AgentPrompts.getReviewPrompt(code, context);

            const fullPrompt = `${prompts.systemPrompt}\n\n${prompts.userPrompt}`;

            const result = await this.generateContent(modelName, fullPrompt);

            const review = this.parseReviewResponse(result.text);

            return {
                review,
                score: review.overallScore || 0,
                issues: review.issues || [],
                suggestions: review.suggestions || [],
                usage: result.usage,
                metadata: result.metadata
            };

        } catch (error) {
            this.logger.error('Code review failed', error);
            throw new Error(`Code review failed: ${error.message}`);
        }
    }

    /**
     * Template analysis and selection
     */
    async analyzeTemplates(query, templates) {
        try {
            this.logger.info('Analyzing templates with Gemini', { templateCount: templates.length });

            const modelName = AIModels.GEMINI_FLASH; // Fast analysis for template selection

            const prompt = `Analyze the following user query and recommend the most suitable template(s) from the available options.

User Query: "${query}"

Available Templates:
${templates.map(t => `- ${t.name}: ${t.description} (${t.language || 'typescript'}, ${t.framework || 'various'})`).join('\n')}

Respond with JSON in this format:
{
  "selectedTemplateName": "best-matching-template-name",
  "matchConfidence": 0.95,
  "reasoning": "why this template was selected",
  "alternativeTemplates": ["backup1", "backup2"],
  "customizationsNeeded": ["modification1", "modification2"]
}`;

            const result = await this.generateContent(modelName, prompt);
            const analysis = this.parseTemplateAnalysis(result.text);

            return {
                selectedTemplateName: analysis.selectedTemplateName || templates[0]?.name,
                matchConfidence: analysis.matchConfidence || 0.5,
                reasoning: analysis.reasoning || '',
                alternatives: analysis.alternativeTemplates || [],
                customizations: analysis.customizationsNeeded || [],
                usage: result.usage,
                metadata: result.metadata
            };

        } catch (error) {
            this.logger.error('Template analysis failed', error);
            // Fallback to first template
            return {
                selectedTemplateName: templates[0]?.name || 'react-app',
                matchConfidence: 0.5,
                reasoning: 'Fallback selection due to analysis error',
                alternatives: [],
                customizations: []
            };
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Convert image for Gemini multimodal input
     */
    async convertImageForGemini(image) {
        // Gemini expects images in specific format
        // Implementation depends on how images are stored/passed
        if (typeof image === 'string' && image.startsWith('data:')) {
            // Base64 data URL
            const [mimeType, base64Data] = image.split(',');
            return {
                inlineData: {
                    mimeType: mimeType.split(':')[1].split(';')[0],
                    data: base64Data
                }
            };
        }

        // For now, skip images if not in expected format
        this.logger.warn('Unsupported image format for Gemini');
        return null;
    }

    /**
     * Extract usage information from response
     */
    extractUsageInfo(response) {
        try {
            // Gemini provides usage information in response
            return {
                inputTokens: response.usageMetadata?.promptTokenCount || 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            };
        } catch (error) {
            this.logger.debug('Could not extract usage info', error);
            return null;
        }
    }

    /**
     * Generate unique request ID for tracking
     */
    generateRequestId() {
        return crypto.randomBytes(8).toString('hex');
    }

    /**
     * Parse blueprint JSON from response
     */
    parseBlueprintResponse(responseText) {
        try {
            // Extract JSON from response (handle potential markdown formatting)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            this.logger.error('Failed to parse blueprint response', error);
            // Return basic fallback structure
            return {
                projectType: 'web-app',
                primaryFramework: 'react',
                techStack: {
                    frontend: ['react', 'typescript'],
                    backend: ['nodejs'],
                    deployment: ['vercel']
                },
                projectStructure: {
                    folders: ['src', 'components', 'pages'],
                    keyFiles: ['package.json', 'tsconfig.json']
                },
                implementationPhases: [{
                    name: 'setup',
                    description: 'Project initialization',
                    deliverables: ['package.json', 'folder structure']
                }],
                estimatedComplexity: 'medium',
                selectedTemplate: 'react-app'
            };
        }
    }

    /**
     * Parse review response
     */
    parseReviewResponse(responseText) {
        try {
            // Extract structured review from response
            // This would normally parse JSON or structured text
            return {
                overallScore: this.extractScore(responseText),
                issues: this.extractIssues(responseText),
                suggestions: this.extractSuggestions(responseText)
            };
        } catch (error) {
            this.logger.error('Failed to parse review response', error);
            return {
                overallScore: 7,
                issues: [],
                suggestions: []
            };
        }
    }

    /**
     * Parse template analysis response
     */
    parseTemplateAnalysis(responseText) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch (error) {
            this.logger.error('Failed to parse template analysis', error);
            return {};
        }
    }

    /**
     * Extract code blocks from response
     */
    extractCodeBlocks(responseText) {
        const codeBlockRegex = /```(.*?)\n([\s\S]*?)```/g;
        const codeBlocks = [];
        let match;

        while ((match = codeBlockRegex.exec(responseText)) !== null) {
            const [, language, code] = match;
            codeBlocks.push({
                language: language.toLowerCase(),
                code: code.trim(),
                fileType: this.inferFileType(language)
            });
        }

        return codeBlocks.length > 0 ? codeBlocks : [{ code: responseText, language: 'text', fileType: 'unknown' }];
    }

    /**
     * Infer file type from language identifier
     */
    inferFileType(language) {
        const typeMap = {
            'typescript': 'ts',
            'javascript': 'js',
            'tsx': 'tsx',
            'jsx': 'jsx',
            'json': 'json',
            'css': 'css',
            'scss': 'scss',
            'html': 'html',
            'python': 'py',
            'java': 'java',
            'csharp': 'cs',
            'cpp': 'cpp',
            'go': 'go',
            'rust': 'rs'
        };
        return typeMap[language] || 'txt';
    }

    // Placeholder methods for response parsing - would be implemented based on actual response format
    extractScore(text) { return 7; }
    extractIssues(text) { return []; }
    extractSuggestions(text) { return []; }

    /**
     * Health check for Gemini service
     */
    async healthCheck() {
        try {
            const result = await this.generateContent(AIModels.GEMINI_FLASH_LITE, 'Hello, are you working?', {
                maxTokens: 10,
                temperature: 0
            });
            return { healthy: true, responseTime: Date.now() };
        } catch (error) {
            this.logger.error('Gemini health check failed', error);
            return { healthy: false, error: error.message };
        }
    }
}

// Export singleton factory function
function createGeminiAIService(env) {
    return new GeminiAIService(env);
}

module.exports = {
    GeminiAIService,
    createGeminiAIService,
    AgentPrompts,
    GeminiConfig
};
