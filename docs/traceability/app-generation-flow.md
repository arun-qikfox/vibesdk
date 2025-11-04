# App Generation Flow (Cloudflare Runtime Traceability)

This note walks through the exact Cloudflare Worker implementation path when a signed‑in user asks, for example, _“create a reminder app that has registration and login and keeps track of reminders”_. It mirrors the production Worker deployed with `wrangler.jsonc` and the Durable Object agent (`CodeGeneratorAgent`).

## 1. Request Intake & Stream Setup
- **Frontend call** – The React client issues `POST /api/agent` with `{ query, agentMode, images? }`.
- **Worker handler** – `worker/api/controllers/agent/controller.ts:startCodeGeneration` receives the request, validates JSON, and keeps the `RouteContext.user` (mock user in dev).
- **Rate limiting** – `RateLimitService.enforceAppCreationRateLimit()` consults the `AUTH_RATE_LIMITER`/`API_RATE_LIMITER` durable object buckets declared in `wrangler.jsonc` → abuse protection before any agent state is touched.
- **Streaming shell** – A `TransformStream` and writer are created so each downstream action can push NDJSON chunks (`{ type, ... }`) to the client while work continues.

## 2. Resource Discovery
1. **Template listing** – `SandboxSdkClient.listTemplates()` talks to the Cloudflare Containers namespace (`UserAppSandboxService`), which in turn reads the template manifest stored in the R2 bucket bound as `TEMPLATES_BUCKET`.
2. **AI template selection** – `worker/agents/index.ts:getTemplateForQuery` calls `planning/templateSelector.ts`. Gemini is prompted with the user request + template catalog; result is a structured `TemplateSelection`.
3. **Template materialization** – `sandboxClient.getTemplateDetails()` streams every file for the selected template into Worker memory (the file contents never leave Cloudflare’s private network).

## 3. Durable Object Agent Boot
1. **Agent ID** – `generateId()` creates a UUID used for both DO routing and downstream PostgreSQL/D1 records.
2. **Durable Object stub** – `getAgentStub()` resolves `env.CodeGenObject` to a `SmartCodeGeneratorAgent` Durable Object. Under the hood the Workers platform steels the request to the DO shard selected by `agentId` as partition key.
3. **Transform callbacks** – Before hitting the DO, `startCodeGeneration` registers `onBlueprintChunk` to push blueprint fragments back through the open stream.

## 4. Blueprint Generation (Inside DO)
1. **Initialization** – `SmartCodeGeneratorAgent.initialize()` (implemented in `worker/agents/core/simpleGeneratorAgent.ts`) is invoked with the query, template, inference context, and blueprint stream callback.
2. **Gemini blueprint prompt** – `planning/blueprint.ts` assembles a 1500+ line system prompt describing Cloudflare visual standards, then calls `executeInference()` which routes to Gemini via the AI binding (`env.AI.gateway`). Tooling chooses model defaults from `AGENT_CONFIG.templateSelection`.
3. **State persistence** – When `setState()` runs, the DO stores a copy in:
   - Its local SQLite storage (`this.ctx.storage.sql`) for fast recovery.
   - The shared D1 database via `AgentStateService.saveAgentSession()` (uses Drizzle with prepared statements, so parameters are always bound securely).

## 5. Phase Execution Loop
Once the blueprint exists, the DO transitions to its state machine:

| Loop state | Implementation | Key actions |
| ---------- | -------------- | ----------- |
| `PHASE_GENERATING` | `PhaseGenerationOperation` | Gemini plans the next milestone using STRATEGIES prompt pack + current repo snapshot. |
| `PHASE_IMPLEMENTING` | `PhaseImplementationOperation` | SCOF streaming format emits file create/update chunks; each chunk triggers `fileChunkGeneratedCallback → writer.write({ type: FILE_CHUNK_GENERATED … })`. |
| `REVIEWING` | `CodeReviewOperation` | Gemini inspects generated code, emits issue list, optionally schedules fast fixes. |
| `FINALIZING` | `executeFinalizing()` | Deploy instructions, README, final status. |

The `while (currentDevState !== IDLE)` loop in `simpleGeneratorAgent.ts` controls the sequence and only exits after `WebSocketMessageResponses.GENERATION_COMPLETE` is broadcast.

## 6. Real‑time Streaming & WebSockets
1. **NDJSON stream** – Every blueprint chunk, file event, and completion message is serialized to NDJSON via the stream writer opened in step 1. The client consumes these updates before the HTTP response closes.
2. **WebSocket handshake** – Separately, `GET /api/agent/:agentId/ws` is handled by `CodingAgentController.handleWebSocketConnection()`. It validates the session cookie/JWT, calls `getAgentStub()`, then delegates to `smartGeneratorAgent.handleWebSocket()` for live editor updates.
3. **WebSocket messaging** – The DO pushes real-time events (file diffs, review messages, deployment status) so the IDE view stays synchronized.

## 7. Preview Deployment Path
1. **Sandbox provisioning** – `SmartCodeGeneratorAgent.deployToSandbox()` calls `SandboxSdkClient.createDeployment()` with the generated artifact bundle.
2. **Build pipeline** – The Cloudflare Container image builds the project, writes static assets & server bundle to R2, and exposes a preview via managed `build-preview.cloudflare.dev`.
3. **Secure URLs** – The preview URL is signed and only injected into the NDJSON/WebSocket feed for the authenticated user that owns `agentId`.

## 8. Storage & Security Summary
| Storage | Binding | Usage | Security Highlights |
| ------- | ------- | ----- | ------------------- |
| Durable Object storage | `CodeGenObject` DO | Hot agent state + lockless coordination | Isolated per agent ID; only Worker code can mutate it. |
| D1 database | `DB` | Long-lived agent sessions, phases, logs (`worker/database/schema.sqlite.ts`) | All writes go through Drizzle prepared statements. No direct client access. |
| KV namespace | `VibecoderStore` | Token cache, artifact metadata (see `shared/platform/kv/cloudflareKVProvider.ts`) | Namespaced keys; operations authenticated with Workers secrets. |
| R2 bucket | `TEMPLATES_BUCKET` | Template source, generated build artifacts | Access limited to Worker IAM; downloads served via signed URLs returned to the browser. |
| AI gateway | `AI` binding | Authenticated channel to Gemini/OpenAI with per-model routing | API keys stored in Secrets Manager; Worker retrieves via env vars and never exposes them. |

All data paths stay inside Cloudflare data centers. Clients only receive derived artifacts (blueprint text, file diffs, preview URL) over TLS.
