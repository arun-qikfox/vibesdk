# 02 – Code Structure & Logical AST

This section decomposes the agent runtime into a declarative, AST-style outline. Each table lists the primary modules, exported symbols, and their responsibilities. Use this as a scaffold for regeneration.

## 2.1 Worker Entry & Routing

| File | Exports | Notes |
| ---- | ------- | ----- |
| `worker/index.ts` | `default` (Worker fetch handler) | Registers Hono routes, authentication middleware, and WebSocket upgrade logic. |
| `worker/hono-middleware-adapters.ts` | `initializeMiddlewareAdapters`, `adaptController`, `authenticate`, `setAuthLevel`, `enforceAuthRequirement` | Converts Worker middleware to Hono-compatible handlers. |
| `worker/setup-hono-routes.ts` | `setupHonoCompatibleRoutes` | Maps Worker API endpoints (auth, agent, apps) to Hono router. |

## 2.2 Agent HTTP Controller

| File | Class / Functions | Purpose |
| ---- | ----------------- | ------- |
| `worker/api/controllers/agent/controller.ts` | `CodingAgentController` (static methods) | Handles `/api/agent`, `/api/agent/:id/connect`, `/api/agent/:id/preview`, WebSocket upgrades. Maintains NDJSON stream. |
| Key methods | `startCodeGeneration`, `handleWebSocketConnection`, `connectToExistingAgent`, `deployPreview` | Sequence: validate request → rate limit → select template → open stream → acquire DO stub → writer callbacks → return streaming Response. |
| Helpers | `getTemplateForQuery`, `getAgentStub`, `getAgentState`, `cloneAgent` (imported from `worker/agents/index.ts`) | Acquire templates, connect to existing DO, clone states. |

## 2.3 Durable Object Agent

| Module | Core Types | Summary |
| ------- | ---------- | ------- |
| `worker/agents/core/simpleGeneratorAgent.ts` | `SmartCodeGeneratorAgent extends Agent` | Main DO class. Fields include `state`, `agentStateService`, `fileManager`, `codingAgent`, `previewUrlCache`. |
| Methods (high-level) | `initialize`, `generateAllFiles`, `executePhaseGeneration`, `executePhaseImplementation`, `executeReviewCycle`, `executeFinalizing`, `deployToSandbox`, `reviewCode`, `captureScreenshot`, `broadcast` | Implements blueprint creation, phase planning, SCOF streaming, static analysis, preview deployment, final status updates. |
| State enums | `CurrentDevState`, `PhaseConceptType`, `CodeGenState` (from `core/state.ts`, `core/types.ts`) | Drive the state machine loop and persisted session data. |

### Simplified AST Outline (SmartCodeGeneratorAgent)

```
class SmartCodeGeneratorAgent extends Agent {
  constructor(ctx, env)
  async initialize(initArgs, mode)
    -> load existing session via AgentStateService
    -> generateBlueprint(...)
    -> setState(newState)
    -> Promise.all([deployToSandbox, generateSetupCommands, generateReadme])
  async generateAllFiles(reviewCycles = 5)
    state machine loop while currentDevState !== IDLE
      case PHASE_GENERATING   -> executePhaseGeneration()
      case PHASE_IMPLEMENTING -> executePhaseImplementation()
      case REVIEWING          -> executeReviewCycle()
      case FINALIZING         -> executeFinalizing()
    update app status in D1 via AgentStateService
  async executePhaseGeneration()
    -> PhaseGenerationOperation.run(...)
  async executePhaseImplementation(...)
    -> PhaseImplementationOperation.run(...)
  async executeReviewCycle()
    -> CodeReviewOperation.run(...)
  async executeFinalizing()
    -> FileRegenerationOperation / deployment / README
  async deployToSandbox()
    -> sandboxService.deploy(...)
  async reviewCode()
    -> CodeReviewOperation / broadcast
  ...
}
```

## 2.4 Operations & Services

