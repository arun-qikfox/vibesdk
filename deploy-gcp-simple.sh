#!/bin/bash

# QFX Cloud App - Google Cloud Deployment Script with Simple Backend
# This script deploys the QFX Cloud App to Google Cloud Run with a simple Node.js backend

set -e

echo "🚀 QFX Cloud App - Starting Google Cloud Deployment with Simple Backend"

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
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set the project
echo "🔧 Setting project to ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}

# Build the application
echo "🔨 Building QFX Cloud App..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Create a simple Node.js server
echo "🐳 Creating simple Node.js server..."
cat > cloudrun-server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

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
        res.end(JSON.stringify({ csrfToken: token }));
        return;
    }
    
    if (pathname === '/api/auth/providers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ providers: ['email', 'google', 'github'] }));
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
                    message: 'Registration successful', 
                    user: { 
                        id: 'temp-' + Date.now(), 
                        email: email || 'user@example.com', 
                        name: name || 'User' 
                    } 
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
                    message: 'Login successful', 
                    user: { 
                        id: 'temp-' + Date.now(), 
                        email: email || 'user@example.com', 
                        name: 'User' 
                    }, 
                    accessToken: 'temp-access-token', 
                    refreshToken: 'temp-refresh-token' 
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    if (pathname === '/api/auth/check') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: false, user: null }));
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
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
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
EOF

# Create a Dockerfile for Cloud Run
echo "🐳 Creating Dockerfile for Cloud Run..."
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/

# Copy the server
COPY cloudrun-server.js ./

EXPOSE 8080

CMD ["node", "cloudrun-server.js"]
EOF

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t ${IMAGE_NAME} .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

# Push to Google Container Registry
echo "📤 Pushing image to Google Container Registry..."
docker push ${IMAGE_NAME}

if [ $? -ne 0 ]; then
    echo "❌ Docker push failed"
    exit 1
fi

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    --timeout 300

# Set IAM policy to allow unauthenticated access
echo "🔐 Setting IAM policy for public access..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
    --region=${REGION} \
    --member="allUsers" \
    --role="roles/run.invoker"

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run deployment failed"
    exit 1
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo "✅ QFX Cloud App with Simple Backend deployed successfully!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "🎉 Your QFX Cloud App is now live on Google Cloud Run!"
echo "   Visit: ${SERVICE_URL}"
echo "   API Health: ${SERVICE_URL}/api/health"
echo "   Auth CSRF: ${SERVICE_URL}/api/auth/csrf-token"
echo ""
echo "📊 To view logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE_NAME}' --limit=20"
echo "🔄 To update: Run this script again"
echo "🗑️  To delete: gcloud run services delete ${SERVICE_NAME} --region=${REGION}"

# Clean up
rm -f Dockerfile cloudrun-server.js

echo "✨ Deployment completed successfully!"
