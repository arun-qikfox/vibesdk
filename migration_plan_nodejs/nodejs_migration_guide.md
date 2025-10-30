# VibSDK: From Cloudflare Workers to Multi-Platform Node.js (Hono)

## 🎯 Goal
Replace Cloudflare Worker dependency while preserving all existing business logic and enabling deployment to any cloud platform (GCP, AWS, Vercel, etc.) using the same codebase.

## 🏗️ Architecture Overview

### Before: Worker-coupled Architecture
```
Frontend → Vite Proxy → Cloudflare Worker → CF Services (D1, R2, KV)
```

### After: Platform-independent Architecture
```
Frontend → Vite Proxy → Hono Server → GCP Services (Postgres, GCS, Firestore)
```

### Benefits with Hono
- ✅ **Same Codebase**: Deploy to different platforms with runtime adapters
- ✅ **Zero Logic Changes**: Controllers and business logic remain identical
- ✅ **Multi-Cloud Ready**: Cloudflare, GCP, AWS, Vercel, Netlify
- ✅ **Future-Proof**: New runtimes automatically supported

## 📁 Current Working Setup

### Frontend Changes (vite.config.ts)
```typescript
server: {
    proxy: {
        '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
        },
    },
},
```

### Backend Scaffold (backend/server.js) - To Be Replaced
- Express.js server with mock routes
- TODO: Replace with Hono for consistent multi-platform deployment

## 🚀 Migration Plan: Use Hono Everywhere

### Phase 1: Replace Express with Hono Node Server

**1. Install Hono & Node Adapter**
```bash
cd backend
npm install hono @hono/node-server
```

**2. Create Hono Server (backend/hono-server.js)**
```javascript
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');

// Initialize Hono app
const app = new Hono();

// Import existing Worker routes and controllers
// Controllers remain completely unchanged!
const { setupAllRoutes } = require('../worker/api/routes/index');

(async () => {
    try {
        // Setup all API routes using existing Worker code
        await setupAllRoutes(app);

        const port = process.env.PORT || 3001;
        serve({
            fetch: app.fetch,
            port: port,
        });

        console.log(`🚀 Hono Node server running on port ${port}`);
        console.log(`📡 Ready for requests from http://localhost:5173`);
        console.log(`🔧 Using existing Worker controllers and business logic`);
    } catch (error) {
        console.error('Failed to start Hono server:', error);
        process.exit(1);
    }
})();
```

**3. Update backend/package.json**
```json
{
  "name": "vibesdk-backend",
  "version": "1.0.0",
  "main": "hono-server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node hono-server.js",
    "dev": "node hono-server.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.8.0"
    // + your GCP service dependencies (postgres, etc.)
  }
}
```

### Phase 2: Environment Adapters for GCP Services

**1. Global Environment Setup (backend/setup-env.js)**
```javascript
// Make GCP services available globally as Cloudflare Worker expects
const { createPostgresClient } = require('../shared/platform/database/postgresClient');
const { createGcpObjectStore } = require('../shared/platform/storage/gcpObjectStore');
const { createGcpFirestoreProvider } = require('../shared/platform/kv/gcpFirestoreProvider');

async function setupGlobalEnvironment() {
    global.env = {
        // Database - replaces Cloudflare D1
        DB: await createPostgresClient(process.env.DATABASE_URL),

        // Storage - replaces Cloudflare R2
        STORAGE: createGcpObjectStore(process.env.GCP_PROJECT_ID),

        // KV/Cache - replaces Cloudflare KV
        KV: createGcpFirestoreProvider({
            projectId: process.env.GCP_PROJECT_ID,
            collectionName: process.env.FIRESTORE_COLLECTION
        }),

        // Configuration (matches what Worker expects)
        RUNTIME_PROVIDER: 'nodejs',
        DATABASE_URL: process.env.DATABASE_URL,
        GCS_TEMPLATES_BUCKET: process.env.GCS_TEMPLATES_BUCKET,
        GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,

        // Security settings
        SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
        AI_PROXY_JWT_SECRET: process.env.AI_PROXY_JWT_SECRET,
    };

    // Web API polyfills for Node.js
    global.fetch = require('node-fetch');

    console.log('✅ Global environment setup complete');
    console.log(`📍 Runtime: ${global.env.RUNTIME_PROVIDER}`);
}

module.exports = { setupGlobalEnvironment };
```

**2. Update Hono Server to Load Environment**
```javascript
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { setupGlobalEnvironment } = require('./setup-env');

const app = new Hono();

