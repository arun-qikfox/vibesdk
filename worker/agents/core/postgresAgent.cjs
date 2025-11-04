/**
 * Node.js compatible stub for PostgresCodeGeneratorAgent
 * Provides minimal interface for GCP agent manager with Gemini AI integration
 */

class PostgresCodeGeneratorAgent {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.state = {
            inferenceContext: { agentId: 'stub-agent' },
            sessionId: 'stub-session'
        };
        this.logger = {
            info: (msg, data) => console.log(`[PostgresAgent] ${msg}`, data || ''),
            error: (msg, error) => console.error(`[PostgresAgent] ${msg}`, error),
            warn: (msg, data) => console.warn(`[PostgresAgent] ${msg}`, data || ''),
            debug: (msg, data) => console.debug(`[PostgresAgent] ${msg}`, data || '')
        };
    }

    async isInitialized() {
        return true;
    }

    getAgentId() {
        return this.state.inferenceContext.agentId;
    }

    async initialize(initArgs) {
        try {
            this.logger.info('Initializing PostgresCodeGeneratorAgent with Gemini AI integration', {
                hasQuery: !!initArgs?.query,
                hasTemplate: !!initArgs?.templateInfo,
                agentId: initArgs?.inferenceContext?.agentId
            });

            // Set up basic state
            this.state = {
                ...this.state,
                query: initArgs?.query || '',
                inferenceContext: {
                    ...this.state.inferenceContext,
                    agentId: initArgs?.inferenceContext?.agentId || 'gcp-agent',
                    userId: initArgs?.inferenceContext?.userId || 'gcp-user'
                },
                sessionId: initArgs?.sandboxSessionId || 'gcp-session'
            };

            // Generate blueprint using Gemini AI service
            if (initArgs?.query && initArgs?.templateInfo) {
                this.logger.info('Generating blueprint with Gemini AI service');

                try {
                    const { createGeminiAIService } = require('../../../backend/gemini-ai-service');
                    const geminiService = createGeminiAIService(this.env);

                    const blueprint = await this.generateBlueprintWithGemini(
                        geminiService,
                        initArgs.query,
                        initArgs.templateInfo.templateDetails,
                        initArgs.templateInfo.selection,
                        initArgs.inferenceContext
                    );

                    this.state.blueprint = blueprint;
                    this.state.templateDetails = initArgs.templateInfo.templateDetails;

                    // Call blueprint chunk callback if provided
                    if (initArgs.onBlueprintChunk) {
                        try {
                            const blueprintJson = JSON.stringify(blueprint, null, 2);
                            this.logger.info('Sending blueprint chunk to client', { chunkLength: blueprintJson.length });
                            initArgs.onBlueprintChunk(blueprintJson);
                        } catch (chunkError) {
                            this.logger.error('Error sending blueprint chunk', chunkError);
                            // Don't throw here, just log
                        }
                    }

                    this.logger.info('Blueprint generation completed successfully');
                } catch (blueprintError) {
                    this.logger.error('Blueprint generation failed, using fallback', blueprintError);

                    // Create and use fallback blueprint
                    const fallbackBlueprint = this.createFallbackBlueprint(
                        initArgs.query,
                        initArgs.templateInfo.templateDetails,
                        initArgs.templateInfo.selection
                    );

                    this.state.blueprint = fallbackBlueprint;
                    this.state.templateDetails = initArgs.templateInfo.templateDetails;

                    // Send fallback blueprint
                    if (initArgs.onBlueprintChunk) {
                        try {
                            const blueprintJson = JSON.stringify(fallbackBlueprint, null, 2);
                            this.logger.info('Sending fallback blueprint chunk', { chunkLength: blueprintJson.length });
                            initArgs.onBlueprintChunk(blueprintJson);
                        } catch (chunkError) {
                            this.logger.error('Error sending fallback blueprint chunk', chunkError);
                        }
                    }
                }
            } else {
                this.logger.warn('Missing query or template info, skipping blueprint generation', {
                    hasQuery: !!initArgs?.query,
                    hasTemplate: !!initArgs?.templateInfo
                });
            }

            this.logger.info('Agent initialization completed', {
                agentId: this.state.inferenceContext.agentId,
                hasBlueprint: !!this.state.blueprint
            });

            return this.state;
        } catch (error) {
            this.logger.error('Error initializing agent', error);
            // Don't throw - return partial state so WebSocket can still connect
            return this.state;
        }
    }

    async generateBlueprintWithGemini(geminiService, query, templateDetails, templateSelection, inferenceContext) {
        try {
            this.logger.info('Calling Gemini AI service for blueprint generation', {
                queryLength: query.length,
                templateName: templateDetails?.name
            });

            // Use the Gemini service's generateBlueprint method
            const result = await geminiService.generateBlueprint(query, [templateDetails], {
                userLevel: 'intermediate',
                preferredTech: ['react', 'typescript'],
                projectScale: 'medium',
                timeline: 'standard development cycle'
            });

            this.logger.info('Gemini AI blueprint generation successful', {
                hasBlueprint: !!result?.blueprint,
                usage: result?.usage
            });

            return result.blueprint;
        } catch (error) {
            this.logger.error('Gemini AI blueprint generation failed', error);

            // Return a basic fallback blueprint
            return this.createFallbackBlueprint(query, templateDetails, templateSelection);
        }
    }

    createFallbackBlueprint(query, templateDetails, templateSelection) {
        this.logger.warn('Creating fallback blueprint due to AI failure');

        return {
            title: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
            description: `Generated application based on: ${query}`,
            projectType: 'web-app',
            primaryFramework: templateSelection?.selectedTemplateName?.includes('react') ? 'react' : 'vanilla',
            techStack: {
                frontend: ['react', 'typescript', 'tailwind'],
                backend: ['nodejs'],
                deployment: ['vercel']
            },
            projectStructure: {
                folders: ['src', 'components', 'pages', 'utils'],
                keyFiles: ['package.json', 'tsconfig.json', 'tailwind.config.js']
            },
            implementationPhases: [{
                name: 'setup',
                description: 'Project initialization and dependencies',
                deliverables: ['package.json', 'folder structure', 'basic components']
            }],
            apiDesign: {
                endpoints: ['/api/health'],
                dataFlow: 'Basic API structure for health checks'
            },
            estimatedComplexity: 'medium',
            selectedTemplate: templateSelection?.selectedTemplateName || 'react-app',
            customizationNotes: ['Generated with fallback blueprint due to AI service unavailability']
        };
    }

    async getFullState() {
        return this.state;
    }

    async setState(state) {
        this.state = state;
    }

    async fetch(request) {
        // Return a basic WebSocket response for stub
        return new Response('WebSocket stub response', { status: 200 });
    }
}

module.exports = {
    PostgresCodeGeneratorAgent
};
