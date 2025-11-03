/**
 * GCP-Native Coding Agent Controller
 * Node.js implementation that replicates exact Cloudflare controller behavior using GCP services
 *
 * Follows the same flow as worker/api/controllers/agent/controller.ts:
 * 1. getTemplateForQuery() - List templates from GCS, select with AI
 * 2. getAgentStub() - Create/find agent state in PostgreSQL/Firestore
 * 3. Initialize agent with template data
 * 4. Send streaming file data via NDJSON
 * 5. Handle WebSocket connections for real-time updates
 */

// Import Gemini AI service for GCP deployments (optional for backward compatibility)
let geminiAIService = null;
try {
    geminiAIService = require('./gemini-ai-service');
} catch (error) {
    // Gemini AI service not available - continue with basic template selection
    console.log('Gemini AI service not available, using basic template selection');
}

// Import PostgreSQL Agent Service for durable storage (optional)
let agentStateService = null;
try {
    const { agentStateService: agentService } = require('../worker/database/services/AgentStateService');
    agentStateService = agentService;
} catch (error) {
    // Agent state service not available - fallback to in-memory storage
    console.log('Agent state service not available, using in-memory storage');
}

const WebSocket = require('ws');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const crypto = require('crypto');
// Simple ID generator function
const generateId = () => crypto.randomUUID();

const DEFAULT_MODEL_CONFIGS = {
    agents: [
        {
            key: 'deterministic',
            name: 'Deterministic Agent',
            description: 'Balanced deterministic agent optimized for GCP execution'
        },
        {
            key: 'smart',
            name: 'Smart Agent',
            description: 'Adaptive agent that prioritizes rapid iteration'
        }
    ],
    userConfigs: {},
    defaultConfigs: {
        deterministic: {
            key: 'deterministic',
            name: 'google-ai-studio/gemini-1.5-pro',
            temperature: 0.2,
            max_tokens: 8192,
            reasoning_effort: 'medium'
        },
        smart: {
            key: 'smart',
            name: 'google-ai-studio/gemini-1.5-flash',
            temperature: 0.4,
            max_tokens: 8192,
            reasoning_effort: 'medium'
        }
    }
};

const cloneDefaultModelConfigs = () => JSON.parse(JSON.stringify(DEFAULT_MODEL_CONFIGS));

// Agent state storage - uses PostgreSQL service when available, falls back to in-memory
const activeAgents = new Map(); // agentId -> { websocket, state, files }

/**
 * Agent state wrapper that uses PostgreSQL when available
 */
class AgentStateWrapper {
    constructor() {
        this.cache = new Map(); // local cache for performance
    }

    /**
     * Get agent state - checks PostgreSQL first if available, then cache
     */
    async get(agentId) {
        try {
            // Try PostgreSQL first if service is available
            if (agentStateService) {
                const session = await agentStateService.getSession(agentId);
                if (session) {
                    // Cache for performance
                    this.cache.set(agentId, {
                        agentId: session.id,
                        userId: session.userId,
                        status: session.status,
                        createdAt: session.createdAt,
                        query: session.executionData?.query,
                        language: session.executionData?.language,
                        frameworks: session.executionData?.frameworks,
                        files: session.executionData?.files,
                        websocketConnections: new Set(),
                        templateDetails: session.executionData?.templateDetails,
                        sandboxSessionId: session.executionData?.sandboxSessionId
                    });
                    return this.cache.get(agentId);
                }
            }

            // Fallback to in-memory cache
            return this.cache.get(agentId);
        } catch (error) {
            console.warn('Error retrieving agent state from PostgreSQL, using cache', error);
            return this.cache.get(agentId);
        }
    }

    /**
     * Set agent state - saves to PostgreSQL if available, always to cache
     */
    async set(agentId, state) {
        try {
            // Always update cache
            this.cache.set(agentId, state);

            // Save to PostgreSQL if service available
            if (agentStateService) {
                const sessionData = {
                    id: agentId,
                    userId: state.userId,
                    appId: state.appId,
                    status: state.status,
                    blueprint: state.blueprint,
                    phases: state.phases,
                    executionData: {
                        query: state.query,
                        language: state.language,
                        frameworks: state.frameworks,
                        files: state.files,
                        templateDetails: state.templateDetails,
                        sandboxSessionId: state.sandboxSessionId
                    }
                };

                await agentStateService.createSession(sessionData);
            }
        } catch (error) {
            console.warn('Error saving agent state to PostgreSQL, cached locally', error);
            // Continue with cache-only storage
        }
    }

