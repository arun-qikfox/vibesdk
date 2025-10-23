#!/bin/bash

# QFX Cloud App - Google Cloud Deployment with Enhanced Error Handling
# This script deploys the QFX Cloud App to Google Cloud Run with improved JSON parsing

set -e

echo "🚀 QFX Cloud App - Starting Google Cloud Deployment with Enhanced Error Handling"

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"qfxcloud-app-builder"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="qfx-cloud-app"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "📋 Deployment Configuration:"
echo "  Project ID: ${PROJECT_ID}"
echo "  Region: ${REGION}"
echo "  Service Name: ${SERVICE_NAME}"
echo "  Image: ${IMAGE_NAME}"

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install gcloud CLI: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not authenticated with gcloud."
    echo "Please run 'gcloud auth login' to authenticate."
    exit 1
fi

# Set GCP Project
echo "Setting Google Cloud project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Build the worker (backend)
echo "⚙️ Building worker (backend)..."
npm run build:worker

# Create a temporary directory for the Docker build context
BUILD_DIR=$(mktemp -d)
echo "Created temporary build directory: ${BUILD_DIR}"

# Copy necessary files to the build directory
cp -r dist/client ${BUILD_DIR}/client
cp -r dist/worker-bundle ${BUILD_DIR}/worker
cp package.json ${BUILD_DIR}/package.json
cp package-lock.json ${BUILD_DIR}/package-lock.json
cp vite.config.ts ${BUILD_DIR}/vite.config.ts
cp tsconfig.json ${BUILD_DIR}/tsconfig.json
cp tsconfig.node.json ${BUILD_DIR}/tsconfig.node.json
cp tsconfig.worker.json ${BUILD_DIR}/tsconfig.worker.json
cp -r shared ${BUILD_DIR}/shared
cp -r scripts ${BUILD_DIR}/scripts
cp -r container ${BUILD_DIR}/container

# Create an enhanced Express server with better error handling
cat << 'EOF' > ${BUILD_DIR}/cloudrun-server.mjs
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } }));
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
        let bodyLength = 0;
        const contentLength = parseInt(req.headers['content-length'] || '0');
        
        req.on('data', chunk => {
            body += chunk.toString();
            bodyLength += chunk.length;
        });
        
        req.on('end', () => {
            console.log('Register request received - Content-Length:', contentLength, 'Body-Length:', bodyLength);
            console.log('Body content:', body);
            
            if (bodyLength === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false,
                    error: 'Empty request body',
                    details: 'No data received'
                }));
                return;
            }
            
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
                console.error('Body received:', JSON.stringify(body));
                console.error('Body length:', body.length);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false,
                    error: 'Invalid JSON',
                    details: error.message 
                }));
            }
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false,
                error: 'Request error',
                details: error.message 
            }));
        });
        
        return;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
        // Try a different approach for Cloud Run
        const chunks = [];
        let bodyLength = 0;
        const contentLength = parseInt(req.headers['content-length'] || '0');
        
        console.log('Login request received - Content-Length:', contentLength);
        console.log('Request headers:', JSON.stringify(req.headers));
        
        req.on('data', chunk => {
            console.log('Received chunk:', chunk.length, 'bytes');
            chunks.push(chunk);
            bodyLength += chunk.length;
        });
        
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            console.log('Login request received - Content-Length:', contentLength, 'Body-Length:', bodyLength);
            console.log('Body content:', body);
            
            if (bodyLength === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false,
                    error: 'Empty request body',
                    details: 'No data received'
                }));
                return;
            }
            
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
                console.error('Body received:', JSON.stringify(body));
                console.error('Body length:', body.length);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false,
                    error: 'Invalid JSON',
                    details: error.message 
                }));
            }
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false,
                error: 'Request error',
                details: error.message 
            }));
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

    // Serve static files from the 'dist/client' directory
    const clientPath = path.join(__dirname, 'client');
    let filePath = path.join(clientPath, pathname);

    // If it's a directory or root, serve index.html
    try {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch (e) {
        // File not found, try index.html
        filePath = path.join(clientPath, 'index.html');
    }

    try {
        const content = await fs.readFile(filePath);
        const contentType = getContentType(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

function getContentType(filePath) {
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.ico': 'image/x-icon'
    };
    return mimeTypes[extname] || 'application/octet-stream';
}

server.listen(port, () => {
    console.log(`QFX Cloud App server listening on port ${port}`);
});
EOF

# Create Dockerfile for Cloud Run
cat << 'EOF' > ${BUILD_DIR}/Dockerfile
# Use a Node.js 20 runtime
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY client ./client
COPY worker ./worker
COPY cloudrun-server.mjs ./cloudrun-server.mjs
COPY shared ./shared
COPY scripts ./scripts
COPY container ./container
COPY vite.config.ts ./vite.config.ts
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.node.json ./tsconfig.node.json
COPY tsconfig.worker.json ./tsconfig.worker.json

# Expose the port the app runs on
EXPOSE 8080

# Run the server
CMD ["node", "cloudrun-server.mjs"]
EOF

echo "Building Docker image: ${IMAGE_NAME}..."
gcloud builds submit --tag ${IMAGE_NAME} ${BUILD_DIR}

echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --port 8080 \
    --set-env-vars QFX_ENV=production,GEMINI_API_KEY=${GEMINI_API_KEY},REACT_APP_API_URL=https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app \
    --update-secrets=DATABASE_URL=vibesdk-sql-connection-url:latest \
    --project ${PROJECT_ID}

# Clean up temporary build directory
rm -rf ${BUILD_DIR}
echo "Cleaned up temporary build directory: ${BUILD_DIR}"

echo "✅ QFX Cloud App deployed successfully to Cloud Run!"
echo "Application URL: $(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)')"
EOF

chmod +x deploy-gcp-esmodule.sh