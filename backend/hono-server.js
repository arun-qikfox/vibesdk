const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { setupGlobalEnvironment } = require('./setup-env');
const { formatApiResponse, extractPathParams, extractQueryParams } = require('./api-client-router.js');
const { initializeMiddlewareAdapters } = require('./hono-middleware-adapters');
const { setupHonoCompatibleRoutes } = require('./setup-hono-routes');

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

        // Start the server
        const port = process.env.PORT || 3001;
        serve({
            fetch: app.fetch,
            port: port,
        });

        console.log(`🚀 Hono Node server running on port ${port}`);
        console.log(`📡 Ready for requests from http://localhost:5173`);
        console.log(`🔧 Using existing Worker controllers and business logic`);
        console.log(`🏥 Health check: http://localhost:${port}/health`);

        // Log available routes (for debugging)
        console.log('\n� Available API routes:');
        console.log('   GET  /health');
        console.log('   POST /api/agent (code generation)');
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
