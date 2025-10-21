#!/bin/bash

# QFX Cloud App - Local Test Script
# This script tests the application locally before deployment

set -e

echo "🧪 QFX Cloud App - Local Testing"

# Build the application
echo "🔨 Building QFX Cloud App..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Create a local server for testing
echo "🌐 Creating local test server..."
cat > test-server.js << 'EOF'
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
}));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes
app.get("/api/auth/csrf-token", (req, res) => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    res.json({ csrfToken: token });
});

app.get("/api/auth/providers", (req, res) => {
    res.json({ providers: ["email", "google", "github"] });
});

app.post("/api/auth/register", (req, res) => {
    const { email, name } = req.body;
    res.json({ 
        success: true, 
        message: "Registration successful", 
        user: { 
            id: "temp-" + Date.now(), 
            email: email || "user@example.com", 
            name: name || "User" 
        } 
    });
});

app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    res.json({ 
        success: true, 
        message: "Login successful", 
        user: { 
            id: "temp-" + Date.now(), 
            email: email || "user@example.com", 
            name: "User" 
        }, 
        accessToken: "temp-access-token", 
        refreshToken: "temp-refresh-token" 
    });
});

app.get("/api/auth/check", (req, res) => {
    res.json({ authenticated: false, user: null });
});

app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
});

// Code generation routes
app.post("/api/agent", (req, res) => {
    res.json({ 
        success: true, 
        agentId: "agent-" + Date.now(), 
        message: "Code generation started" 
    });
});

app.get("/api/agent/:agentId/ws", (req, res) => {
    const agentId = req.params.agentId;
    res.json({ 
        success: true, 
        agentId, 
        message: "WebSocket connection established" 
    });
});

app.get("/api/agent/:agentId/connect", (req, res) => {
    const agentId = req.params.agentId;
    res.json({ 
        success: true, 
        agentId, 
        message: "Connected to agent" 
    });
});

app.get("/api/agent/:agentId/preview", (req, res) => {
    const agentId = req.params.agentId;
    res.json({ 
        success: true, 
        agentId, 
        previewUrl: "https://preview.example.com/" + agentId 
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, "dist/client")));

// Fallback to index.html for SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "dist/client/index.html"));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 QFX Cloud App running locally on http://localhost:${port}`);
    console.log(`📊 API Health: http://localhost:${port}/api/health`);
    console.log(`🔐 Auth CSRF: http://localhost:${port}/api/auth/csrf-token`);
    console.log(`\n🧪 Test the following endpoints:`);
    console.log(`   curl http://localhost:${port}/api/health`);
    console.log(`   curl http://localhost:${port}/api/auth/csrf-token`);
    console.log(`   curl -X POST http://localhost:${port}/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","name":"Test User"}'`);
    console.log(`\n🌐 Open http://localhost:${port} in your browser to test the frontend`);
});
EOF

# Install express and cors if not already installed
echo "📦 Installing test dependencies..."
npm install express cors

# Start the local server
echo "🚀 Starting local test server..."
echo "Press Ctrl+C to stop the server"
node test-server.js