| Category | Files | Description |
| -------- | ----- | ----------- |
| **Operations** | `worker/agents/operations/*.ts` | Reusable units invoked by the agent state machine. Notable files: `PhaseGeneration.ts`, `PhaseImplementation.ts`, `CodeReview.ts`, `FastCodeFixer.ts`, `PhaseFinalization.ts`. |
| **Prompts & inference** | `worker/agents/inferutils/*.ts` | `infer.ts`, `core.ts`, `common.ts` encapsulate model calls; `planning/templateSelector.ts` selects templates; `planning/blueprint.ts` builds PRDs. |
| **Services** | `worker/services/sandbox/*`, `worker/services/code-fixer`, `worker/services/rate-limit`, `worker/services/deployer` | Sandbox container client, static analysis, rate limiting, deployment utilities. |
| **State/persistence** | `worker/database/services/AgentStateService.ts`, `worker/database/schema.sqlite.ts` | CRUD for sessions, phases, webhooks, logs. |

## 2.5 Streaming & WebSocket

| Module | Functions | Responsibility |
| ------- | --------- | -------------- |
| `worker/agents/core/websocket.ts` | `handleWebSocketMessage`, `handleWebSocketClose`, `broadcastToConnections`, `sendToConnection`, `sendError` | Parses client messages (`generate_all`, `user_suggestion`, `preview`, `code_review`). Routes to agent methods, broadcasts results. |
| `worker/api/websocketTypes.ts` | Type definitions | Defines message shapes (`WebSocketMessageType`, `WebSocketMessageData`). |
| `worker/agents/constants.ts` | `WebSocketMessageRequests`, `WebSocketMessageResponses` | Enumerations consumed by both client and server. |

## 2.6 Sandbox Pipeline

| File | Exports | Role |
| ---- | ------- | ---- |
| `worker/services/sandbox/factory.ts` | `getSandboxService` | Returns service implementation (remote vs local). |
| `worker/services/sandbox/remoteSandboxService.ts` | `RemoteSandboxService` | Invokes Cloudflare Containers, writes artifacts to R2. |
| `worker/services/sandbox/BaseSandboxService.ts` | Abstract base | Defines interface for deploying, writing files, managing instances. |
| `worker/services/sandbox/resourceProvisioner.ts` | `ResourceProvisioner` | Creates/cleans sandbox instances, handles TTLs, interacts with KV. |

## 2.7 Data Layer

| Component | Files | Highlights |
| --------- | ----- | ---------- |
| **Schemas** | `worker/database/schema.sqlite.ts`, `schema.gcp.ts` | Table definitions for `agentSessions`, `agentPhases`, `templateAssets`, `agentExecutionLogs`, `websocketConnections`, etc. |
| **Factories** | `worker/database/runtime/factory.ts` | Chooses D1 vs Postgres client based on `RUNTIME_PROVIDER`. |
| **Clients** | `worker/database/clients/d1Client.ts`, `postgresClient.ts` | Provide `prepare`, `bind`, `run`, `all`, `first` wrappers. |
| **Services** | `AgentStateService`, `AppService`, `SessionService` | CRUD for agent artifacts, user apps, sessions. |

## 2.8 Authentication & Security

| File | Responsibility |
| ---- | -------------- |
| `worker/api/controllers/auth/controller.ts` | REST endpoints for register/login/logout. |
| `worker/database/services/AuthService.ts` | Credential storage, session issuance, JWT utilities. |
| `worker/middleware/auth/auth.ts` | Middleware for validating JWT cookies. |
| `worker/services/rate-limit/DORateLimitStore.ts` | DO-based rate limiting storage. |

## 2.9 Client-Side Integration (Reference)

Although not the primary focus, the SPA expects the following:

| File | Purpose |
| ---- | ------- |
| `src/routes/chat/use-chat.ts` | Manages WebSocket lifecycle, NDJSON parsing, timeline state. |
| `src/routes/chat/components/phase-timeline.tsx` | Displays generation phases. |
| `src/routes/chat/components/deployment-controls.tsx` | Handles preview/deploy interactions. |

---

Use this structural map alongside the detailed behavior in sections 03–07 to reconstruct the entire agent runtime. Each file listed here should be examined for exact logic when porting to a new environment.
