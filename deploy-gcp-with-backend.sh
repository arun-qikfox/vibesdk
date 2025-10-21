#!/bin/bash

# QFX Cloud App - Google Cloud Deployment Script with Backend API
# This script deploys the QFX Cloud App to Google Cloud Run with backend API support

set -e

echo "🚀 QFX Cloud App - Starting Google Cloud Deployment with Backend API"

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

# Create a Dockerfile for Cloud Run with backend API
echo "🐳 Creating Dockerfile for Cloud Run with Backend API..."
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including express and hono
RUN npm ci --only=production && npm install express hono @hono/node-server

# Copy built application
COPY dist/ ./dist/

# Create a server that serves both frontend and backend API
RUN echo 'import express from "express"; import path from "path"; import { fileURLToPath } from "url"; import { Hono } from "hono"; import { serve } from "@hono/node-server"; import { cors } from "hono/cors"; import { secureHeaders } from "hono/secure-headers"; const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename); const app = express(); const port = process.env.PORT || 8080; // Create Hono app for API routes const api = new Hono(); // CORS middleware api.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"], })); // Security headers api.use("*", secureHeaders()); // Health check api.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() })); // Auth routes api.get("/api/auth/csrf-token", (c) => { const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); return c.json({ csrfToken: token }); }); api.get("/api/auth/providers", (c) => c.json({ providers: ["email", "google", "github"] })); api.post("/api/auth/register", async (c) => { const body = await c.req.json(); return c.json({ success: true, message: "Registration successful", user: { id: "temp-" + Date.now(), email: body.email, name: body.name } }); }); api.post("/api/auth/login", async (c) => { const body = await c.req.json(); return c.json({ success: true, message: "Login successful", user: { id: "temp-" + Date.now(), email: body.email, name: body.name }, accessToken: "temp-access-token", refreshToken: "temp-refresh-token" }); }); api.get("/api/auth/check", (c) => c.json({ authenticated: false, user: null })); api.post("/api/auth/logout", (c) => c.json({ success: true, message: "Logged out successfully" })); // Code generation routes api.post("/api/agent", async (c) => { const body = await c.req.json(); return c.json({ success: true, agentId: "agent-" + Date.now(), message: "Code generation started" }); }); api.get("/api/agent/:agentId/ws", (c) => { const agentId = c.req.param("agentId"); return c.json({ success: true, agentId, message: "WebSocket connection established" }); }); api.get("/api/agent/:agentId/connect", (c) => { const agentId = c.req.param("agentId"); return c.json({ success: true, agentId, message: "Connected to agent" }); }); api.get("/api/agent/:agentId/preview", (c) => { const agentId = c.req.param("agentId"); return c.json({ success: true, agentId, previewUrl: "https://preview.example.com/" + agentId }); }); // Serve static files app.use(express.static(path.join(__dirname, "dist/client"))); // Mount API routes app.use("/", serve({ fetch: api.fetch, port: 0 })); // Fallback to index.html for SPA app.use((req, res) => { res.sendFile(path.join(__dirname, "dist/client/index.html")); }); app.listen(port, "0.0.0.0", () => { console.log(`QFX Cloud App with Backend API running on port ${port}`); });' > server.js

EXPOSE 8080

CMD ["node", "server.js"]
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

echo "✅ QFX Cloud App with Backend API deployed successfully!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "🎉 Your QFX Cloud App is now live on Google Cloud Run!"
echo "   Visit: ${SERVICE_URL}"
echo "   API Health: ${SERVICE_URL}/api/health"
echo "   Auth CSRF: ${SERVICE_URL}/api/auth/csrf-token"
echo ""
echo "📊 To view logs: gcloud logs tail --service=${SERVICE_NAME} --region=${REGION}"
echo "🔄 To update: Run this script again"
echo "🗑️  To delete: gcloud run services delete ${SERVICE_NAME} --region=${REGION}"

# Clean up
rm -f Dockerfile

echo "✨ Deployment completed successfully!"
