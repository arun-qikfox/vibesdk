import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8080;

// Simple CORS headers
function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
}

// Handle preflight requests
function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res);
        res.writeHead(200);
        res.end();
        return true;
    }
    return false;
}

// Serve static files
function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// API handlers
function handleAPI(req, res, pathname) {
    setCORSHeaders(res);
    
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }
    
    if (pathname === '/api/auth/csrf-token') {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true,
            data: {
                token: token,
                headerName: 'X-CSRF-Token',
                expiresIn: 7200
            }
        }));
        return;
    }
    
    if (pathname === '/api/auth/providers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true,
            data: {
                providers: ['email', 'google', 'github']
            }
        }));
        return;
    }
    
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { email, name } = data;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: {
                            user: {
                                id: 'temp-' + Date.now(),
                                email: email || 'user@example.com',
                                name: name || 'User'
                            },
                            sessionId: 'session-' + Date.now(),
                            accessToken: 'temp-access-token',
                            refreshToken: 'temp-refresh-token'
                        },
                        message: 'Registration successful'
                    }));
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    console.error('Body received:', body);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false,
                        error: 'Invalid JSON',
                        details: error.message 
                    }));
                }
            });
            return;
        }
    
        if (pathname === '/api/auth/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { email, password } = data;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: {
                            user: {
                                id: 'temp-' + Date.now(),
                                email: email || 'user@example.com',
                                name: 'User'
                            },
                            sessionId: 'session-' + Date.now(),
                            accessToken: 'temp-access-token',
                            refreshToken: 'temp-refresh-token'
                        },
                        message: 'Login successful'
                    }));
                } catch (error) {
                    console.error('JSON parsing error:', error);
                    console.error('Body received:', body);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false,
                        error: 'Invalid JSON',
                        details: error.message 
                    }));
                }
            });
            return;
        }
    
    if (pathname === '/api/auth/check') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true,
            data: {
                authenticated: false, 
                user: null 
            }
        }));
        return;
    }
    
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
        return;
    }
    
    // Code generation routes
    if (pathname === '/api/agent' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            agentId: 'agent-' + Date.now(), 
            message: 'Code generation started' 
        }));
        return;
    }
    
    // Agent WebSocket simulation
    if (pathname.startsWith('/api/agent/') && pathname.endsWith('/ws')) {
        const agentId = pathname.split('/')[3];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            agentId, 
            message: 'WebSocket connection established' 
        }));
        return;
    }
    
    if (pathname.startsWith('/api/agent/') && pathname.endsWith('/connect')) {
        const agentId = pathname.split('/')[3];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            agentId, 
            message: 'Connected to agent' 
        }));
        return;
    }
    
    if (pathname.startsWith('/api/agent/') && pathname.endsWith('/preview')) {
        const agentId = pathname.split('/')[3];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            agentId, 
            previewUrl: 'https://preview.example.com/' + agentId 
        }));
        return;
    }
    
    // Default API response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
}

// Main request handler
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    console.log(`${req.method} ${pathname}`);
    
    // Handle preflight requests
    if (handlePreflight(req, res)) {
        return;
    }
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
        handleAPI(req, res, pathname);
        return;
    }
    
    // Serve static files
    let filePath = path.join(__dirname, 'dist/client', pathname);
    
    // Default to index.html for SPA routing
    if (pathname === '/' || !path.extname(filePath)) {
        filePath = path.join(__dirname, 'dist/client/index.html');
    }
    
    serveStaticFile(req, res, filePath);
});

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 QFX Cloud App running on port ${port}`);
    console.log(`📊 API Health: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth CSRF: http://localhost:${port}/api/auth/csrf-token`);
    console.log(`🌐 Frontend: http://localhost:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
