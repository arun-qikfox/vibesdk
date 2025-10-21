# 04 - Durable Objects and Sandbox Execution

Goal: Recreate the behaviour currently provided by Cloudflare Durable Objects (agent state, rate limiting, sandbox) using Google Cloud primitives without changing the higher-level orchestration logic.

## Current Usage Summary
- `worker/index.ts` exports `CodeGeneratorAgent` and `DORateLimitStore`.
- `worker/agents/core/smartGeneratorAgent.ts` depends on Durable Object state for conversation snapshots and job coordination.
- `worker/services/rate-limit/DORateLimitStore.ts` implements token bucket logic with persistent storage.
- `worker/services/sandbox/sandboxSdkClient.ts` orchestrates preview builds using Durable Objects + Cloudflare Containers.

## Outcomes
- Agent state stored in Firestore or Cloud SQL with optimistic locking.
- Rate-limiting service backed by Memorystore (Redis) or Cloud SQL counters.
- Sandbox execution rehosted on Cloud Run Jobs with Pub/Sub triggers.
- Abstraction layer allowing Cloudflare Durable Objects to remain operational when running on Cloudflare.

## Implementation Steps

### Step 1: Analyse Durable Object Interfaces
- [x] Map methods invoked on `CodeGeneratorAgent` (search in `worker/agents` for `.getStub` usage).
- [x] List data persisted via `ctx.storage` (inspect `SmartCodeGeneratorAgent` implementation).
- [x] Document expected concurrency semantics (single writer per session).

**Findings (2025-10-21)**
- API surface: stubs created via `getAgentStub` call `initialize`, `isInitialized`, `getFullState`, `setState`, `deployToSandbox`, and `fetch` (for WebSocket upgrades). Cloning flows reuse `setState` to seed new sessions. Rate-limit consumers call `increment`, `getRemainingLimit`, and `resetLimit` on `DORateLimitStore`.
- Persisted state: the `Agent` base class writes JSON payloads to `cf_agents_state` rows (`cf_state_row_id`, `cf_state_was_changed`) plus queue (`cf_agents_queues`), schedule (`cf_agents_schedules`), and MCP connection (`cf_agents_mcp_servers`) tables via `ctx.storage.sql`. `DORateLimitStore` stores a serialised map of buckets under the `state` key in Durable Object storage.
- Concurrency: Durable Objects rely on single-threaded execution with `blockConcurrencyWhile` guarding startup and SQL mutations. State transitions go through `_setStateInternal`, ensuring sequential updates and broadcast ordering. Migration targets must preserve "single writer per session" semantics; Firestore transactions with retry jitter will be used to emulate this behaviour.

### Step 2: Create Adapter Pattern
- [x] Define `shared/platform/durableObjects/agentStore.ts` with interface:
  ```ts
  export interface AgentStore {
    fetch(request: Request): Promise<Response>;
    getSessionState(sessionId: string): Promise<AgentState>;
    putSessionState(sessionId: string, state: AgentState): Promise<void>;
  }
  ```
- [x] Implement two adapters:
  - `cloudflareAgentStore` wrapping the existing Durable Object.
  - `gcpAgentStore` using Firestore (documents keyed by session ID) with transactions for atomic updates.
- [x] Update `worker/index.ts:19-83` to instantiate the correct adapter based on environment flag (e.g., `env.RUNTIME_PROVIDER`).

### Step 3: Firestore Backing for Agent Sessions
- [ ] Create Firestore collection `agentSessions` with TTL index for cleaning stale sessions.
- [ ] Use Firestore transactions to mimic single-threaded DO execution (transactions fail on concurrent writes; retry with jitter).
- [ ] Serialize the same payload structure currently stored via `ctx.storage.put`.
- [ ] Ensure WebSocket upgrades still route through the adapter (if applicable).

### Step 4: Rate Limiting
- [ ] Replace `DORateLimitStore` when running on GCP:
  - Use Memorystore (Redis) with Lua scripts or `INCR`/`EXPIRE` to maintain counters.
  - Alternatively, use Cloud SQL table with `SELECT FOR UPDATE` for strict consistency.
- [ ] Wrap logic with interface `RateLimitBackend` and update `worker/services/rate-limit/rateLimits.ts` to select backend.
- [ ] Preserve bucket structure defined in `RateLimitConfig`.

### Step 5: Sandbox Execution
- [ ] Provision Cloud Run Job `vibesdk-sandbox-job` that spins up the sandbox container defined in `SandboxDockerfile`.
- [ ] Store job definitions in Terraform (module `infra/gcp/modules/sandbox`).
- [ ] Replace `@cloudflare/sandbox` usage:
  - Introduce `shared/platform/sandbox/index.ts` exposing `runPreview`, `getLogs`, `cleanup`.
  - Implement Cloud Run version using Pub/Sub queue (`sandbox-requests`) that triggers the job via Cloud Run Jobs API.
- [ ] Update `worker/services/sandbox/sandboxSdkClient.ts` to call the new abstraction.
- [ ] Manage preview URLs by mapping Cloud Run services to subdomains (`*.preview.vibesdk.example.com`).

### Step 6: Deployment Dispatcher
- [ ] For requests that used `env.DISPATCHER` (Cloudflare Workers for Platforms), create a routing service:
  - Maintain table `app_deployments` in Cloud SQL with fields `appName`, `target`, `endpoint`.
  - For Cloud Run deployments, proxy requests to the stored endpoint.
  - For Cloudflare deployments, continue using existing dispatcher when running on Cloudflare.
- [ ] Adjust `handleUserAppRequest` in `worker/index.ts:28-87` to call the router abstraction.

### Step 7: Background Tasks and Cleanup
- [ ] Replace DO `alarm` style scheduled cleanups with Cloud Scheduler triggering Pub/Sub.
- [ ] Implement cleanup handlers for stale sandbox jobs and rate-limit buckets.
- [ ] Document schedules in Terraform.

## Verification
- [ ] Integration test: generate an app end-to-end on the GCP runtime and confirm state persists between phases.
- [ ] Rate limit validation: simulate burst traffic and confirm Redis counters enforce the limit.
- [ ] Sandbox preview: ensure preview URL serves content via Cloud Run and auto-deletes.
- [ ] Failover: confirm that toggling `RUNTIME_PROVIDER=cloudflare` keeps existing behaviour intact.

## Notes
- Keep the adapters minimal; business logic should remain in existing services like `SmartCodeGeneratorAgent`.
- If Firestore transaction latency becomes an issue, consider Cloud Spanner or AlloyDB in future iterations but avoid over-optimising now.
