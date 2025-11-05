# 05 – API Surface, Streaming, and WebSockets

This document specifies the external interface exposed by the Cloudflare Worker: HTTP endpoints, NDJSON streaming format, and WebSocket protocols.

## 5.1 HTTP Endpoints (Agent Focus)

| Method & Path | Handler | Description |
| ------------- | ------- | ----------- |
| `POST /api/agent` | `CodingAgentController.startCodeGeneration` | Starts code generation, returns NDJSON stream of progress events. |
| `GET /api/agent/:agentId/connect` | `connectToExistingAgent` | Returns websocket URL for already-initialized agent. |
| `GET /api/agent/:agentId/preview` | `deployPreview` | Triggers preview redeploy (authenticated). |
| `GET /api/agent/:agentId/ws` | `handleWebSocketConnection` | Upgrades to WebSocket; all real-time commands flow here. |

### 5.1.1 `POST /api/agent` Request Body

```json
{
  "query": "Create a reminder app with login and scheduling",
  "agentMode": "deterministic",
  "language": "typescript",
  "frameworks": ["react", "vite"],
  "images": [
    {
      "filename": "wireframe.png",
      "mimeType": "image/png",
      "base64Data": "..."
    }
  ]
}
```

### 5.1.2 NDJSON Response Stream

Each line is a JSON object (`TextEncoder` output). Common payloads:

| Event | Example Payload |
| ----- | ---------------- |
| Initial ack | `{ "message": "Code generation started", "agentId": "...", "websocketUrl": "...", "httpStatusUrl": "...", "template": { "name": "...", "files": [...] } }` |
| Blueprint chunk | `{ "chunk": "## Product Vision\n..." }` |
| Completion | `{ "type": "complete", "message": "Blueprint generation completed", "blueprint": { ... } }` |
| Error | `{ "type": "error", "message": "..." }` |

Stream terminates with the literal string `"terminate"` followed by `writer.close()`.

## 5.2 WebSocket Protocol

### 5.2.1 Client → Server Messages (`WebSocketMessageRequests`)

| Type | Purpose | Payload |
| ---- | ------- | ------- |
| `generate_all` | Start/continue full phase execution. | `{ "type": "generate_all" }` |
| `get_conversation_state` | Retrieve agent conversation context. | `{ "type": "get_conversation_state" }` |
| `user_suggestion` | Submit new instructions. | `{ "type": "user_suggestion", "message": "...", "images": [...] }` |
| `preview` | Deploy latest preview. | `{ "type": "preview" }` |
| `code_review` | Trigger manual review (optionally autofix). | `{ "type": "code_review", "autoFix": true }` |
| `get_model_configs` | Request available model configs. | `{ "type": "get_model_configs" }` |
| `stop_generation` / `resume_generation` | Control generation loop. | `{ "type": "stop_generation" }` |
| `runtime_error_found` | Client-reported runtime issues. | `{ "type": "runtime_error_found", "data": [...] }` |

### 5.2.2 Server → Client Messages (`WebSocketMessageResponses`)

| Type | Description |
| ---- | ----------- |
| `connected` | (Starter message) acknowledges WebSocket connection. |
| `generation_started` | `{ totalFiles, message }` – emitted before `generateAllFiles`. |
| `file_generating` / `file_chunk_generated` / `file_generated` | File diff / content updates during SCOF streaming. |
| `phase_generating`, `phase_generated` | Phase lifecycle updates. |
| `code_reviewing`, `code_reviewed` | Review progression and results. |
| `deployment_started`, `deployment_completed` | Preview deployment lifecycle (includes `previewURL`). |
| `conversation_state` | Snapshot returned by `getConversationState()`. |
| `model_configs_info` | Model metadata for UI. |
| `error`, `rate_limit_error` | Failure notifications. |
| `generation_complete` | Final success event. |

### 5.2.3 Broadcast Flow

`SmartCodeGeneratorAgent.broadcast()` iterates active WebSockets (stored in DO state) and sends JSON strings. Broadcast occurs for:
- File streaming events
- Static analysis results
- Deployment statuses
- Runtime errors
- Conversation responses

## 5.3 Authentication & Rate Limiting

| Mechanism | Details |
| --------- | ------- |
| Auth check | `hono-middleware-adapters.authenticate` verifies JWT in cookies (`accessToken`, `session`). |
| Rate limit | `RateLimitService.enforceAppCreationRateLimit` (uses DO `DORateLimitStore` and KV buckets). |
| CSRF | `/api/auth/csrf-token` for frontend forms. |
| WebSocket origin validation | `validateWebSocketOrigin` ensures only allowed origins (e.g., Vite dev server) connect. |

## 5.4 Error Cases

| Scenario | Response |
| -------- | -------- |
| Invalid JSON | HTTP 400 with `{ success: false, error: "Invalid JSON..." }`. |
| Missing query | HTTP 400. |
| Rate limit exceeded | HTTP 429. |
| Agent initialization failure | Stream emits error event; WebSocket receives `error`. |
| Authentication failure | HTTP 401; WebSocket rejected. |

## 5.5 Client Responsibilities

The SPA (see `src/routes/chat/use-chat.ts`) must:
- Consume NDJSON stream using `ReadableStreamDefaultReader`.  
- Reconnect WebSocket using URL provided in initial NDJSON payload.  
- Handle event types enumerated above to update UI timeline, file tree, preview panel.

---

Re-producing this interface exactly is critical. Consumers expect both the NDJSON stream and the WebSocket protocol to behave identically when the agent is ported to another runtime.