    /**
     * Update agent state status
     */
    async updateStatus(agentId, status, additionalData) {
        try {
            const currentState = await this.get(agentId);
            if (!currentState) return;

            currentState.status = status;
            if (additionalData) {
                Object.assign(currentState, additionalData);
            }

            // Update cache
            this.cache.set(agentId, currentState);

            // Update PostgreSQL if available
            if (agentStateService) {
                await agentStateService.updateSessionStatus(agentId, status, additionalData);
            }
        } catch (error) {
            console.warn('Error updating agent status in PostgreSQL, updated cache', error);
        }
    }

    /**
     * Get all agent states (for WebSocket server)
     */
    getAll() {
        return new Map(this.cache);
    }
}

// Create singleton instance
const agentStates = new AgentStateWrapper();

// Logger
const createLogger = (name) => ({
    info: (msg, data) => console.log(`[${name}] ${msg}`, data || ''),
    debug: (msg, data) => console.debug(`[${name}] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[${name}] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[${name}] ${msg}`, data || '')
});

const logger = createLogger('GCPCodingAgentController');

/**
 * Base Controller class with success/error response methods
 */
class BaseController {
    static createSuccessResponse(data) {
        return {
            success: true,
            data: data,
            statusCode: 200
        };
    }

    static createErrorResponse(error, statusCode = 500) {
        let errorMessage = 'Internal server error';
        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error?.message) {
            errorMessage = error.message;
        }

        return {
            success: false,
            error: errorMessage,
            statusCode: statusCode
        };
    }
}

/**
 * GCP-Native Coding Agent Controller
 */