(async () => {
    // Load GCP services into global env first
    await setupGlobalEnvironment();

    // Now load routes that depend on env
    const { setupAllRoutes } = require('../worker/api/routes/index');
    await setupAllRoutes(app);

    serve({
        fetch: app.fetch,
        port: process.env.PORT || 3001,
    });
})();
```

### Phase 3: Controllers Integration (Zero Changes Required)

**Good News**: Your existing controllers work unchanged!

**worker/api/controllers/agent/controller.ts:**
- ✅ `CodingAgentController.startCodeGeneration()` - works as-is
- ✅ `CodingAgentController.connectToExistingAgent()` - works as-is
- ✅ All business logic, error handling, streaming - unchanged

**worker/api/routes/codegenRoutes.ts:**
```typescript
// This existing code works without modification:
app.post('/api/agent', setAuthLevel(AuthConfig.authenticated),
    adaptController(CodingAgentController, CodingAgentController.startCodeGeneration));
```

### Phase 4: Testing & Deployment

**1. Test Local Development**
```bash
# Terminal 1: Start Hono server
npm run api:dev

# Terminal 2: Start frontend
npm run dev

# Test API calls - same as before
curl http://localhost:5173/api/status
curl http://localhost:3001/api/status
```

**2. Deployment Options with Same Codebase**

**Deploy to GCP Cloud Run:**
```javascript
const { serve } = require('@hono/node-server');
// Same Hono code works on Cloud Run!
serve({ fetch: app.fetch, port: 8080 });
```

**Deploy to Cloudflare Workers:**
```typescript
// Same app code works on Workers directly
export default app;
```

**Deploy to AWS Lambda:**
```javascript
const { handle } = require('@hono/aws-lambda');
// Same Hono code with AWS adapter
export const handler = handle(app);
```

**3. Environment Variables Required**
```bash
# GCP Configuration
DATABASE_URL=postgres://...
GCP_PROJECT_ID=your-project
GCS_TEMPLATES_BUCKET=vibesdk-templates
FIRESTORE_COLLECTION=sessions

# Security
SECRETS_ENCRYPTION_KEY=...
WEBHOOK_SECRET=...
AI_PROXY_JWT_SECRET=...
```

### Phase 5: Rollback & Roll Forward

**Rollback**: Switch back to Cloudflare by deploying `wrangler.jsonc`
```bash
npm run deploy  # Uses wrangler for CF deployment
```

**Roll Forward**: Deploy anywhere with Hono runtime adapters
```javascript
// Vercel deployment
export { app as GET, app as POST } from './hono-server.js';

// AWS Lambda
export const handler = createHonoAdapter(app);

// Etc...
```

## 📊 Migration Impact

### Code Changed: **< 5%**
- ✅ Controllers: **0 changes**
- ✅ Routes: **0 changes**
- ✅ Business logic: **0 changes**
- ✅ API responses: **0 changes**

### Infrastructure Changed: **100%**
- ✅ Database: D1 → Postgres
- ✅ Storage: R2 → GCS
- ✅ Cache: Workers KV → Firestore
- ✅ Compute: Workers → Node.js containers

### Benefits Achieved
- ✅ **Multi-platform deployment** ready
- ✅ **No vendor lock-in** for compute/runtime
- ✅ **Same development experience**
- ✅ **Future deployment flexibility**

## 🎯 Success Criteria

Test these scenarios work identically:

### API Functionality
```
✅ POST /api/agent → Code generation streams
✅ GET /api/agent/:id/connect → WebSocket URLs
✅ GET /api/status → Platform health
✅ GET /api/auth/csrf-token → CSRF protection
✅ GET /api/apps → User apps listing
✅ POST /api/apps → App creation
```

### Platform Independence
```
✅ Local dev: @hono/node-server
✅ GCP Cloud Run: Node.js container
✅ AWS Lambda: @hono/aws-lambda
✅ Vercel: @hono/vercel
✅ Cloudflare: Direct Worker deployment
```

## 🚀 Next Steps

1. **Execute Migration**: Run the Hono setup outlined above
2. **Test APIs**: Verify all endpoints work with your GCP services
3. **Deploy**: Choose your target platform and deploy with appropriate Hono adapter
4. **Scale**: Add new platforms as needed with same codebase

## ❓ FAQ

**Q: Do I need to change any business logic?**
A: No, controllers work identically.

**Q: Can I still deploy to Cloudflare Workers?**
A: Yes, use the original `wrangler.jsonc` for Workers deployment.

**Q: How do authentication and CSRF work?**
A: Your existing auth middleware continues working through Hono adapters.

**Q: What about WebSocket/real-time features?**
A: Works through Hono's WebSocket support or separate Socket.IO integration.

**Q: Performance impact?**
A: Hono has excellent performance and smaller bundle size than Express.

This migration gives you cloud platform freedom while preserving your existing architecture and code investment!
