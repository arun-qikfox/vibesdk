# GCP App Engine Implementation Phases

This document outlines the phased approach for implementing Google App Engine deployment support in VibeSDK.

> **📋 Original Plan**: See [original-plan.md](./original-plan.md) for the detailed original implementation plan that guided Phase 1 development.

## 📋 Phase Overview

| Phase | Status | Description | Target Date |
|-------|--------|-------------|-------------|
| **Phase 1** | ✅ **COMPLETED** | Static frontend deployment | Completed |
| **Phase 2** | ⏳ **PLANNED** | Backend API deployment | TBD |
| **Phase 3** | ⏳ **PLANNED** | Database and storage integration | TBD |
| **Phase 4** | ⏳ **PLANNED** | Full-stack application deployment | TBD |

---

## ✅ Phase 1: Static Frontend Deployment (COMPLETED)

### Objectives
- Deploy React/Vue frontend applications to App Engine
- Support client-side routing (React Router)
- Serve static assets with proper caching
- Maintain platform independence

### Implementation Details

#### 1.1 Configuration and Setup
- ✅ Created `worker/config/deployment-config.ts` for target selection
- ✅ Added environment variables: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`
- ✅ Added `DEFAULT_DEPLOYMENT_TARGET` configuration option

#### 1.2 YAML Generation
- ✅ Created `worker/services/deployer/appengine-yaml-generator.ts`
- ✅ Implemented `generateStaticAppYaml()` function
- ✅ Implemented `generateShortServiceName()` function
- ✅ Configured for `dist/client/` build output path

#### 1.3 Deployment Execution
- ✅ Implemented `deployToAppEngine()` in `sandboxSdkClient.ts`
- ✅ Added `.gcloudignore` file generation
- ✅ Integrated gcloud CLI authentication
- ✅ Added deployment URL generation with `-dot-` format

#### 1.4 Agent Integration
- ✅ Added `deployToAppEngine()` method to `SimpleCodeGeneratorAgent`
- ✅ Added WebSocket message types for App Engine deployment
- ✅ Integrated with frontend UI components

#### 1.5 Infrastructure
- ✅ Updated `SandboxDockerfile` to include gcloud CLI
- ✅ Added App Engine deployment API routes
- ✅ Updated frontend to support App Engine deployment UI

### Key Features
- ✅ Short service name generation (avoids domain size limits)
- ✅ Static asset caching (1 year for assets, no cache for index.html)
- ✅ React Router support (all routes serve index.html)
- ✅ Secure deployment (only dist/client/ uploaded)

### Testing Checklist
- [x] Frontend builds successfully
- [x] app.yaml generated correctly
- [x] .gcloudignore excludes source files
- [x] gcloud authentication works
- [x] Deployment succeeds
- [x] Application accessible via URL
- [x] Client-side routing works
- [x] Static assets load correctly

---

## ✅ Phase 2: Backend API Deployment (COMPLETED)

### Objectives
- Deploy Node.js/Express backend APIs to App Engine
- Support RESTful API endpoints
- Handle environment variables and secrets
- Integrate with frontend deployment

### Implementation Details

#### 2.1 Backend Detection
- ✅ Detect backend framework (Express, Fastify, etc.)
- ✅ Check for common entry points (server.js, index.js, src/server.ts, etc.)
- ✅ Detect API routes directory
- ✅ Identify Node.js server patterns (express, fastify, listen, createServer)

#### 2.2 Backend Build Configuration
- ✅ Detect backend entry point
- ✅ Handle TypeScript backends (runtime compilation)
- ✅ Generate backend app.yaml configuration
- ✅ Support environment variables in app.yaml

#### 2.3 App Engine Configuration
- ✅ Configure Node.js runtime (nodejs20)
- ✅ Set up auto-scaling (0-10 instances)
- ✅ Configure CPU and throughput utilization targets
- ✅ Generate full-stack app.yaml (frontend + backend)

#### 2.4 Deployment Flow
- ✅ Build both frontend and backend
- ✅ Deploy full-stack application to single App Engine service
- ✅ Generate appropriate .gcloudignore based on app type
- ✅ Handle both frontend-only and full-stack deployments

### Key Features
- ✅ Automatic backend detection
- ✅ Full-stack deployment in single service
- ✅ Proper static asset handling with backend API routes
- ✅ Environment variable support
- ✅ Backward compatible with Phase 1 (frontend-only)

### Testing Checklist
- [x] Backend detection works correctly
- [x] Full-stack app.yaml generated correctly
- [x] .gcloudignore includes backend files when needed
- [x] Frontend-only deployments still work (backward compatible)
- [x] Deployment succeeds for full-stack apps
- [x] API routes accessible after deployment

### Requirements
- ✅ Backend code is platform-independent
- ✅ No Cloudflare-specific dependencies required
- ✅ Support for standard Node.js frameworks (Express, Fastify)
- ✅ Support for Hono-based Cloudflare Worker apps (via wrangler.jsonc parsing)
- ✅ Environment variable management via app.yaml

### Phase 2.5: Hono Full-Stack Support (COMPLETED)

#### Objectives
- Detect Hono-based full-stack applications via wrangler.jsonc
- Parse Cloudflare Worker configuration to extract deployment settings
- Generate App Engine app.yaml dynamically based on wrangler.jsonc

#### Implementation Details

##### 2.5.1 Wrangler Configuration Parsing
- ✅ Parse `wrangler.jsonc` to detect Hono apps
- ✅ Extract `main` field (entry point, e.g., `index.js` → `worker/index.js`)
- ✅ Extract `assets.directory` (client location, e.g., `../client` → `dist/client`)
- ✅ Extract `assets.run_worker_first` (API routes, e.g., `["/api/*"]`)
- ✅ Extract `assets.not_found_handling` (SPA routing flag)

##### 2.5.2 Path Resolution
- ✅ Resolve relative paths correctly (`../client` from `worker/wrangler.jsonc` → `client/` or `dist/client/`)
- ✅ Handle wrangler.jsonc in root or worker/ directory
- ✅ Verify entry point exists before deployment

##### 2.5.3 Hono-Specific app.yaml Generation
- ✅ Generate handlers with correct order:
  1. Static assets (most specific)
  2. API routes (from `run_worker_first`)
  3. SPA routing or backend catch-all (least specific)
- ✅ Use resolved entry point in `entrypoint` field
- ✅ Use resolved client directory in static file handlers

##### 2.5.4 Deployment Configuration
- ✅ Update `.gcloudignore` to include:
  - Worker entry point (e.g., `worker/index.js`)
  - Client directory (e.g., `dist/client/`)
  - Package files (`package.json`, `package-lock.json`)
  - Exclude `wrangler.jsonc` (not needed for App Engine)

#### Key Features
- ✅ Automatic detection of Hono apps via wrangler.jsonc
- ✅ Dynamic app.yaml generation based on wrangler.jsonc configuration
- ✅ Proper handler ordering (static assets → API routes → catch-all)
- ✅ Backward compatible with Phase 2 (Express/Fastify) and Phase 1 (static frontend)
- ✅ Warning message about Hono Worker code compatibility with Node.js runtime

#### Important Notes
- **Code Compatibility**: Hono Worker code may need adaptation for Node.js runtime
  - Cloudflare Workers runtime differs from Node.js
  - May need Hono Node.js adapter or Express wrapper
  - User must ensure their Hono app works on Node.js
- **No Automatic Conversion**: This implementation does NOT convert Hono Worker code to Express
- **Path Resolution**: Critical to correctly resolve relative paths from wrangler.jsonc location

---

## ⏳ Phase 3: Database and Storage Integration (PLANNED)

### Objectives
- Integrate PostgreSQL database (Cloud SQL)
- Set up Cloud Storage for file uploads
- Migrate from D1/SQLite to PostgreSQL
- Handle database migrations

### Planned Implementation

#### 3.1 Database Setup
- [ ] Create Cloud SQL instance
- [ ] Set up database connection pooling
- [ ] Configure connection strings
- [ ] Handle database migrations

#### 3.2 Storage Setup
- [ ] Create Cloud Storage buckets
- [ ] Configure bucket permissions
- [ ] Set up file upload endpoints
- [ ] Handle file serving

#### 3.3 Code Generation Updates
- [ ] Update prompts to generate PostgreSQL queries
- [ ] Remove Cloudflare-specific database code
- [ ] Add database connection utilities
- [ ] Update ORM configuration (if using)

#### 3.4 Migration Tools
- [ ] Create migration scripts
- [ ] Handle schema changes
- [ ] Backup and restore utilities
- [ ] Data migration tools

### Requirements
- PostgreSQL-compatible queries
- Connection pooling for performance
- Secure credential management
- Migration support

---

## ⏳ Phase 4: Full-Stack Application Deployment (PLANNED)

### Objectives
- Deploy complete full-stack applications
- Support microservices architecture
- Handle multiple services
- Integrate all components

### Planned Implementation

#### 4.1 Multi-Service Deployment
- [ ] Deploy frontend service
- [ ] Deploy backend API service
- [ ] Deploy background workers (if needed)
- [ ] Configure service communication

#### 4.2 Service Discovery
- [ ] Set up service URLs
- [ ] Configure inter-service communication
- [ ] Handle service dependencies
- [ ] Set up load balancing

#### 4.3 Monitoring and Logging
- [ ] Integrate Cloud Logging
- [ ] Set up Cloud Monitoring
- [ ] Configure alerts
- [ ] Performance tracking

#### 4.4 CI/CD Integration
- [ ] Automated deployment pipelines
- [ ] Environment management
- [ ] Rollback capabilities
- [ ] Testing integration

---

## 🔄 Migration Path

### From Cloudflare to GCP

```
Current (Cloudflare):
├── Frontend: Workers for Platforms
├── Backend: Cloudflare Workers
├── Database: D1 (SQLite)
└── Storage: R2, KV

