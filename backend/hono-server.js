const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const WebSocket = require('ws');
const http = require('http');
const { setupGlobalEnvironment } = require('./setup-env');
const { formatApiResponse } = require('./api-client-router.js');
const { initializeMiddlewareAdapters } = require('./hono-middleware-adapters');
const { setupHonoCompatibleRoutes } = require('./setup-hono-routes');
const agentManager = require('./gcp-agent-manager');

const app = new Hono();

(async () => {
    try {
        console.log('[Server] Initializing Hono Node.js server...');
        await setupGlobalEnvironment();

        console.log('[Server] Setting up worker services...');
        const workerServiceLoader = require('./worker-service-adapter');
        await workerServiceLoader.loadWorkerServices();

        const honoAdapters = initializeMiddlewareAdapters(global.env);
        const RUNTIME_PROVIDER = global.env.RUNTIME_PROVIDER || 'gcp';
        console.log('[Server] Setting up worker-compatible API routes...');

        app.get('/api/health', (c) => c.json({ status: 'ok' }));

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

        app.get('/health', (c) => {
            return c.json(formatApiResponse({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                platform: RUNTIME_PROVIDER,
                environment: process.env.NODE_ENV || 'development'
            }));
        });

        await setupHonoCompatibleRoutes(app, honoAdapters);

        const port = process.env.PORT || 3001;
        const server = serve({
            fetch: app.fetch,
            port,
            createServer: http.createServer,
        });

        const wss = new WebSocket.Server({
            server,
            perMessageDeflate: false,
            maxPayload: 1024 * 1024,
        });

        wss.on('connection', async (ws, request) => {
            try {
                const pathname = request.url;
                const match = pathname.match(/^\/api\/agent\/([^\/]+)\/ws$/);
                if (!match) {
                    console.log(`[WebSocket] Rejecting connection to ${pathname} - not an agent route`);
                    ws.close(1000, 'Invalid WebSocket endpoint');
                    return;
                }

                const agentId = match[1];
                console.log(`[WebSocket] New connection attempt for agent: ${agentId}`);

                // Check if agent exists
                const agentEntry = agentManager.getAgent(agentId);
                if (!agentEntry) {
                    console.log(`[WebSocket] Agent ${agentId} not found in agent manager`);
                    console.log(`[WebSocket] Available agents:`, agentManager.listAgents());
                    console.log(`[WebSocket] This usually means the agent initialization failed or the agent ID is incorrect`);
                    ws.close(1000, 'Agent not found');
                    return;
                }

                console.log(`[WebSocket] Found agent ${agentId}, attaching connection...`);
                await agentManager.attachConnection(agentId, ws, request);
                console.log(`[WebSocket] Connection established successfully for agent: ${agentId}`);
            } catch (error) {
                console.error('[WebSocket] Error setting up connection:', error);
                try {
                    ws.close(1011, 'Connection setup failed');
                } catch (closeError) {
                    console.error('Failed to close WebSocket after error:', closeError);
                }
            }
        });

        console.log(`[Server] Hono Node server running on port ${port}`);
        console.log('[Server] WebSocket server ready for agent connections');
        console.log('[Server] Ready for requests from http://localhost:5173');
        console.log('[Server] Worker routes loaded via setupHonoCompatibleRoutes');
    } catch (error) {
        console.error('[Server] Failed to start Hono server:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
})();

process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down Hono Node server gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Shutting down Hono Node server gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
