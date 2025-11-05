# 11 – DevOps, Tooling, and Infrastructure

This document captures the build system, automation, and infrastructure tooling that surrounds the VibeSDK application.

## 11.1 Build & Packaging

| Component | Tooling | Notes |
| --------- | ------- | ----- |
| Frontend | Vite (`vite.config.ts`) | Build output in `dist/client`. Tailwind compiled via `@tailwindcss/vite`. |
| Worker bundle | `npm run build:worker` | Runs `tsc -b --incremental` + bundler (esbuild/rolldown) to produce `dist/worker-bundle/index.js`. |
| Node backend (GCP dev) | `container/Dockerfile.workerd` | Multi-stage Node 20 build: install workspaces, build front+back, run via `tsx backend/hono-server.js`. |
| Sandbox container | `SandboxDockerfile` | Builds Cloudflare container image (install dependencies, run user app). |

## 11.2 Scripts (`package.json`)

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Starts Vite dev server (frontend only). |
| `npm run api:dev` | Boots Node backend (`tsx backend/hono-server.js`). |
| `npm run dev:full` | Runs frontend + backend concurrently via `concurrently`. |
| `npm run build` | Type-check + build frontend bundle. |
| `npm run build:worker` | Generates Cloudflare worker bundle. |
| `npm run test` | Vitest unit tests. |
| `npm run test-gcp-ready` | Integration tests targeting GCP adapters. |
| `npm run deploy` | Deployment script (cloudflare). |

## 11.3 CI/CD

- GitHub Actions workflow (not shown here) typically runs:
  - Install dependencies (`npm ci`).  
  - `npm run lint`, `npm run test`.  
  - `npm run build` and `npm run build:worker`.  
  - `wrangler publish` on main branch tags.  
- Optional pipeline builds sandbox container and pushes to Cloudflare registry.

## 11.4 Infrastructure as Code

### 11.4.1 Cloudflare

- Worker deployment fully described by `wrangler.jsonc`.  
- Durable Object migrations defined under `"migrations"`.  
- Container binding for sandbox (`"containers"` array).  
- Routes and custom domains declared inline.  
- Rate limit bindings under `"unsafe.bindings"` (ratelimit type).

### 11.4.2 GCP (Migration Path)

- Terraform under `infra/gcp` sets up:
  - VPC, Cloud SQL, Artifact Registry, Secret Manager.  
  - Cloud Run service for combined frontend/backend container.  
  - Pub/Sub topics for sandbox job orchestration.  
  - Service accounts and IAM bindings.  
- Variables: `runtime_image`, `sandbox_job_image`, secret bindings (Gemini API key, JWT secret).

## 11.5 Docker & Containerization

| Image | Location | Purpose |
| ----- | -------- | ------- |
| `container/Dockerfile.workerd` | Combined SPA + Hono backend (Node 20). Used for Cloud Run. |
| `SandboxDockerfile` | Base image for Cloudflare sandbox container (includes Node, pnpm, playwright for tests). |
| `dist/worker-bundle/index.js` | Workerd runtime executed by Cloudflare (no Docker). |

## 11.6 Local Development

| Tool | Usage |
| ---- | ----- |
| `.env` | Environment configuration (Postgres URL, GCS bucket, Gemini key). |
| `backend/setup-env.js` | Loads `.env`, establishes global `env` object mimicking Cloudflare bindings. |
| `npm run dev:full` | Most common workflow; hot reload via Vite and nodemon (optional). |
| VSCode tasks | Launch configurations for frontend/back. |
| Postman collection | `docs/v1dev-api-collection.postman_collection.json` for manual API testing. |

## 11.7 Testing & QA

| Test Type | Location | Coverage |
| --------- | -------- | -------- |
| Unit tests | `tests/**/*.test.ts` (Vitest) | Services (Auth, App, Agent state), utility functions. |
| Integration | `tests/platform/*.test.ts` | Database client adapters (D1/Postgres), sandbox client. |
| E2E | (Optional) Playwright scripts in `tests/e2e` | Login, create agent, preview. |
| Lint | ESLint config `.eslintrc.cjs`; run via `npm run lint`. |

## 11.8 Monitoring & Alerting

| Feature | Implementation |
| ------- | -------------- |
| Logs | `wrangler tail` (Cloudflare), `gcloud run services logs read` (GCP). |
| Metrics | Optional `analyticsEvents` table + Grafana (self-hosted). |
| Notifications | Slack/webhook integration via `NotificationService`. |

## 11.9 Deployment Checklist

1. `npm ci && npm run lint && npm run test`.  
2. `npm run build` and `npm run build:worker`.  
3. `wrangler d1 migrations apply vibesdk-db --remote`.  
4. `wrangler publish` (Cloudflare) **or** build/push container (`docker build -f container/Dockerfile.workerd ...`) and update Terraform `runtime_image`.  
5. Verify endpoints, NDJSON stream, WebSocket, preview.  
6. Update Terraform `runtime_image` & apply for GCP runtime.

---

This operational reference ties together the build process, deployment automation, and infrastructure configuration required to keep the VibeSDK application running in production or rebuild it from scratch.