Target (GCP):
├── Frontend: App Engine (Static) ✅
├── Backend: App Engine (Flexible) ⏳
├── Database: Cloud SQL (PostgreSQL) ⏳
└── Storage: Cloud Storage, Firestore ⏳
```

### Migration Strategy
1. **Phase 1**: Deploy frontend only (✅ Complete)
2. **Phase 2**: Deploy backend API (⏳ Next)
3. **Phase 3**: Migrate database and storage (⏳ Future)
4. **Phase 4**: Full migration (⏳ Future)

---

## 📝 Phase Completion Criteria

### Phase 1 Criteria (✅ Met)
- [x] Frontend applications deploy successfully
- [x] Applications are accessible via App Engine URL
- [x] Client-side routing works correctly
- [x] Static assets load with proper caching
- [x] No breaking changes to Cloudflare deployment
- [x] Documentation complete

### Phase 2 Criteria (⏳ Pending)
- [ ] Backend APIs deploy successfully
- [ ] APIs are accessible and functional
- [ ] Frontend can communicate with backend
- [ ] Environment variables work correctly
- [ ] Health checks pass
- [ ] No breaking changes to existing functionality

### Phase 3 Criteria (⏳ Pending)
- [ ] Database connections work
- [ ] Migrations run successfully
- [ ] Storage operations work
- [ ] Data integrity maintained
- [ ] Performance meets requirements

### Phase 4 Criteria (⏳ Pending)
- [ ] Full-stack applications deploy
- [ ] All services communicate correctly
- [ ] Monitoring and logging work
- [ ] CI/CD pipelines functional
- [ ] Production-ready

---

## 🚀 Next Steps

1. **Review Phase 1**: Ensure all features work as expected
2. **Plan Phase 2**: Design backend deployment architecture
3. **Update Rules**: Add Phase 2 rules to `rules.md`
4. **Update Architecture**: Extend `architecture.md` with Phase 2 details
5. **Begin Implementation**: Start Phase 2 development

---

## 📚 Related Documentation

- [Architecture](./architecture.md) - Detailed architecture reference
- [Rules](./rules.md) - Decision rules and criteria
- [Environment Variables](./environment-variables.md) - Configuration guide

