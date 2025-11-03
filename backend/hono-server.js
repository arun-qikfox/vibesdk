const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const { setupGlobalEnvironment } = require('./setup-env');
const { formatApiResponse, extractPathParams, extractQueryParams } = require('./api-client-router.js');
const { initializeMiddlewareAdapters } = require('./hono-middleware-adapters');
const { setupHonoCompatibleRoutes } = require('./setup-hono-routes');
// Lazy import agentStates to avoid timing issues
let agentStates = null;
let agentControllerModule = null;

const isSocketOpen = (socket) => socket && socket.readyState === WebSocket.OPEN;

const sendSocketMessage = (socket, payload) => {
    if (!isSocketOpen(socket)) {
        return;
    }
    try {
        socket.send(JSON.stringify(payload));
    } catch (error) {
        console.error('Error sending WebSocket message', error);
    }
};

const broadcastToAgentConnections = (agentState, payload) => {
    if (!agentState || !agentState.websocketConnections) {
        return;
    }
    for (const socket of agentState.websocketConnections) {
        sendSocketMessage(socket, payload);
    }
};

const buildConversationState = (agentState) => ({
    runningHistory: Array.isArray(agentState?.conversationHistory) ? agentState.conversationHistory : []
});

const ensureAgentModelConfigs = (agentState) => {
    if (!agentState) {
        return {
            agents: [],
            userConfigs: {},
            defaultConfigs: {}
        };
    }
    if (!agentState.modelConfigs && agentControllerModule?.GCPCodingAgentController?.getDefaultModelConfigs) {
        agentState.modelConfigs = agentControllerModule.GCPCodingAgentController.getDefaultModelConfigs();
    }
    return agentState.modelConfigs || {
        agents: [],
        userConfigs: {},
        defaultConfigs: {}
    };
};

const replayGenerationToSockets = (agentId, agentState) => {
    if (!agentState) return;
    const files = Array.isArray(agentState.files) ? agentState.files : [];
    const totalFiles = files.length;

    broadcastToAgentConnections(agentState, {
        type: 'generation_started',
        agentId,
        totalFiles,
        startedAt: agentState.generationStartedAt || Date.now()
    });

    broadcastToAgentConnections(agentState, {
        type: 'phase_generating',
        agentId,
        message: 'Generating project files...'
    });

    files.forEach((file, index) => {
        broadcastToAgentConnections(agentState, {
            type: 'file_generating',
            agentId,
            filePath: file.filePath,
            index: index + 1,
            totalFiles
        });

        broadcastToAgentConnections(agentState, {
            type: 'file_generated',
            agentId,
            file: {
                filePath: file.filePath,
                fileContents: file.fileContents
            },
            index: index + 1,
            totalFiles
        });
    });

    broadcastToAgentConnections(agentState, {
        type: 'phase_generated',
        agentId,
        message: 'Project files generated'
    });

    broadcastToAgentConnections(agentState, {
        type: 'generation_complete',
        agentId,
        status: agentState.status || 'completed',
        completedAt: agentState.generationCompletedAt || Date.now()
    });

    agentState.generationReplaySent = true;
};

const appendConversationEntry = (agentState, entry) => {
    if (!agentState) return;
    if (!Array.isArray(agentState.conversationHistory)) {
        agentState.conversationHistory = [];
    }
    agentState.conversationHistory.push(entry);
};

const createConversationId = () => crypto.randomUUID();

const buildAssistantResponse = (agentState, userMessage) => {
    const baseMessage = agentState?.templateDetails?.name
        ? `The project has been generated using the ${agentState.templateDetails.name} template.`
        : 'The project is ready.';
    if (!userMessage) {
        return `${baseMessage} Let me know if you need any updates or additions.`;
    }
    return `${baseMessage} I noted: "${userMessage}". Let me know how you would like me to adjust the project.`;
};

// Get the runtime configuration from env (similar to worker)
const RUNTIME_PROVIDER = process.env.RUNTIME_PROVIDER || 'nodejs';

// Initialize Hono app
const app = new Hono();

