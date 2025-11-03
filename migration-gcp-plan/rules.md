# Migration Execution Rules

Use this rule file to coordinate the Google Cloud migration. An LLM or human operator should always read from here first, execute the next actionable spec, and update the status fields so progress is resumable across sessions.

## How to Run the Plan
- Always select the first step in the table marked `pending`. Only one step may be `in-progress` at a time.
- Before starting work on a step, change its status to `in-progress` and add your name/date in the `Owner` column.
- After completing a step, switch the status to `done`, log the completion date, and include a short summary in the `Notes` column (or link to a longer log).
- If work is blocked, set status to `blocked`, describe the blocker in `Notes`, and stop; do not advance to later steps.
- Keep detailed implementation notes inside each spec file (e.g., `migration-gcp-plan/02-runtime-platform.md`) to maintain context.

## Migration Progress Tracker

| Step | File | Summary | Status | Owner | Last Update | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `migration-gcp-plan/01-gcp-landing-zone.md` | Create project, IAM, networking, Terraform skeleton, Artifact Registry, and secret placeholders. | done | Codex/user | 2025-10-18 | Project `qfxcloud-app-builder` provisioned via Terraform; state in `gs://qfxcloud-tf-state/landing-zone`; VPC, service accounts, Artifact Registry, and placeholder secrets verified. |
| 2 | `migration-gcp-plan/02-runtime-platform.md` | Build Worker bundle, package with `workerd`, publish to Artifact Registry, and deploy Cloud Run control plane. | in-progress | Claude | 2025-01-27 | Rate limit configuration updated to disable apiRateLimit and authRateLimit only. Ready for Terraform deployment. |
| 3 | `migration-gcp-plan/03-data-layer.md` | Map D1/KV/R2 to Cloud SQL, Firestore/Memorystore, Cloud Storage, and update adapters. | pending | - | - | - |
| 4 | `migration-gcp-plan/04-durable-objects-and-sandbox.md` | Reproduce Durable Object state, rate limiting, and sandbox flows using Firestore, Redis, Cloud Run Jobs. | pending | - | - | - |
| 5 | `migration-gcp-plan/05-app-deployment-multicloud.md` | Implement multi-target deployment with Cloud Run default, maintain Cloudflare path, and configure DNS/TLS. | pending | - | - | - |
| 6 | `migration-gcp-plan/06-local-dev-and-testing.md` | Configure local dev/testing against GCP resources, add scripts, and validate end-to-end scenarios. | pending | - | - | - |
| 7 | `migration-gcp-plan/07-custom-agent-runtime.md` | Design and integrate a first-party agent runtime replacing Cloudflare Agents, leveraging GCP services after migration is complete. | pending | - | - | - |

## Strategy B: Pure Hono + PostgreSQL Implementation

**Strategy B** implements a complete agent intelligence system that eliminates Express entirely and runs the same Cloudflare-like flow but backed by Hono HTTP + WebSocket server and PostgreSQL for agent state management.

### 🚨 CRITICAL ISSUES - IMMEDIATE ATTENTION REQUIRED

**Current Status:** 81% Complete (13/16 components) - **BLOCKED BY 3 CRITICAL ISSUES**

**Blocking Issues (Must Fix First):**
1. **ESM Import Error** - `backend/gcp-agent-manager.js` TypeScript imports causing 'cloudflare:' protocol error
2. **Gemini AI Template Selection** - Not implemented, causing random template selection
3. **GCS Template Structure** - Templates missing application code files (only prompts exist)

**📋 Complete Status:** See `migration-gcp-plan/strategy-b-implementation-status.md` for detailed analysis

### Strategy B Progress Tracker

