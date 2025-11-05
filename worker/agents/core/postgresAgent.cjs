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
        this.generatedFiles = [];
        this.previewUrl = null;
        this._connectionProvider = null;
        this._isGenerating = false;
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

                    this.state.blueprint = {
                        title: blueprint?.title || initArgs.templateInfo?.selection?.projectName || (initArgs.query ? initArgs.query.substring(0, 48) : 'Generated App'),
                        ...blueprint
                    };
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

            // Ensure blueprint title always exists for downstream UI
            if (!this.state.blueprint?.title) {
                this.state.blueprint = {
                    ...this.state.blueprint,
                    title: initArgs.query ? initArgs.query.substring(0, 48) : 'Generated Application'
                };
            }

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

    setConnectionProvider(provider) {
        this._connectionProvider = provider;
    }

    _getConnections() {
        if (typeof this._connectionProvider === 'function') {
            try {
                return this._connectionProvider() || [];
            } catch (error) {
                this.logger.error('Error obtaining WebSocket connections', error);
            }
        }
        return [];
    }

    _broadcast(type, payload = {}) {
        const message = JSON.stringify({ type, ...payload });
        for (const socket of this._getConnections()) {
            try {
                socket.send(message);
            } catch (error) {
                this.logger.warn(`Failed to send WebSocket message ${type}`, error);
            }
        }
    }

    getConversationState() {
        return {
            agentId: this.state.inferenceContext?.agentId || 'stub-agent',
            query: this.state.query || '',
            blueprintGenerated: !!this.state.blueprint,
            generatedFiles: this.generatedFiles.map((file) => ({
                filePath: file.filePath,
                description: file.description
            })),
            updatedAt: Date.now()
        };
    }

    async simulateGeneration() {
        if (this._isGenerating) {
            this.logger.info('Generation already running, skipping duplicate request');
            return;
        }

        this._isGenerating = true;

        const agentId = this.state.inferenceContext?.agentId || 'stub-agent';
        const files = [
            {
                filePath: 'src/App.tsx',
                description: 'Main application shell',
                contents: `import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
      <section className="max-w-2xl px-6 py-10 text-center space-y-6">
        <header>
          <h1 className="text-4xl font-semibold tracking-tight">Reminder Hero</h1>
          <p className="mt-3 text-slate-300">
            Stay effortlessly organized with an AI-generated reminder experience. Registration, login, and reminders—all ready to extend.
          </p>
        </header>
        <article className="bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="text-2xl font-medium">Today's Highlights</h2>
          <ul className="space-y-3 text-left text-sm text-slate-200">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true"></span>
              <div>
                <p className="font-medium text-emerald-300">Smart Reminder Feed</p>
                <p className="text-slate-400">Structured timeline grouping due and completed reminders with subtle color coding.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-sky-400" aria-hidden="true"></span>
              <div>
                <p className="font-medium text-sky-300">Tailored Quick Actions</p>
                <p className="text-slate-400">Buttons for rescheduling, marking done, or snoozing that animate gently on hover.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-400" aria-hidden="true"></span>
              <div>
                <p className="font-medium text-amber-300">Unified Auth Flow</p>
                <p className="text-slate-400">Registration & login screens styled with the same glassmorphism design system.</p>
              </div>
            </li>
          </ul>
        </article>
        <footer className="text-xs text-slate-500">
          <p>Generated preview. Customize reminders, notifications, and storage integrations next.</p>
        </footer>
      </section>
    </main>
  );
}
`
            },
            {
                filePath: 'src/reminders/mock-data.ts',
                description: 'Mock data powering the reminder timeline',
                contents: `export const reminders = [
  {
    id: 'rem-001',
    title: 'Submit design review',
    dueDate: '2025-02-15T18:00:00.000Z',
    status: 'due',
    category: 'Work',
    notes: 'Upload Figma link and summary in Slack #product-design.'
  },
  {
    id: 'rem-002',
    title: 'Weekly planning',
    dueDate: '2025-02-16T14:30:00.000Z',
    status: 'scheduled',
    category: 'Personal',
    notes: 'Reflect, review backlog, set priorities for next week.'
  }
];
`
            }
        ];

        this._broadcast('generation_started', {
            message: 'Starting Gemini stub generation',
            totalFiles: files.length
        });

        for (const file of files) {
            this._broadcast('file_generating', {
                filePath: file.filePath,
                filePurpose: file.description
            });

            this._broadcast('file_chunk_generated', {
                filePath: file.filePath,
                chunk: file.contents,
                format: 'full_content'
            });

            this._broadcast('file_generated', {
                filePath: file.filePath,
                message: `${file.filePath} generated`
            });
        }

        this.generatedFiles = files;
        this.state.generatedFiles = files.map((file) => ({
            filePath: file.filePath,
            description: file.description
        }));
        this._isGenerating = false;

        this._broadcast('generation_complete', {
            message: 'Stub generation completed',
            generatedFiles: this.state.generatedFiles
        });

        return this.state;
    }

    async deployToSandbox() {
        if (!this.previewUrl) {
            const agentId = this.state.inferenceContext?.agentId || 'stub-agent';
            this.previewUrl = `https://stub-preview.local/${agentId}`;
        }

        this._broadcast('deployment_started', {
            message: 'Deploying stub preview'
        });

        const response = {
            previewURL: this.previewUrl,
            status: 'ready'
        };

        this._broadcast('deployment_completed', {
            message: 'Preview available',
            previewURL: this.previewUrl
        });

        return response;
    }

    async reviewCode() {
        return {
            issuesFound: false,
            filesToFix: [],
            summary: 'Stub review completed with no blocking issues'
        };
    }

    clearConversation() {
        this.logger.info('Clearing stub conversation history');
    }

    getModelConfigsInfo() {
        return Promise.resolve({
            deterministic: {
                name: 'gemini-1.5-pro',
                description: 'Balanced deterministic agent optimized for GCP execution',
                temperature: 0.2
            }
        });
    }
}

module.exports = {
    PostgresCodeGeneratorAgent
};
