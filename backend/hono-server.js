const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const WebSocket = require('ws');
const http = require('http');
const { setupGlobalEnvironment } = require('./setup-env');
const { formatApiResponse, extractPathParams, extractQueryParams } = require('./api-client-router.js');
const { initializeMiddlewareAdapters } = require('./hono-middleware-adapters');
const { setupHonoCompatibleRoutes } = require('./setup-hono-routes');
const { agentStates } = require('./gcp-coding-agent-controller');

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
        wss.on('connection', (ws, request) => {
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

                // Check if agent exists
                const agentState = agentStates.get(agentId);
                if (!agentState) {
                    console.log(`❌ Agent ${agentId} not found for WebSocket connection`);
                    ws.close(1000, 'Agent not found');
                    return;
                }

                // Add WebSocket to agent connections
                agentState.websocketConnections.add(ws);
                ws.agentId = agentId;

                // Handle incoming messages from client
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        console.log(`📨 WebSocket message for agent ${agentId}:`, message.type);

                        // Handle different message types
                        switch (message.type) {
                            case 'ping':
                                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                                break;
                            case 'get_status':
                                ws.send(JSON.stringify({
                                    type: 'status',
                                    agentId,
                                    status: agentState.status,
                                    files: agentState.files,
                                    progress: agentState.status === 'completed' ? 100 :
                                            agentState.status === 'generating' ? 50 : 0
                                }));
                                break;
                            default:
                                console.log(`Unhandled message type: ${message.type}`);
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    message: `Unknown message type: ${message.type}`
                                }));
                        }
                    } catch (error) {
                        console.error(`Error handling WebSocket message for agent ${agentId}:`, error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to process message'
                        }));
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

                // Send initial connection confirmation
                ws.send(JSON.stringify({
                    type: 'connected',
                    agentId,
                    status: agentState.status,
                    message: `Connected to agent ${agentId}`
                }));

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
