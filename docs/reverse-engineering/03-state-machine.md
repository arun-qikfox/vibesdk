# 03 – Agent State Machine & Execution Flow

This document reverse-engineers the runtime behavior of `SmartCodeGeneratorAgent` (Cloudflare Durable Object). Treat it as the canonical specification for the agent loop.

## 3.1 Lifecycle Overview

```
initialize()
  ├─ load existing session (AgentStateService.getSession)
  ├─ if none → generateBlueprint()
  │     ├─ LLM call (planning/blueprint.ts)
  │     ├─ stream chunks via onBlueprintChunk()
  │     └─ setState(newState)
  ├─ Promise.all([
  │     deployToSandbox(),             // scaffolds preview environment
  │     projectSetupAssistant.generateSetupCommands(),
  │     generateReadme()
  │   ])
  └─ return CodeGenState

generateAllFiles(reviewCycles = 5)
  ├─ broadcast GENERATION_STARTED
  ├─ while currentDevState !== IDLE
  │     ├─ PHASE_GENERATING   → executePhaseGeneration()
  │     ├─ PHASE_IMPLEMENTING → executePhaseImplementation()
  │     ├─ REVIEWING          → executeReviewCycle()
  │     └─ FINALIZING         → executeFinalizing()
  ├─ persist final status (AgentStateService.updateApp)
  └─ broadcast GENERATION_COMPLETE
```

## 3.2 State Enumerations

| Enum | Description |
| ---- | ----------- |
| `CurrentDevState` | `PHASE_GENERATING`, `PHASE_IMPLEMENTING`, `REVIEWING`, `FINALIZING`, `IDLE`. |
| `PhaseConceptType` | Structured representation of upcoming feature (phase name, deliverables, scope). |
| `CodeGenState` | Master state object persisted across runs: blueprint, phases, commands, logs, preview info. |

Durable Object storage (`this.ctx.storage.sql`) mirrors four logical tables (`cf_agents_state`, `cf_agents_queues`, `cf_agents_schedules`, `cf_agents_mcp_servers`) that provide idempotent recovery, queueing, and cron-like scheduling.

## 3.3 Detailed Step-by-Step Flow

### 3.3.1 Initialization

1. **Load persisted session** – `AgentStateService.getSession(agentId)`.  
   - If session exists, load `state` JSON into memory, resume later phases.
2. **Blueprint generation** – `generateBlueprint()` in `planning/blueprint.ts`:
   - System prompt defines product design expectations.  
   - User prompt includes query, template description, images.  
   - `executeInference()` calls Gemini (or configured model).  
   - `onBlueprintChunk` streams output to client.
3. **State persistence** – `setState(newState)` writes to:
   - `this.ctx.storage.sql` (CF durable object).  
   - `AgentStateService.saveAgentSession` (D1) for cross-DO recovery.
4. **Post-blueprint tasks** (async):
   - `deployToSandbox()` – initial preview deployment.  
   - `ProjectSetupAssistant.generateSetupCommands()` – npm scripts.  
   - `generateReadme()` – README scaffold.

### 3.3.2 Phase Loop

| State | Method | Inputs | Outputs |
| ----- | ------ | ------ | ------- |
| `PHASE_GENERATING` | `executePhaseGeneration()` | Current blueprint, issues, user context | Next `PhaseConceptType`, static analysis snapshot. |
| `PHASE_IMPLEMENTING` | `executePhaseImplementation(phaseConcept, staticAnalysisCache, userContext)` | Phase plan, analysis data | SCOF file stream, deployment flag, command list. |
| `REVIEWING` | `executeReviewCycle()` | Latest code snapshot | Code review report, optional fix operations. |
| `FINALIZING` | `executeFinalizing()` | Completed phases | README, final deployment, status update. |

#### SCOF Streaming (Phase Implementation)

1. `PhaseImplementationOperation` generates structured code output (SCOF format).  
2. Parser emits events:
   - `FILE_GENERATING` → file path + purpose.  
   - `FILE_CHUNK_GENERATED` → chunk + diff/full body.  
   - `FILE_GENERATED` → final confirmation.  
3. File manager writes to in-memory FS & sandbox overlay.  
4. Optionally triggers `RealtimeCodeFixer` for immediate fixes.

#### Code Review Cycle

1. `CodeReviewOperation` runs static analysis prompt (LLM).  
2. If issues remain and auto-fix is enabled, schedule `FileRegenerationOperation`.  
3. Loop continues until no blocking issues or review retry limit reached (`reviewCycles` parameter).

### 3.3.3 Deployment & Preview

1. **Preview deployment** – `deployToSandbox()` sends zipped file set to `SandboxSdkClient`.  
2. **Sandbox build** – remote service runs install/build commands, writes output to R2.  
3. **Preview URL** – signed link broadcast via `DEPLOYMENT_COMPLETED` WebSocket message.  
4. **Final deployment** – `deployToCloudflare()` (for production) triggers Workers publish pipeline (optional).

## 3.4 Message & Event Timeline

Order of events during typical generation:

1. NDJSON `{ message: "Code generation started", ... }`  
2. WebSocket `generation_started` (total files estimate).  
3. Streaming blueprint chunks via NDJSON `{ chunk: "..." }`.  
4. WebSocket file events (`file_generating`, `file_chunk_generated`, `file_generated`).  
5. WebSocket `deployment_started` / `deployment_completed` (preview).  
6. WebSocket `generation_complete` and NDJSON `{ type: "complete", ... }`.  
7. Optional `code_reviewed`, `runtime_error_found`, `conversation_state` depending on user actions.

## 3.5 Error Handling & Recovery

| Scenario | Handling |
| -------- | -------- |
| LLM failure during blueprint | Catch → store fallback blueprint (basic template description). |
| Phase error | Broadcast `ERROR` over WebSocket, log to `agentExecutionLogs`, continue loop if recoverable. |
| Rate limit | Throw `RateLimitExceededError`, respond with HTTP 429 in controller. |
| DO crash/restart | State restored from `cf_agents_state` + D1 session record; `initialize()` checks persisted state before regenerating. |

## 3.6 Scheduling & Alarms

The agent uses `this.ctx.storage` tables to:
- Queue async work (`cf_agents_queues`).  
- Schedule delayed/cron tasks (`cf_agents_schedules`).  
- Manage MCP server metadata (`cf_agents_mcp_servers`).  

On Cloudflare, DO alarms wake the agent to resume tasks; on other platforms, replicate via scheduled jobs (Pub/Sub/Cloud Tasks).

---

Re-creating this state machine faithfully is critical. All higher-level behavior (UI timeline, previews, code diffs) depends on the transitions and broadcasts described above.