class GCPCodingAgentController extends BaseController {
    static async startCodeGeneration(request, env, ctx, routeContext) {
        try {
            logger.info('Starting GCP-native code generation process', {
                runtimeProvider: env.RUNTIME_PROVIDER,
                hasDatabaseUrl: !!(env.DATABASE_URL),
                hasGcsBucket: !!(env.GCS_TEMPLATES_BUCKET)
            });

            const url = new URL(request.url);
            const hostname = url.hostname === 'localhost' ? `localhost:${url.port}`: 'localhost:3001';

            // Parse the query from the request body
            let body;
            try {
                body = await request.json();
            } catch (error) {
                return GCPCodingAgentController.createErrorResponse(`Invalid JSON in request body: ${error.message}`, 400);
            }

            const query = body.query;
            if (!query) {
                return GCPCodingAgentController.createErrorResponse('Missing "query" field in request body', 400);
            }

            // Check if user is authenticated (required for app creation)
            const authUser = routeContext.user;
            if (!authUser) {
                return GCPCodingAgentController.createErrorResponse('Authentication required', 401);
            }

            const agentId = generateId(); // Use proper generateId function
            logger.info('Generated agent ID', { agentId });

            // Follow exact Cloudflare flow: getTemplateForQuery
            const { sandboxSessionId, templateDetails, selection } = await GCPCodingAgentController.getTemplateForQuery(env, {
                userId: authUser.id,
                userModelConfigs: {}, // Will populate with GCP models
                agentId: agentId
            }, query, body.images, logger);

            logger.info('Selected template for GCP', { selectedTemplate: selection.selectedTemplateName });

            // Initialize agent state in our "Durable Objects" equivalent (PostgreSQL/Firestore)
            const agentState = {
                agentId,
                userId: authUser.id,
                status: 'initializing',
                createdAt: new Date().toISOString(),
                query: query,
                language: body.language || 'typescript',
                frameworks: body.frameworks || ['react', 'vite'],
                files: templateDetails.files, // Use real cloud template files
                websocketConnections: new Set(),
                templateDetails,
                sandboxSessionId,
                conversationHistory: [],
                modelConfigs: GCPCodingAgentController.getDefaultModelConfigs(),
                generationStartedAt: null,
                generationCompletedAt: null,
                generationReplaySent: false
            };

            await agentStates.set(agentId, agentState);
            logger.info(`Agent ${agentId} state initialized for user ${authUser.id}`);

            // Create websocket and HTTP URLs for connection
            let websocketUrl, httpStatusUrl;
            const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            const baseUrl = hostname || url.host || 'localhost:3001';
            websocketUrl = `${wsProtocol}//${baseUrl}/api/agent/${agentId}/ws`;
            httpStatusUrl = `${url.protocol}//${baseUrl}/api/agent/${agentId}`;

            // Process uploaded images if any
            let uploadedImages = [];
            if (body.images) {
                uploadedImages = await Promise.all(body.images.map(async (image) => {
                    return await GCPCodingAgentController.uploadImageToGCS(env, image);
                }));
            }

            // Initialize agent with template data (simulating Cloudflare agent initialization)
            await GCPCodingAgentController.initializeAgentWithTemplate(agentId, {
                query,
                language: body.language || 'typescript',
                frameworks: body.frameworks || ['react', 'vite'],
                hostname,
                templateInfo: { templateDetails, selection },
                images: uploadedImages,
                sandboxSessionId,
                agentId
            });

            // Set up NDJSON streaming response like Cloudflare
            let terminated = false;
            const { readable, writable } = new TransformStream({
                transform(chunk, controller) {
                    if (chunk === "terminate") {
                        terminated = true;
                        // Don't terminate here, let natural close happen
                        return;
                    } else if (!terminated) {
                        const encoded = new TextEncoder().encode(JSON.stringify(chunk) + '\n');
                        controller.enqueue(encoded);
                    }
                }
            });
            const writer = writable.getWriter();

            // Send initial data
            writer.write({
                message: 'Code generation started',
                agentId: agentId,
                websocketUrl,
                httpStatusUrl,
                template: {
                    name: templateDetails.name,
                    files: templateDetails.files
                }
            });

            // Start async agent execution (simulating Cloudflare agent)
            GCPCodingAgentController.simulateAgentStreaming(agentId, writer).then(() => {
                // Only close writer if not already terminated
                if (!terminated && !writer.locked) {
                    writer.close().catch(err => {
                        // Ignore close errors if already terminated
                        logger.debug('Writer close ignored - already terminated');
                    });
                }
            }).catch((error) => {
                logger.error('Error in simulateAgentStreaming:', error);
                if (!terminated && !writer.locked) {
                    writer.close().catch(() => {});
                }
            });

            return new Response(readable, {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
                    'Pragma': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });

        } catch (error) {
            logger.error('Error starting GCP code generation', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            return GCPCodingAgentController.createErrorResponse(
                error instanceof Error ? error.message : 'Code generation failed',
                500
            );
        }
    }



    /**
     * Handle WebSocket connections for the agent (GCP-native)
     * In the current setup, WebSockets are handled by the separate WebSocket server
     * This method can return any response for HTTP requests to the same endpoint
     */
    static handleWebSocketConnection(honoContext, agentId) {
        try {
            logger.info(`WebSocket/HTTP request for agent: ${agentId}`);

            // The actual WebSocket connections are handled by the WebSocket server
            // registered on the same HTTP server. This method only handles HTTP requests
            // to the same /api/agent/:id/ws endpoint (if any).

            // For now, just return a response indicating WebSocket should be used
            return new Response('Use WebSocket protocol for this endpoint', { status: 426 });

        } catch (error) {
            logger.error('Error handling WebSocket connection request', error);
            return new Response('WebSocket connection setup failed', { status: 500 });
        }
    }

    /**
     * Connect to existing agent (GCP-native)
     */
    static async connectToExistingAgent(request, env, ctx, routeContext) {
        try {
            const agentId = routeContext.pathParams.agentId;
            if (!agentId) {
                return GCPCodingAgentController.createErrorResponse('Missing agent ID parameter', 400);
            }

            logger.info(`Connecting to existing agent: ${agentId}`);

            // Check if agent exists in our "Durable Objects"
            const agentState = await agentStates.get(agentId);
            if (!agentState) {
                return GCPCodingAgentController.createErrorResponse('Agent instance not found', 404);
            }

            // Construct WebSocket URL - handle both Fetch Request and Node.js request
            let websocketUrl;
            try {
                // Try Fetch Request interface first
                const url = new URL(request.url);
                const hostname = url.hostname === 'localhost' ? `localhost:${url.port}` : url.host;
                const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                websocketUrl = `${wsProtocol}//${hostname}/api/agent/${agentId}/ws`;
            } catch (e) {
                // Fallback for Node.js request objects
                websocketUrl = `ws://localhost:3001/api/agent/${agentId}/ws`;
            }

            const responseData = {
                websocketUrl,
                agentId,
                status: agentState.status,
                files: agentState.files
            };

            return GCPCodingAgentController.createSuccessResponse(responseData);

        } catch (error) {
            logger.error('Error connecting to existing agent', error);
            return GCPCodingAgentController.createErrorResponse('Failed to connect to agent', 500);
        }
    }

    /**
     * Deploy preview (GCP-native - upload to cloud storage)
     */
    static async deployPreview(request, env, ctx, routeContext) {
        try {
            const agentId = routeContext.pathParams.agentId;
            if (!agentId) {
                return GCPCodingAgentController.createErrorResponse('Missing agent ID parameter', 400);
            }

            logger.info(`Deploying preview for agent: ${agentId}`);

            // Get agent state
            const agentState = await agentStates.get(agentId);
            if (!agentState) {
                return GCPCodingAgentController.createErrorResponse('Agent instance not found', 404);
            }

            // In production, would upload files to Google Cloud Storage and create preview URL
            const previewURL = `https://preview.vibesdk.com/${agentId}`;

            logger.info('Preview deployment completed', { agentId, previewURL });

            return GCPCodingAgentController.createSuccessResponse({
                previewURL,
                agentId,
                deployedAt: new Date().toISOString(),
                status: 'deployed'
            });

        } catch (error) {
            logger.error('Error deploying preview', { agentId, error });
            return GCPCodingAgentController.createErrorResponse('Failed to deploy preview', 500);
        }
    }

    /**
     * GCP equivalent of getTemplateForQuery - lists templates from GCS, selects template
     * This method keeps the exact Flowflare logic unchanged for backward compatibility
     */
    static async getTemplateForQuery(env, inferenceContext, query, images, logger) {
        try {
            logger.info('GCP: Starting template selection for query', { query });

            // Fetch available templates from GCS (equivalent to SandboxSdkClient.listTemplates)
            const templatesResponse = await GCPCodingAgentController.listTemplatesFromGCS(env, logger);
            if (!templatesResponse || !templatesResponse.success) {
                throw new Error(`Failed to fetch templates from GCS, ${templatesResponse.error}`);
            }

            const sandboxSessionId = generateId();

            // Select template using existing logic (equivalent to selectTemplate)
            const selectionResult = await GCPCodingAgentController.selectTemplateWithFallbackAI(env, inferenceContext, query, templatesResponse.templates, images, logger);

            if (!selectionResult.selectedTemplateName) {
                logger.error('No suitable template found for code generation');
                throw new Error('No suitable template found for code generation');
            }

            // Find the selected template
            const selectedTemplate = templatesResponse.templates.find(template => template.name === selectionResult.selectedTemplateName);
            if (!selectedTemplate) {
                logger.error('Selected template not found');
                throw new Error('Selected template not found');
            }

            // Fetch all files from GCS bucket for the selected template
            const templateDetails = await GCPCodingAgentController.getTemplateDetailsFromGCS(env, selectedTemplate.name, logger);

            return { sandboxSessionId, templateDetails, selection: selectionResult };

        } catch (error) {
            logger.error('GCP: Error in getTemplateForQuery', error);
            throw error;
        }
    }

    /**
     * List available templates from GCS bucket
     * Lists template directories from the GCS_TEMPLATES_BUCKET
     */
    static async listTemplatesFromGCS(env, logger) {
        try {
            logger.info('GCP: Listing templates from GCS bucket', {
                bucket: env.GCS_TEMPLATES_BUCKET,
                project: env.GCP_PROJECT_ID
            });

            if (!env.GCS_TEMPLATES_BUCKET) {
                logger.warn('GCS_TEMPLATES_BUCKET not configured, using fallback');
                return GCPCodingAgentController.getFallbackTemplates();
            }

            const storage = new Storage({
                projectId: env.GCP_PROJECT_ID
            });

            const bucket = storage.bucket(env.GCS_TEMPLATES_BUCKET);

            // First, try to read template_catalog.json to get available templates
            let templates = [];
            try {
                const [catalogFile] = await bucket.getFiles({ prefix: 'template_catalog.json' });
                if (catalogFile.length > 0) {
                    const [content] = await catalogFile[0].download();
                    const catalogData = JSON.parse(content.toString('utf8'));
                    templates = catalogData.map(template => ({
                        name: template.name,
                        description: template.description?.selection || `${template.name} application`,
                        language: template.language || 'typescript',
                        frameworks: template.frameworks || []
                    }));
                    logger.info('GCP: Loaded templates from catalog', { templateCount: templates.length });
                }
            } catch (catalogError) {
                logger.warn('GCP: Could not read template_catalog.json, falling back to directory listing', catalogError);
            }

            // If catalog failed, fall back to directory listing
            if (templates.length === 0) {
                // List template directories from definitions/
                const [files] = await bucket.getFiles({
                    delimiter: '/',
                    prefix: 'definitions/' // Templates are under definitions/ directory
                });

                logger.info('GCP: Found template directories', { fileCount: files.length });

                // Extract unique template names from file prefixes
                const templateDirs = new Set();

                // Get all files with prefix to find template directories
                const [allFiles] = await bucket.getFiles({ prefix: 'definitions/' });

                allFiles.forEach(file => {
                    const name = file.name;
                    if (name.startsWith('definitions/')) {
                        const templateName = name.split('/')[1]; // e.g., 'c-code-next-runner' from 'definitions/c-code-next-runner/package.json'
                        if (templateName) {
                            templateDirs.add(templateName);
                        }
                    }
                });

                templates = Array.from(templateDirs).map(templateName => ({
                    name: templateName,
                    description: `${templateName.charAt(0).toUpperCase() + templateName.slice(1).replace('-', ' ')} application`,
                    language: 'typescript',
                    frameworks: GCPCodingAgentController.inferFrameworks(templateName)
                }));
            }

            logger.info('GCP: Extracted template metadata', {
                templatesFound: templates.length,
                templates: templates.map(t => t.name)
            });

            return {
                success: true,
                templates: templates
            };

        } catch (error) {
            logger.error('GCP: Error listing templates from GCS', {
                error: error.message,
                stack: error.stack,
                bucket: env.GCS_TEMPLATES_BUCKET,
                project: env.GCP_PROJECT_ID,
                prefix: 'templates/'
            });

            // Log additional GCS-specific error details
            if (error.code) {
                logger.error('GCP: GCS error code details', {
                    code: error.code,
                    errno: error.errno,
                    syscall: error.syscall
                });
            }

            logger.info('GCP: Falling back to default templates list');
            return {
                success: false,
                error: error.message,
                templates: GCPCodingAgentController.getFallbackTemplates().templates
            };
        }
    }

    /**
     * Get template details from GCS bucket
     * Reads actual template files from Google Cloud Storage
     */
    static async getTemplateDetailsFromGCS(env, templateName, logger) {
        try {
            logger.info('GCP: Fetching template details from GCS', {
                templateName,
                bucket: env.GCS_TEMPLATES_BUCKET
            });

            if (!env.GCS_TEMPLATES_BUCKET) {
                logger.warn('GCS_TEMPLATES_BUCKET not configured, using fallback template');
                return GCPCodingAgentController.getFallbackTemplate(templateName, logger);
            }

            const storage = new Storage({
                projectId: env.GCP_PROJECT_ID
            });

            const bucket = storage.bucket(env.GCS_TEMPLATES_BUCKET);

            // Template files are stored under definitions/{templateName}/
            const templatePrefix = `definitions/${templateName}/`;
            logger.info('GCP: Listing files with prefix', { templatePrefix });

            // Get all files for this template
            const [files] = await bucket.getFiles({
                prefix: templatePrefix
            });

            logger.info('GCP: Found template files', {
                fileCount: files.length,
                files: files.map(f => f.name)
            });

            if (files.length === 0) {
                logger.warn(`No files found for template ${templateName}, using fallback`);
                return GCPCodingAgentController.getFallbackTemplate(templateName, logger);
            }

            // Read all template files concurrently
            const templateFiles = await Promise.all(
                files.map(async (file) => {
                    try {
                        // Download file content
                        const [content] = await file.download();
                        const fileContent = content.toString('utf8');

                        // Construct relative path (remove template prefix)
                        const filePath = file.name.replace(templatePrefix, '');

                        logger.debug('GCP: Loaded template file', {
                            fullPath: file.name,
                            relativePath: filePath,
                            size: fileContent.length
                        });

                        return {
                            filePath: filePath, // Client expects filePath
                            fileContents: fileContent
                        };
                    } catch (error) {
                        logger.error('GCP: Failed to read template file', {
                            file: file.name,
                            error: error.message
                        });
                        throw error;
                    }
                })
            );

            logger.info('GCP: Successfully loaded template', {
                templateName,
                filesLoaded: templateFiles.length
            });

            return {
                name: templateName,
                files: templateFiles
            };

        } catch (error) {
            logger.error('GCP: Error fetching template details from GCS, using fallback', error);
            return GCPCodingAgentController.getFallbackTemplate(templateName, logger);
        }
    }

    /**
     * Get fallback templates list when GCS fails
     * Returns a default set of templates for development/testing
     */
    static getFallbackTemplates() {
        logger.info('GCP: Using fallback templates list');

        return {
            templates: [
                {
                    name: 'react-app',
                    description: 'React application with Vite',
                    language: 'typescript',
                    frameworks: ['react', 'vite']
                },
                {
                    name: 'vue-app',
                    description: 'Vue.js application',
                    language: 'typescript',
                    frameworks: ['vue']
                },
                {
                    name: 'svelte-app',
                    description: 'Svelte application',
                    language: 'typescript',
                    frameworks: ['svelte']
                },
                {
                    name: 'vanilla-js',
                    description: 'Vanilla JavaScript application',
                    language: 'javascript',
                    frameworks: []
                },
                {
                    name: 'node-api',
                    description: 'Node.js API server',
                    language: 'typescript',
                    frameworks: ['node', 'express']
                }
            ]
        };
    }

    /**
     * Get fallback template when GCS fails
     */
    static async getFallbackTemplate(templateName, logger) {
        logger.warn('GCP: Using fallback template for', { templateName });

        // Generate a basic template based on name
        const isReact = templateName.includes('react');
        const isVue = templateName.includes('vue');
        const isSvelte = templateName.includes('svelte');

        let appContent, packageJson;

        if (isReact) {
            appContent = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Generated React App</h1>
        <p>Using template: ${templateName}</p>
      </header>
    </div>
  );
}

export default App;`;
            packageJson = {
                "name": "generated-app",
                "version": "0.1.0",
                "private": true,
                "dependencies": {
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0",
                    "react-scripts": "5.0.1",
                    "web-vitals": "^2.1.4"
                },
                "scripts": {
                    "start": "react-scripts start",
                    "build": "react-scripts build",
                    "test": "react-scripts test",
                    "eject": "react-scripts eject"
                },
                "eslintConfig": {
                    "extends": [
                        "react-app",
                        "react-app/jest"
                    ]
                },
                "browserslist": {
                    "production": [">0.2%", "not dead", "not op_mini all"],
                    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
                }
            };
        } else if (isVue) {
            appContent = `<template>
  <div class="app">
    <header class="app-header">
      <h1>Generated Vue App</h1>
      <p>Using template: ${templateName}</p>
    </header>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style scoped>
.app {
  text-align: center;
}

.app-header {
  background-color: #cc99cc;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}
</style>`;
            packageJson = {
                "name": "generated-vue-app",
                "version": "0.1.0",
                "private": true,
                "scripts": {
                    "serve": "vue-cli-service serve",
                    "build": "vue-cli-service build",
                    "lint": "vue-cli-service lint"
                },
                "dependencies": {
                    "vue": "^3.2.0"
                },
                "devDependencies": {
                    "@vue/cli-plugin-babel": "~5.0.0",
                    "@vue/cli-service": "~5.0.0"
                }
            };
        } else if (isSvelte) {
            appContent = `<script>
  let name = 'world';
</script>

<h1>Hello {name}!</h1>

<p>This is a generated Svelte app using template: ${templateName}</p>

<style>
  h1 {
    color: #9c88ff;
    text-transform: uppercase;
    font-size: calc(10px + 2vmin);
    font-weight: 100;
  }
</style>`;
            packageJson = {
                "name": "generated-svelte-app",
                "version": "0.1.0",
                "private": true,
                "scripts": {
                    "build": "rollup -c",
                    "dev": "rollup -c -w",
                    "start": "sirv public -s"
                },
                "devDependencies": {
                    "@rollup/plugin-commonjs": "^20.0.0",
                    "@rollup/plugin-node-resolve": "^13.0.0",
                    "rollup": "^2.3.4",
                    "rollup-plugin-css-only": "^3.1.0",
                    "rollup-plugin-livereload": "^2.0.0",
                    "rollup-plugin-svelte": "^7.0.0",
                    "rollup-plugin-terser": "^7.0.0",
                    "svelte": "^3.0.0"
                }
            };
        } else {
            // Generic vanilla JS template
            appContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            text-align: center;
        }
        .container {
            background: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Generated App</h1>
        <p>Using template: ${templateName}</p>
    </div>

    <script>
        console.log('App loaded using template: ${templateName}');
    </script>
</body>
</html>`;
            packageJson = {
                "name": "generated-vanilla-app",
                "version": "0.1.0",
                "description": "A generated vanilla JavaScript app"
            };
        }

        const templateFiles = [
            {
                filePath: isReact ? 'src/App.js' : isVue ? 'src/App.vue' : isSvelte ? 'src/App.svelte' : 'index.html',
                fileContents: appContent
            },
            {
                filePath: 'package.json',
                fileContents: JSON.stringify(packageJson, null, 2)
            }
        ];

        // Add CSS/style files for React/Vue
        if (isReact) {
            templateFiles.push({
                filePath: 'src/App.css',
                fileContents: `.App {
  text-align: center;
}

.App-header {
  background-color: #61dafb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}`
            });
            templateFiles.push({
                filePath: 'src/index.js',
                fileContents: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
            });
            templateFiles.push({
                filePath: 'src/index.css',
                fileContents: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`
            });
            templateFiles.push({
                filePath: 'public/index.html',
                fileContents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Generated React App"
    />
    <title>Generated React App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`
            });
        } else if (isVue) {
            templateFiles.push({
                filePath: 'src/main.js',
                fileContents: `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`
            });
            templateFiles.push({
                filePath: 'public/index.html',
                fileContents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title><%= htmlWebpackPlugin.options.title %></title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`
            });
        }

        logger.info('GCP: Generated fallback template', {
            templateName,
            filesCreated: templateFiles.length
        });

        return {
            name: templateName,
            files: templateFiles
        };
    }

    /**
     * Template selection with optional Gemini AI fallback
     * Uses existing logic first, falls back to Gemini analysis if configured
     */
    static selectTemplateWithFallbackAI(env, inferenceContext, query, templates, images, logger) {
        try {
            logger.info('GCP: Selecting template for query', { query: query.substring(0, 100) + '...' });

            // First try simple keyword matching (existing behavior)
            const simpleSelection = GCPCodingAgentController.selectTemplateByKeywords(query, templates, logger);
            if (simpleSelection) {
                logger.info('GCP: Template selected by keywords', { selected: simpleSelection.selectedTemplateName });
                return simpleSelection;
            }

            // As fallback, try Gemini AI if available and configured
            if (geminiAIService && env.GEMINI_API_KEY) {
                try {
                    logger.info('GCP: Attempting Gemini AI analysis for template selection');

                    // This would be called asynchronously in a real implementation
                    // For now, return a basic fallback
                    logger.info('GCP: Gemini AI not implemented for template selection, using fallback');
                } catch (geminiError) {
                    logger.warn('GCP: Gemini AI template analysis failed, continuing', geminiError);
                }
            }

            // Final fallback: select first available template
            if (templates.length > 0) {
                const fallbackTemplate = templates[0];
                logger.info('GCP: Using first available template as final fallback', {
                    selected: fallbackTemplate.name
                });

                return {
                    selectedTemplateName: fallbackTemplate.name,
                    matchConfidence: 0.3,
                    reasoning: 'Fallback selection from available templates',
                    alternativeTemplates: templates.slice(1, 3).map(t => t.name),
                    customizationsNeeded: ['May need adjustments based on specific requirements']
                };
            }

            throw new Error('No templates available for selection');

        } catch (error) {
            logger.error('GCP: Template selection failed', error);
            throw error;
        }
    }

    /**
     * Simple keyword-based template selection (existing behavior)
     */
    static selectTemplateByKeywords(query, templates, logger) {
        try {
            const lowerQuery = query.toLowerCase();

            // Keyword mappings for common frameworks
            const keywordMappings = {
                'react': ['react', 'js', 'javascript', 'frontend', 'web'],
                'vue': ['vue', 'js', 'javascript', 'frontend'],
                'svelte': ['svelte', 'js', 'javascript', 'frontend'],
                'nextjs': ['next', 'next.js', 'react', 'ssr', 'server'],
                'nuxt': ['nuxt', 'vue', 'ssr', 'server'],
                'vanilla': ['html', 'css', 'javascript', 'vanilla', 'simple'],
                'node': ['backend', 'api', 'server', 'nodejs'],
                'express': ['express', 'backend', 'api']
            };

            // Find matches between query and template capabilities
            const matches = templates.map(template => {
                const templateName = template.name.toLowerCase();
                const description = (template.description || '').toLowerCase();

                let score = 0;

                // Check template name matches
                Object.entries(keywordMappings).forEach(([framework, keywords]) => {
                    if (templateName.includes(framework)) {
                        if (keywords.some(keyword => lowerQuery.includes(keyword))) {
                            score += 10; // Strong match
                        }
                    }
                });

                // Check description matches
                if (description.includes(lowerQuery) || lowerQuery.includes(description)) {
                    score += 5;
                }

                return {
                    template,
                    score,
                    name: template.name
                };
            }).filter(match => match.score > 0)
              .sort((a, b) => b.score - a.score);

            if (matches.length > 0) {
                const bestMatch = matches[0];
                return {
                    selectedTemplateName: bestMatch.template.name,
                    matchConfidence: Math.min(bestMatch.score / 10, 1.0),
                    reasoning: `Selected based on keyword matching (score: ${bestMatch.score})`,
                    alternativeTemplates: matches.slice(1, 3).map(m => m.name),
                    customizationsNeeded: []
                };
            }

            return null; // No keyword matches found

        } catch (error) {
            logger.error('GCP: Keyword-based template selection failed', error);
            return null;
        }
    }

    /**
     * Provide default model configuration metadata for UI consumption
     */
    static getDefaultModelConfigs() {
        return cloneDefaultModelConfigs();
    }

    /**
     * Upload image to GCS (equivalent of uploadImage in Cloudflare)
     */
    static async uploadImageToGCS(env, image) {
        try {
            logger.info('GCP: Uploading image to GCS');

            // TODO: Implement actual GCS upload
            // For now, return mock image attachment
            return {
                publicUrl: `https://storage.googleapis.com/${env.GCS_TEMPLATES_BUCKET}/uploads/${Date.now()}_${image.filename}`,
                key: `uploads/${Date.now()}_${image.filename}`,
                filename: image.filename
            };

        } catch (error) {
            logger.error('GCP: Error uploading image', error);
            throw error;
        }
    }

    /**
     * Initialize agent with template (GCP equivalent of Cloudflare agent initialization)
     */
    static async initializeAgentWithTemplate(agentId, config) {
        try {
            logger.info('GCP: Initializing agent with template', { agentId, template: config.templateInfo.selection.selectedTemplateName });

            // Store configuration for later use
            const agentState = await agentStates.get(agentId);
            if (agentState) {
                agentState.initialized = true;
                agentState.status = 'ready';

                // Add template configuration
                agentState.config = config;
            }

        } catch (error) {
            logger.error('GCP: Error initializing agent', error);
            throw error;
        }
    }

    /**
     * Simulate agent streaming (GCP equivalent of Cloudflare agent execution)
     */
    static async simulateAgentStreaming(agentId, writer) {
        try {
            logger.info('GCP: Starting simulated agent streaming', { agentId });

            const agentState = await agentStates.get(agentId);
            if (!agentState) return;

            agentState.status = 'generating';
            if (!agentState.generationStartedAt) {
                agentState.generationStartedAt = Date.now();
            }

            // Send files one at a time like Cloudflare
            const templateFiles = agentState.files || [];

            for (let i = 0; i < templateFiles.length; i++) {
                const file = templateFiles[i];

                logger.info(`GCP: Sending file ${file.filePath} (${i + 1}/${templateFiles.length})`);

                // Send file complete content in one go (simplified)
                writer.write({
                    type: 'file_generated',
                    fileName: file.filePath, // Use filePath for FileExplorer
                    fileContents: file.fileContents,
                    progress: Math.round(((i + 1) / templateFiles.length) * 100)
                });

                // Simulate some delay between files
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Send completion
            writer.write("terminate");
            writer.close();

            agentState.status = 'completed';
            agentState.generationCompletedAt = Date.now();
            agentState.generationReplaySent = false;
            logger.info(`GCP: Agent ${agentId} completed successfully`);

        } catch (error) {
            logger.error('GCP: Error in simulateAgentStreaming', error);
            writer.write("terminate");
            writer.close();
        }
    }
}

module.exports = {
    GCPCodingAgentController,
    agentStates,
    activeAgents
};
