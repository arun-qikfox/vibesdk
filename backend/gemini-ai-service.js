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

// Ensure fetch is available globally for Google Generative AI in Node environments
if (typeof global.fetch !== 'function') {
    global.fetch = async (...args) => {
        const { default: fetch } = await import('node-fetch');
        return fetch(...args);
    };
}

const agentConfigModulePromise = import('../worker/agents/inferutils/config.ts')
    .catch((error) => {
        console.warn('[GeminiAI] Failed to import agent config, using defaults', error);
        return { AGENT_CONFIG: {} };
    });

const DEFAULT_GENERATION_SETTINGS = {
    temperature: 0.2,
    maxTokens: 2048,
    topP: 0.95,
    topK: 40,
};

function normalizeModelName(modelName) {
    if (!modelName || typeof modelName !== 'string') {
        return '';
    }
    return modelName.replace(/^google-ai-studio\//, '');
}

function effectiveTemperature(config = {}, overrides = {}) {
    if (overrides.temperature != null) {
        return overrides.temperature;
    }
    if (config.temperature != null) {
        return config.temperature;
    }
    return DEFAULT_GENERATION_SETTINGS.temperature;
}

function effectiveMaxTokens(config = {}, overrides = {}) {
    if (overrides.maxTokens != null) {
        return overrides.maxTokens;
    }
    if (config.max_tokens != null) {
        return config.max_tokens;
    }
    return DEFAULT_GENERATION_SETTINGS.maxTokens;
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

        // Configure Google Generative AI for Node.js environment
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.agentConfig = null;
        this.agentConfigPromise = agentConfigModulePromise
            .then((module) => module.AGENT_CONFIG || {})
            .catch((error) => {
                console.warn('[GeminiAI] Unable to load agent configuration. Using defaults.', error);
                return {};
            });

        // Setup logging
        this.logger = {
            info: (msg, data) => console.log(`[GeminiAI] ${msg}`, data || ''),
            error: (msg, error) => console.error(`[GeminiAI] ${msg}`, error),
            debug: (msg, data) => console.debug(`[GeminiAI] ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`[GeminiAI] ${msg}`, data || '')
        };
    }

    async loadAgentConfig() {
        if (this.agentConfig) {
            return this.agentConfig;
        }
        this.agentConfig = await this.agentConfigPromise;
        return this.agentConfig;
    }

    async getActionConfig(actionKey) {
        const config = (await this.loadAgentConfig())[actionKey];
        return config || {};
    }

    /**
     * Generate content using specified Gemini model
     */
    async generateContent(modelName, prompt, options = {}, depth = 0) {
        try {
            const normalizedModel = normalizeModelName(modelName);
            if (!normalizedModel) {
                throw new Error('Gemini model name is not configured.');
            }

            this.logger.info(`Generating content with model: ${normalizedModel}`);

            const model = this.genAI.getGenerativeModel({
                model: normalizedModel,
                generationConfig: {
                    temperature: options.temperature ?? DEFAULT_GENERATION_SETTINGS.temperature,
                    maxOutputTokens: options.maxTokens ?? DEFAULT_GENERATION_SETTINGS.maxTokens,
                    topP: options.topP ?? DEFAULT_GENERATION_SETTINGS.topP,
                    topK: options.topK ?? DEFAULT_GENERATION_SETTINGS.topK,
                    ...(options.responseMimeType && { responseMimeType: options.responseMimeType })
                }
            });

            let finalPrompt = prompt;
            if (options.images && options.images.length > 0) {
                const imageParts = await Promise.all(options.images.map(async (image) => this.convertImageForGemini(image)));
                finalPrompt = [prompt, ...imageParts.filter(Boolean)];
            }

            const result = await model.generateContent(finalPrompt);
            const response = await result.response;

            const generatedText = await this.extractTextFromResponse(response);
            const usage = this.extractUsageInfo(response);

            if (!generatedText && options.fallbackModel && depth === 0) {
                this.logger.warn('Primary Gemini model returned empty text content, attempting fallback', {
                    primary: normalizedModel,
                    fallback: options.fallbackModel
                });
                return this.generateContent(options.fallbackModel, prompt, { ...options, fallbackModel: undefined }, depth + 1);
            }

            if (!generatedText) {
                this.logger.warn('Gemini AI returned empty text content', { model: normalizedModel });
            }

            this.logger.info('Content generated successfully', {
                model: normalizedModel,
                inputTokens: usage?.inputTokens,
                outputTokens: usage?.outputTokens,
                totalTokens: usage?.totalTokens
            });

            return {
                text: generatedText || '',
                usage: {
                    inputTokens: usage?.inputTokens || 0,
                    outputTokens: usage?.outputTokens || 0,
                    totalTokens: usage?.totalTokens || 0,
                    model: normalizedModel
                },
                metadata: {
                    model: normalizedModel,
                    timestamp: new Date().toISOString(),
                    requestId: this.generateRequestId()
                }
            };

        } catch (error) {
            this.logger.error('Failed to generate content', error);

            if (options.fallbackModel && depth === 0) {
                this.logger.warn('Retrying Gemini request with fallback model due to error', {
                    primary: normalizedModel,
                    fallback: options.fallbackModel
                });
                return this.generateContent(options.fallbackModel, prompt, { ...options, fallbackModel: undefined }, depth + 1);
            }

            return {
                text: '',
                usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    totalTokens: 0,
                    model: normalizedModel
                },
                metadata: {
                    model: normalizedModel,
                    timestamp: new Date().toISOString(),
                    requestId: this.generateRequestId(),
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Blueprint generation for Strategy B agent system
     */
    async generateBlueprint(query, templates, context = {}) {
        try {
            this.logger.info('Generating blueprint with Gemini', { query: query.substring(0, 100) + '...' });

            const prompts = AgentPrompts.getBlueprintPrompt(query, templates, context);
            const fullPrompt = `${prompts.systemPrompt}\n\nUser Request:\n${prompts.userPrompt}`;

            const config = await this.getActionConfig('blueprint');
            const modelName = config.name || 'google-ai-studio/gemini-2.5-pro';

            const result = await this.generateContent(modelName, fullPrompt, {
                temperature: effectiveTemperature(config),
                maxTokens: effectiveMaxTokens(config),
                fallbackModel: config.fallbackModel
            });
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

            const prompts = AgentPrompts.getCodeGenerationPrompt(phase, context, existingCode);
            const fullPrompt = `${prompts.systemPrompt}\n\n${prompts.userPrompt}`;

            const config = await this.getActionConfig('phaseImplementation');
            const modelName = config.name || 'google-ai-studio/gemini-2.5-flash';

            const result = await this.generateContent(modelName, fullPrompt, {
                temperature: effectiveTemperature(config, { temperature: 0.1 }),
                maxTokens: effectiveMaxTokens(config, { maxTokens: 8192 }),
                fallbackModel: config.fallbackModel
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

            const prompts = AgentPrompts.getReviewPrompt(code, context);
            const fullPrompt = `${prompts.systemPrompt}\n\n${prompts.userPrompt}`;

            const config = await this.getActionConfig('codeReview');
            const modelName = config.name || 'google-ai-studio/gemini-2.5-pro';

            const result = await this.generateContent(modelName, fullPrompt, {
                temperature: effectiveTemperature(config),
                maxTokens: effectiveMaxTokens(config),
                fallbackModel: config.fallbackModel
            });

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
     * Template analysis and selection using Gemini AI
     */
    async analyzeTemplates(query, templates) {
        try {
            this.logger.info('Analyzing templates with Gemini AI', { templateCount: templates.length, query: query.substring(0, 50) + '...' });

            const prompt = `Analyze the following user query and recommend the most suitable template from the available options.

User Query: "${query}"

Available Templates:
${templates.map((t, i) => `${i + 1}. ${t.name}: ${t.description?.selection || t.description || 'No description'}`).join('\n')}

Instructions:
- Consider the user's intent and technical requirements
- Match templates to the most appropriate use case
- Provide reasoning for your choice
- Suggest alternatives if relevant

Respond with valid JSON in this exact format:
{
  "selectedTemplateName": "exact-template-name-from-list",
  "matchConfidence": 0.95,
  "reasoning": "brief explanation of why this template was selected",
  "alternativeTemplates": ["alternative1", "alternative2"],
  "customizationsNeeded": ["any specific modifications needed"]
}`;

            const config = await this.getActionConfig('templateSelection');
            const modelName = config.name || 'google-ai-studio/gemini-2.5-flash-lite';

            const result = await this.generateContent(modelName, prompt, {
                temperature: effectiveTemperature(config, { temperature: 0.1 }),
                maxTokens: effectiveMaxTokens(config, { maxTokens: 1000 }),
                responseMimeType: 'application/json',
                fallbackModel: config.fallbackModel
            });

            const analysis = this.parseTemplateAnalysis(result.text);

            this.logger.info('Gemini AI template analysis completed', {
                selected: analysis.selectedTemplateName,
                confidence: analysis.matchConfidence
            });

            const selection = {
                selectedTemplateName: analysis.selectedTemplateName || templates[0]?.name,
                matchConfidence: analysis.matchConfidence || 0.5,
                reasoning: analysis.reasoning || 'AI-powered template selection',
                alternatives: analysis.alternativeTemplates || [],
                customizations: analysis.customizationsNeeded || [],
                usage: result.usage,
                metadata: result.metadata
            };

            return selection;

        } catch (error) {
            this.logger.error('Gemini AI template analysis failed', error);

            // Fallback to keyword-based selection only when AI completely fails
            const selectedTemplate = this.selectTemplateByKeywords(query, templates);

            return {
                selectedTemplateName: selectedTemplate.selectedTemplateName,
                matchConfidence: selectedTemplate.matchConfidence,
                reasoning: `Fallback selection (${selectedTemplate.reasoning})`,
                alternatives: selectedTemplate.alternativeTemplates || [],
                customizations: selectedTemplate.customizationsNeeded || [],
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, model: 'fallback-keyword-analysis' },
                metadata: {
                    model: 'fallback-keyword-analysis',
                    timestamp: new Date().toISOString(),
                    requestId: this.generateRequestId(),
                    error: error.message
                }
            };
        }
    }

    /**
     * Try to enhance keyword selection with AI (optional)
     */
    async tryEnhanceWithAI(query, templates, keywordSelection) {
        try {
            const prompt = `Based on this user query: "${query}"

The keyword analysis selected: "${keywordSelection.selectedTemplateName}" with reasoning: "${keywordSelection.reasoning}"

Available templates: ${templates.map(t => `"${t.name}"`).join(', ')}

Should a different template be selected? Consider:
- User's technical intent and requirements
- Better framework/technology matches
- More appropriate architecture patterns

Respond with JSON:
{
  "useAISelection": true,
  "selectedTemplateName": "better-template-if-any",
  "matchConfidence": 0.95,
  "reasoning": "why AI chose differently or confirmed keyword choice",
  "enhancement": "what AI added beyond keywords"
}`;

            const templateConfig = await this.getActionConfig('templateSelection');
            const modelName = templateConfig.name || 'google-ai-studio/gemini-2.5-flash';

            const result = await this.generateContent(modelName, prompt, {
                temperature: effectiveTemperature(templateConfig, { temperature: 0.2 }),
                maxTokens: effectiveMaxTokens(templateConfig, { maxTokens: 500 }),
                fallbackModel: templateConfig.fallbackModel
            });

            const enhancement = this.parseTemplateAnalysis(result.text);

            if (enhancement.useAISelection && enhancement.selectedTemplateName) {
                return {
                    selectedTemplateName: enhancement.selectedTemplateName,
                    matchConfidence: enhancement.matchConfidence || 0.8,
                    reasoning: `AI-enhanced: ${enhancement.reasoning}`,
                    alternatives: keywordSelection.alternativeTemplates || [],
                    customizations: keywordSelection.customizationsNeeded || [],
                    usage: result.usage,
                    metadata: {
                        model: 'ai-enhanced-keyword',
                        timestamp: new Date().toISOString(),
                        requestId: this.generateRequestId(),
                        enhancement: enhancement.enhancement
                    }
                };
            }

            return null; // Use keyword selection

        } catch (error) {
            // AI enhancement failed, but that's okay
            return null;
        }
    }

    /**
     * Intelligent keyword-based template selection (fallback for AI)
     */
    selectTemplateByKeywords(query, templates) {
        const lowerQuery = query.toLowerCase();

        // Keyword mappings for common frameworks and use cases
        const keywordMappings = {
            'react': ['react', 'frontend', 'ui', 'component', 'interactive'],
            'vue': ['vue', 'frontend', 'ui', 'component'],
            'svelte': ['svelte', 'frontend', 'ui', 'lightweight'],
            'nextjs': ['next', 'next.js', 'ssr', 'server', 'fullstack'],
            'nuxt': ['nuxt', 'vue', 'ssr', 'server'],
            'node': ['backend', 'api', 'server', 'nodejs', 'express'],
            'vanilla': ['html', 'css', 'javascript', 'vanilla', 'simple', 'basic'],
            'dashboard': ['dashboard', 'analytics', 'chart', 'data'],
            'blog': ['blog', 'content', 'cms', 'article'],
            'ecommerce': ['shop', 'store', 'commerce', 'product', 'cart'],
            'social': ['social', 'community', 'user', 'profile', 'feed'],
            'game': ['game', 'gaming', 'interactive', 'canvas']
        };

        // Score each template based on keyword matches
        const scoredTemplates = templates.map(template => {
            const templateName = template.name.toLowerCase();
            const description = (template.description?.selection || template.description || '').toLowerCase();
            let score = 0;
            let matchedKeywords = [];

            // Check template name matches
            Object.entries(keywordMappings).forEach(([category, keywords]) => {
                if (templateName.includes(category)) {
                    score += 5; // Template name match is strong
                    matchedKeywords.push(category);
                }
            });

            // Check description matches
            Object.entries(keywordMappings).forEach(([category, keywords]) => {
                if (keywords.some(keyword => description.includes(keyword))) {
                    score += 3;
                    matchedKeywords.push(category);
                }
            });

            // Check query matches
            Object.entries(keywordMappings).forEach(([category, keywords]) => {
                if (keywords.some(keyword => lowerQuery.includes(keyword))) {
                    // If query contains keywords for this category, boost templates that match
                    if (templateName.includes(category) || description.includes(category)) {
                        score += 10; // Strong match
                        matchedKeywords.push(category);
                    }
                }
            });

            return {
                template,
                score,
                matchedKeywords: [...new Set(matchedKeywords)], // Remove duplicates
                name: template.name
            };
        });

        // Sort by score and select best match
        scoredTemplates.sort((a, b) => b.score - a.score);
        const bestMatch = scoredTemplates[0];

        if (bestMatch.score > 0) {
            return {
                selectedTemplateName: bestMatch.template.name,
                matchConfidence: Math.min(bestMatch.score / 15, 1.0), // Normalize to 0-1
                reasoning: `Selected based on keyword analysis: ${bestMatch.matchedKeywords.join(', ')}`,
                alternativeTemplates: scoredTemplates.slice(1, 4).map(t => t.name),
                customizationsNeeded: []
            };
        }

        // No good matches, return first template
        return {
            selectedTemplateName: templates[0]?.name || 'react-app',
            matchConfidence: 0.3,
            reasoning: 'Default selection - no specific keywords matched',
            alternativeTemplates: templates.slice(1, 3).map(t => t.name),
            customizationsNeeded: ['May need adjustments based on specific requirements']
        };
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

    async extractTextFromResponse(response) {
        console.log('***** response  *****')
        if (!response) {
            return '';
        }
    
        try {
            // Handle cases where response is already parsed JSON from certain model configurations
            if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0].text) {
                // When responseMimeType is 'application/json', the text is pre-parsed.
                // We need to stringify it to maintain a consistent text-based output for downstream parsers.
                const jsonText = response.candidates[0].content.parts[0].text;
                if (typeof jsonText === 'object') {
                    return JSON.stringify(jsonText);
                }
                return jsonText;
            }
    
            // Standard text extraction for non-JSON or default responses
            if (typeof response.text === 'function') {
                const textResult = await response.text();
                if (textResult) {
                    return textResult;
                }
            }
        } catch (error) {
            this.logger.debug('Gemini response text() extraction failed', error);
        }
    
        try {
            if (Array.isArray(response.candidates)) {
                const candidateText = response.candidates
                    .map(candidate => {
                        if (!candidate?.content?.parts) {
                            return '';
                        }
                        return candidate.content.parts
                            .map(part => part?.text || '')
                            .join('');
                    })
                    .filter(Boolean)
                    .join('\n')
                    .trim();
    
                if (candidateText) {
                    return candidateText;
                }
            }
        } catch (error) {
            this.logger.debug('Gemini candidate parts extraction failed', error);
        }
    
        return '';
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
            if (!responseText || typeof responseText !== 'string') {
                this.logger.warn('Gemini template analysis returned empty response');
                return {};
            }

            const sanitized = responseText.replace(/```json|```/gi, '').trim();
            const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                this.logger.warn('Gemini template analysis did not include JSON', {
                    preview: sanitized.slice(0, 200)
                });
                return {};
            }

            return JSON.parse(jsonMatch[0]);
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
            const config = await this.getActionConfig('templateSelection');
            const modelName = config.name || 'google-ai-studio/gemini-2.5-flash-lite';
            await this.generateContent(modelName, 'Hello, are you working?', {
                maxTokens: effectiveMaxTokens(config, { maxTokens: 10 }),
                temperature: effectiveTemperature(config, { temperature: 0 }),
                fallbackModel: config.fallbackModel
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
    AgentPrompts
};
