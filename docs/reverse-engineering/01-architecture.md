# 01 – System Architecture (Cloudflare Deployment)

This section reverse-engineers the end-to-end topology of the Cloudflare-hosted agent runtime. It covers every major component, how they communicate, and the technologies involved.

## 1.1 High-Level Topology

```
┌──────────────┐      HTTPS (REST + WebSocket)      ┌────────────────┐
│   Browser    │ ─────────────────────────────────▶ │  Cloudflare    │
│  (Vite SPA)  │                                     │   Worker       │
└─────┬────────┘                                     │ (worker/index)│
      │                                              └──────┬─────────┘
      │                              Durable Object fetch() │
      │                                                     ▼
      │                                      ┌─────────────────────────┐
      │                                      │ CodeGeneratorAgent DO   │
      │                                      │ (SmartCodeGeneratorAgent│
      │                                      │ in simpleGeneratorAgent)│
      │                                      └──────────┬──────────────┘
      │                                                 │
      │                             ┌────────────────────┴────────────────────┐
      │                             │                                          │
      ▼                             ▼                                          ▼
NDJSON stream            Sandbox Service (Dispatch namespace)          Data Services
(TransformStream)        └─ Cloudflare Containers                      ├─ D1 (agentSessions,
WebSocket updates          build previews                                 agentPhases, logs…)
                           └─ R2 bucket for artifacts                   ├─ KV (VibecoderStore)
                                                                         └─ Durable-object storage
                                                                            (cf_agents_* tables)
```

## 1.2 Key Components

| Layer | Files | Description |
| ----- | ----- | ----------- |
| **HTTP entrypoint** | `worker/index.ts` | Registers routes via Hono-compatible adapters. Delegates `/api/agent` to `CodingAgentController`. |
| **Agent controller** | `worker/api/controllers/agent/controller.ts` | Validates requests, enforces rate limits, streams NDJSON, and creates/contacts the agent DO. |
| **Durable Object agent** | `worker/agents/core/simpleGeneratorAgent.ts` (class `SmartCodeGeneratorAgent`) | Executes blueprint ➝ phase ➝ review loop. Utilizes LLM prompts, file diff streaming, sandbox deployments. |
| **WebSocket bridge** | `worker/agents/core/websocket.ts` | Parses client messages (`generate_all`, `preview`, etc.) and invokes agent methods. Broadcasts responses via `WebSocketMessageResponses`. |
| **Sandbox service** | `worker/services/sandbox/*` + dispatch namespace binding | Provisioned container image that builds project artifacts and returns preview URLs. |
| **Data layer** | `worker/database/schema.sqlite.ts` + `schema.gcp.ts` + `AgentStateService` | Defines tables for sessions, phases, execution logs, websocket connections. Backed by D1 in Cloudflare mode. |
| **Template ingest** | `SandboxSdkClient` + R2 bucket | Lists templates, fetches file contents used during blueprinting and initial file generation. |

## 1.3 Network Bindings (wrangler.jsonc)

| Binding | Type | Purpose |
| ------- | ---- | ------- |
| `DB` | D1 database | Persistent agent/session data via Drizzle ORM. |
| `VibecoderStore` | KV namespace | Cache for template metadata, session hints, and feature flags. |
| `TEMPLATES_BUCKET` | R2 bucket | Stores template source and build artifacts. |
| `CodeGenObject` | Durable Object class (`CodeGeneratorAgent`) | Stateful agent instance keyed by `agentId`. |
| `Sandbox` | Durable Object / container binding | Orchestrates user app sandbox builds. |
| `AI` | Cloudflare AI binding | Routes LLM inference to configured provider (Gemini, OpenAI). |
| `DISPATCHER` | Dispatch namespace | Schedules sandbox container invocations. |

## 1.4 Request Lifecycle (Happy Path)

1. **User initiates generation**  
   - SPA sends `POST /api/agent` with `query`, `agentMode`, optional `images`.  
   - Worker authenticates session via cookies/JWT (`AuthService`).

2. **Controller bootstrap**  
   - Rate limits enforced via `RateLimitService`.  
   - `getTemplateForQuery()` fetches template list and calls LLM selector.  
   - `SandboxSdkClient` grabs full template contents.  
   - NDJSON stream opened via `TransformStream`.

3. **Durable Object creation**  
   - `getAgentStub()` resolves DO instance by `agentId`.  
   - `SmartCodeGeneratorAgent.initialize()` runs blueprint generation and persists state (`setState` → DO storage + D1).

4. **Streaming to client**  
   - Blueprint chunks forwarded through NDJSON stream (`writer.write({ chunk })`).  
   - Agent sends `generation_started`, `file_chunk_generated`, etc. over WebSocket.

5. **Phase loop**  
   - `generateAllFiles()` iterates states:
     - `PHASE_GENERATING` → `PhaseGenerationOperation`.  
     - `PHASE_IMPLEMENTING` → `PhaseImplementationOperation` (SCOF streaming).  
     - `REVIEWING` → `CodeReviewOperation`.  
     - `FINALIZING` → Deployment + README.  
   - Static analysis, retries, and user suggestions integrated at each stage.

6. **Preview deployment**  
   - `deployToSandbox()` packages files and calls sandbox container.  
   - Container writes build output to R2 and returns preview URL (signed).  
   - Agent broadcasts `deployment_completed` event with link.

7. **Completion**  
   - DO updates D1 (`AgentStateService.updateApp(...)`), marks status `completed`.  
   - Client sees generation timeline, preview link, and request history.

## 1.5 Auxiliary Services

| Service | Responsibility | Implementation |
| ------- | -------------- | --------------- |
| **Rate Limiting** | Per-user quotas on app creation and LLM usage. | DO (`DORateLimitStore`) + KV buckets (`AUTH_RATE_LIMITER`, `API_RATE_LIMITER`). |
| **Authentication** | Email/password + OAuth, JWT issuance. | `worker/api/controllers/auth/*`, `AuthService`. |
| **Telemetry** | Logging/analytics via Sentry & worker logs. | `worker/logger` + Observability settings in `wrangler.jsonc`. |
| **Secrets** | API keys, salts, encryption keys. | Stored via `wrangler secret put …`, accessed through `env`. |

## 1.6 Porting Considerations

To replicate in another cloud (e.g., GCP):
- Substitute Durable Object semantics with a stateful service that provides atomic storage + alarm scheduling (Cloud Tasks + Firestore/Postgres).  
- Replace D1/KV/R2 with Cloud SQL, Firestore, GCS.  
- Swap AI binding with direct Gemini API.  
- Rebuild sandbox pipeline using Cloud Run Jobs or Cloud Build triggers.  
The rest of this guide enumerates the logic necessary to reimplement those pieces faithfully.
