const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { setupGlobalEnvironment } = require('./setup-env');
const { formatApiResponse } = require('./api-client-router.js');
const { initializeMiddlewareAdapters } = require('./hono-middleware-adapters');
const { setupHonoCompatibleRoutes } = require('./setup-hono-routes');
const agentManager = require('./gcp-agent-manager');

const app = new Hono();
const fileSystem = fs.promises;

const STATIC_ROOT = path.join(__dirname, '..', 'dist');
const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
};

const isDirectoryAvailable = (dirPath) => {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
};

const staticDirs = [
    { prefix: '/assets/', root: STATIC_ROOT },
    { prefix: '/static/', root: STATIC_ROOT },
];

async function serveStaticAsset(c, filePath) {
    if (!filePath) {
        return c.notFound();
    }

    try {
        const data = await fileSystem.readFile(filePath);
        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';

        return c.body(data, 200, {
            'Content-Type': contentType,
            'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=604800, immutable'
        });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`[Static] Failed to read ${filePath}:`, error.message);
        }
        return c.notFound();
    }
}

function resolveStaticPath(rootDir, requestPath, prefix = '') {
    if (!isDirectoryAvailable(rootDir)) {
        return null;
    }

    const relativePath = prefix
        ? requestPath.replace(prefix, '')
        : requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;

    const normalised = path.normalize(relativePath);
    // Prevent directory traversal
    if (normalised.includes('..')) {
        return null;
    }

    const fullPath = path.join(rootDir, normalised);
    if (!fullPath.startsWith(rootDir)) {
        return null;
    }

    return fullPath;
}

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

        // Serve built frontend assets when available
        if (isDirectoryAvailable(STATIC_ROOT)) {
            console.log(`[Static] Serving frontend assets from ${STATIC_ROOT}`);

            for (const { prefix, root } of staticDirs) {
                app.get(`${prefix}*`, async (c) => {
                    const assetPath = resolveStaticPath(root, c.req.path, prefix);
                    return serveStaticAsset(c, assetPath);
                });
            }

            app.get('/favicon.ico', async (c) => {
                const faviconPath =
                    resolveStaticPath(PUBLIC_ROOT, 'favicon.ico') ||
                    resolveStaticPath(STATIC_ROOT, 'favicon.ico');
                return serveStaticAsset(c, faviconPath);
            });

            app.get('/robots.txt', async (c) => {
                const robotsPath =
                    resolveStaticPath(PUBLIC_ROOT, 'robots.txt') ||
                    resolveStaticPath(STATIC_ROOT, 'robots.txt');
                return serveStaticAsset(c, robotsPath);
            });

            app.get('*', async (c) => {
                const method = c.req.method.toUpperCase();
                const pathname = c.req.path || '/';

                if (method !== 'GET') {
                    return c.notFound();
                }

                if (pathname.startsWith('/api') || pathname.startsWith('/__')) {
                    return c.notFound();
                }

                const indexFile = resolveStaticPath(STATIC_ROOT, 'index.html');
                if (!indexFile) {
                    console.warn('[Static] index.html not found, skipping SPA fallback');
                    return c.notFound();
                }

                try {
                    const html = await fileSystem.readFile(indexFile, 'utf-8');
                    return c.html(html);
                } catch (error) {
                    console.error('[Static] Failed to serve index.html:', error.message);
                    return c.notFound();
                }
            });
        } else {
            console.warn('[Static] Build directory not found; frontend assets will not be served');
        }

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