// Setup global environment before importing routes
(async () => {
    try {
        // Load GCP services into global env first
        console.log('🚀 Initializing Hono Node.js server...');
        await setupGlobalEnvironment();

        // Load Worker services first, then initialize middleware adapters
        console.log('🏗️ Setting up Worker services...');
        const workerServiceLoader = require('./worker-service-adapter');
        await workerServiceLoader.loadWorkerServices();

        // Now initialize Hono middleware adapters with loaded services
        const honoAdapters = initializeMiddlewareAdapters(global.env);
        console.log('🔧 Initialized Hono middleware adapters for Worker compatibility');

        // Setup routes EXACTLY like Worker does
        console.log('📡 Setting up Worker-compatible API routes...');

        // Health check route (always public)
        app.get('/api/health', (c) => c.json({ status: 'ok' }));

        // Platform status route (public)
        app.get('/api/status', (c) => {
            return c.json(formatApiResponse({
                status: 'healthy',
                version: '1.0.0',
                platform: RUNTIME_PROVIDER,
                services: {
                    database: !!global.env.DB,
                    storage: !!global.env.STORAGE,
                    kv: !!global.env.KV
                }
            }));
        });

        // General health check
        app.get('/health', (c) => {
            return c.json(formatApiResponse({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                platform: RUNTIME_PROVIDER,
                environment: process.env.NODE_ENV || 'development'
            }));
        });

        // Load and setup routes using Worker route configurations
        await setupHonoCompatibleRoutes(app, honoAdapters);

        // Start the HTTP server with Hono
        const port = process.env.PORT || 3001;
        const server = serve({
            fetch: app.fetch,
            port: port,
            createServer: http.createServer,
        });

        // Add WebSocket server alongside HTTP server
        const wss = new WebSocket.Server({
            server: server,
            perMessageDeflate: false,
            maxPayload: 1024 * 1024 // 1MB
        });

// Handle WebSocket connections for agent communication
        wss.on('connection', async (ws, request) => {
            try {
                console.log('🔌 WebSocket connection attempt:', request.url);
                console.log('🔌 Request headers:', request.headers); // Debug headers

                // In Node.js, request.url is just the path, not a full URL
                const pathname = request.url;

                console.log('🔌 Parsed pathname:', pathname);

                // Check if this is an agent WebSocket connection
                const match = pathname.match(/^\/api\/agent\/([^\/]+)\/ws$/);
                if (!match) {
                    console.log(`🗣️ Rejecting WebSocket connection to ${pathname} - not an agent route`);
                    ws.close(1000, 'Invalid WebSocket endpoint');
                    return;
                }

                const agentId = match[1];
                console.log(`🔌 New WebSocket connection for agent: ${agentId}`);

                // Lazy import agent controller/state to avoid timing issues
                if (!agentControllerModule) {
                    agentControllerModule = require('./gcp-coding-agent-controller');
                }
                if (!agentStates) {
                    agentStates = agentControllerModule.agentStates;
                    console.log(`🔌 agentStates imported:`, typeof agentStates, agentStates ? 'defined' : 'undefined');
                }

                // Check if agent exists
                const agentState = await agentStates.get(agentId);
                if (!agentState) {
                    console.log(`❌ Agent ${agentId} not found for WebSocket connection`);
                    ws.close(1000, 'Agent not found');
                    return;
                }

                if (!agentState.websocketConnections) {
                    agentState.websocketConnections = new Set();
                }

                // Add WebSocket to agent connections
                agentState.websocketConnections.add(ws);
                ws.agentId = agentId;

                // Handle incoming messages from client
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        console.log(`?? WebSocket message for agent ${agentId}:`, message.type);

                        switch (message.type) {
                            case 'ping': {
                                sendSocketMessage(ws, { type: 'pong', timestamp: Date.now() });
                                break;
                            }
                            case 'get_status': {
                                sendSocketMessage(ws, {
                                    type: 'status',
                                    agentId,
                                    status: agentState.status,
                                    files: agentState.files,
                                    progress: agentState.status === 'completed' ? 100 :
                                        agentState.status === 'generating' ? 50 : 0,
                                    startedAt: agentState.generationStartedAt || null,
                                    completedAt: agentState.generationCompletedAt || null
                                });
                                break;
                            }
                            case 'generate_all': {
                                replayGenerationToSockets(agentId, agentState);
                                break;
                            }
                            case 'get_conversation_state': {
                                sendSocketMessage(ws, {
                                    type: 'conversation_state',
                                    state: buildConversationState(agentState)
                                });
                                break;
                            }
                            case 'clear_conversation': {
                                agentState.conversationHistory = [];
                                broadcastToAgentConnections(agentState, { type: 'conversation_cleared' });
                                broadcastToAgentConnections(agentState, {
                                    type: 'conversation_state',
                                    state: buildConversationState(agentState)
                                });
                                break;
                            }
                            case 'user_suggestion': {
                                const userMessage = typeof message.message === "string"
                                    ? message.message.trim()
                                    : '';
                                if (!userMessage) {
                                    sendSocketMessage(ws, {
                                        type: 'error',
                                        message: 'No message provided for user_suggestion'
                                    });
                                    break;
                                }

                                const conversationId = message.conversationId || `conv-${createConversationId()}`;
                                const timestamp = Date.now();

                                appendConversationEntry(agentState, {
                                    conversationId,
                                    role: 'user',
                                    content: [{ type: 'text', text: userMessage }],
                                    timestamp
                                });

                                const assistantResponse = buildAssistantResponse(agentState, userMessage);
                                appendConversationEntry(agentState, {
                                    conversationId,
                                    role: 'assistant',
                                    content: [{ type: 'text', text: assistantResponse }],
                                    timestamp: Date.now()
                                });

                                broadcastToAgentConnections(agentState, {
                                    type: 'conversation_response',
                                    conversationId,
                                    message: assistantResponse
                                });
                                break;
                            }
                            case 'get_model_configs': {
                                sendSocketMessage(ws, {
                                    type: 'model_configs_info',
                                    configs: ensureAgentModelConfigs(agentState)
                                });
                                break;
                            }
                            default: {
                                console.log(`Unhandled message type: ${message.type}`);
                                sendSocketMessage(ws, {
                                    type: 'error',
                                    message: `Unknown message type: ${message.type}`
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error handling WebSocket message for agent ${agentId}:`, error);
                        sendSocketMessage(ws, {
                            type: 'error',
                            message: 'Failed to process message'
                        });
                    }
                });
                // Handle WebSocket close
                ws.on('close', () => {
                    console.log(`🔌 WebSocket connection closed for agent: ${agentId}`);
                    if (agentState) {
                        agentState.websocketConnections.delete(ws);
                    }
                });

                // Handle WebSocket errors
                ws.on('error', (error) => {
                    console.error(`🔌 WebSocket error for agent ${agentId}:`, error);
                    if (agentState) {
                        agentState.websocketConnections.delete(ws);
                    }
                });

                console.log(`✅ WebSocket connection established for agent: ${agentId}`);

            } catch (error) {
                console.error('❌ Error setting up WebSocket connection:', error);
                ws.close(1011, 'Connection setup failed');
            }
        });

        console.log(`🚀 Hono Node server running on port ${port}`);
        console.log(`🔌 WebSocket server ready for agent connections`);
        console.log(`📡 Ready for requests from http://localhost:5173`);
        console.log(`🔧 Using existing Worker controllers and business logic`);
        console.log(`🏥 Health check: http://localhost:${port}/health`);

        // Log available routes (for debugging)
        console.log('\n Available API routes:');
        console.log('   GET  /health');
        console.log('   POST /api/agent (code generation)');
        console.log('   WS   /api/agent/:id/ws (WebSocket)');
        console.log('   GET  /api/agent/:id/connect');
        console.log('   GET  /api/agent/:id/preview');
        console.log('   GET  /api/status');
        console.log('   ... all Worker routes imported');

    } catch (error) {
        console.error('❌ Failed to start Hono server:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
})();

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Hono Node server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down Hono Node server gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('� Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