| Phase | Component | Summary | Status | Owner | Last Update | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Infrastructure Consolidation** | Eliminate Express server entirely, create agent schema, implement agent service | done | Claude | 2025-11-03 | Hono server running, PostgreSQL agent state management complete |
| 1.1 | Express Elimination | Remove Express server, migrate all routes to Hono, update package.json & startup | done | Claude | 2025-01-31 | Express dependency removed from backend/package.json, server renamed to express-server-legacy.js, scripts already pointed to hono-server.js |
| 1.2 | Agent Schema Integration | Add agent tables to schema.gcp.ts and update exports | done | Claude | 2025-01-31 | Agent sessions, phases, assets, logs, and WebSocket tables added to PostgreSQL schema |
| 1.3 | WebSocket Agent States | Fix import timing issues for WebSocket connections | done | Claude | 2025-11-03 | Lazy import pattern implemented to resolve singleton initialization timing |
| 2 | **Core Agent Intelligence** | Blueprint generation, phase execution engine, Gemini AI integration | blocked | - | - | **BLOCKED: Gemini AI template selection not implemented** |
| 2.1 | Blueprint Generator | Create agent intelligence for template selection and execution planning | blocked | - | - | **BLOCKED: Template selection falls back to random selection** |
| 2.2 | Phase Executor | Implement phase-based code generation engine | pending | - | - | Support blueprint → code generation → review cycles |
| 2.3 | Gemini AI Service | Direct GCP AI integration (no Cloudflare dependency) | done | Claude | 2025-01-31 | backend/gemini-ai-service.js implemented with Pro/Flash models, structured prompts, and direct GCP integration |
| 2.4 | ESM Import Fix | Replace TypeScript imports with compiled JavaScript in agent manager | blocked | - | - | **CRITICAL: 'cloudflare:' protocol error preventing agent execution** |
| 3 | **Enhanced Features** | Real-time WebSocket updates, review cycles, Cloud Run deployment | pending | - | - | Business logic enhancements |
| 3.1 | WebSocket Real-time | Extend hono-server.js with enhanced agent progress streaming | done | Claude | 2025-11-03 | WebSocket server ready, agent state management integrated |
| 3.2 | Review Engine | Automated code quality analysis and auto-fixes | pending | - | - | worker/agents/review-engine.ts |
| 3.3 | Cloud Run Deploy | Integrate sandbox deployment to GCP Cloud Run | pending | - | - | backend/cloud-run-deployer.js |
| 4 | **Quality Assurance** | Error handling, logging, performance, and testing | pending | - | - | End-to-end validation phase |
| 5 | **GCS Template Population** | Upload complete template directories with application code to vibesdk-templates bucket | blocked | - | - | **EXTERNAL: GCS bucket only contains prompt files, missing src/, package.json, etc.** |

### Strategy B Technical Foundation (Completed)

**✅ Database Infrastructure:**
- PostgreSQL schema with agent tables: sessions, phases, assets, logs, WebSocket connections
- AgentStateService with full CRUD operations, statistics, and cleanup functions
- Template asset caching with content hash validation and LRU cleanup

**✅ Architecture Benefits:**
- Single server technology (Hono) vs Express/Hono mix
- PostgreSQL-backed durable agent state (vs in-memory)
- Direct GCP services integration (Gemini AI, Cloud Storage, Cloud Run)
- Real-time WebSocket communication for live updates
- Phase-based execution engine foundation

### Current Working State
- **Agent Database Schema**: Complete PostgreSQL foundation for agent intelligence system
- **Agent State Service**: Full service layer for session/phase management
- **Migration Plan**: Comprehensive 4-phase roadmap documented
- **Next Step**: Eliminate Express server and consolidate to pure Hono

## Reference Summary
- The migration playbook preserves the existing architecture while introducing GCP parity. See `migration-gcp-plan/README.md` for guardrails and branch strategy.
- Each numbered spec (`01`–`06`) contains prerequisites, implementation steps, verification, and follow-up notes designed for cursor-based development.

## Next Actions
1. Work through `migration-gcp-plan/01-gcp-landing-zone.md` to bootstrap the Google Cloud foundation.
2. Build and deploy the Cloud Run runtime described in `migration-gcp-plan/02-runtime-platform.md` before tackling data, Durable Object, and deployment adapters.
3. After steps 1-6 are complete, plan and deliver `migration-gcp-plan/07-custom-agent-runtime.md` to transition from Cloudflare Agents to an in-house agent stack on GCP.

Update this rule file whenever progress changes so future runs know exactly where to resume.
