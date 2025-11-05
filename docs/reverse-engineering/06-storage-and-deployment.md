# 06 – Storage, Preview Pipeline & Deployment

This section documents every data store and deployment mechanism used by the Cloudflare agent runtime.

## 6.1 Persistent Storage Overview

| Store | Binding | Purpose |
| ----- | ------- | ------- |
| **D1 Database** | `DB` | Primary relational store: agent sessions, phases, template assets, execution logs, websocket connections, apps metadata. |
| **Durable Object Storage** | `CodeGenObject` internal | Fast, local persistence for agent state, queues, schedules (tables: `cf_agents_state`, `cf_agents_queues`, `cf_agents_schedules`, `cf_agents_mcp_servers`). Provides atomic updates. |
| **KV Namespace** | `VibecoderStore` | Caches template manifests, sandbox metadata, rate limit counters, feature toggles. |
| **R2 Bucket** | `TEMPLATES_BUCKET` | Stores template directories (prompts, scaffolding) and sandbox build artifacts (preview outputs). |

### 6.1.1 D1 Schema (Key Tables)

| Table | Columns (simplified) | Source |
| ----- | -------------------- | ------ |
| `agentSessions` | `id`, `userId`, `status`, `state` (JSON), `createdAt`, `updatedAt` | Defined in `worker/database/schema.sqlite.ts` and `schema.gcp.ts`. |
| `agentPhases` | `id`, `agentId`, `phaseName`, `status`, `artefacts`, `createdAt` | Track progress of each generated milestone. |
| `templateAssets` | `id`, `templateName`, `filePath`, `fileHash`, `payload` | Caches template files retrieved from R2. |
| `agentExecutionLogs` | `id`, `agentId`, `level`, `message`, `metadata`, `timestamp` | Durable audit trail. |
| `websocketConnections` | `id`, `agentId`, `connectionId`, `connectedAt`, `lastSeen` | Manage active sockets. |

### 6.1.2 Durable Object Storage Tables

| Table (logical) | Use |
| --------------- | --- |
| `cf_agents_state` | Serialized `CodeGenState`; acts as authoritative snapshot. |
| `cf_agents_queues` | Pending jobs (e.g., file regeneration tasks). |
| `cf_agents_schedules` | Alarm scheduler (delayed / cron triggers). |
| `cf_agents_mcp_servers` | Registered MCP tool servers (experimental). |

## 6.2 Preview & Deployment Pipeline

### 6.2.1 Sandbox Service

| Component | File | Description |
| --------- | ---- | ----------- |
| `SandboxSdkClient` | `worker/services/sandbox/sandboxSdkClient.ts` | RPC client to container fleet. Handles template retrieval (`listTemplates`, `getTemplateDetails`), file uploads, deployment commands, preview retrieval, cleanup. |
| `RemoteSandboxService` | `worker/services/sandbox/remoteSandboxService.ts` | Implements client methods by calling dispatch namespace endpoints. |
| `ResourceProvisioner` | `worker/services/sandbox/resourceProvisioner.ts` | Manages sandbox instance lifecycle, TTL, and caching (via KV). |

### 6.2.2 Preview Flow

1. `deployToSandbox()` collects current project files (in-memory FS).  
2. Files zipped/transferred to sandbox container via `SandboxSdkClient`.  
3. Container runs `npm install`, `npm run build`, `npm run preview` (commands determined by template manifest).  
4. Build output stored in R2 at `templates/{agentId}/...`.  
5. Signed preview URL generated and returned to agent.  
6. WebSocket event `deployment_completed` broadcast with `previewURL`.  
7. Preview domain configured via `wrangler.jsonc` routes (`build-preview.cloudflare.dev`).

### 6.2.3 Production Deployment

Triggered separately (`deployToCloudflare()`), publishes built assets to Cloudflare Workers Sites or Cloudflare Pages (depending on template). Follows similar container build pipeline but targets production route.

## 6.3 File Management

| Layer | Responsibility |
| ----- | -------------- |
| `FileManager` (agent) | Manages virtual file system during generation, applies SCOF patches. |
| `StateManager` | Bridges between agent state and persisted session data. |
| `TemplateParser` | Parses template files, handles replacements, scaffolding instructions. |
| `TemplateAsset` caching | `AgentStateService.persistTemplateAssets` avoids refetching unchanged R2 objects. |

## 6.4 Secrets & Environment Variables

| Secret | Usage |
| ------ | ----- |
| `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `WEBHOOK_SECRET` | Auth/session handling. |
| `AI_PROXY_JWT_SECRET` | Auth when proxying AI requests. |
| `GOOGLE_AI_STUDIO_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM credentials. |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | Gateway authentication for `env.AI`. |
| `MAILERSEND_API_KEY` (optional) | Email notifications. |

Set via `wrangler secret put <NAME>`. Non-secret config resides in `wrangler.jsonc` under `"vars"` (e.g., `MAX_SANDBOX_INSTANCES`, `ENABLE_READ_REPLICAS`).

## 6.5 Migration Scripts

| Purpose | File |
| ------- | ---- |
| D1 schema evolution | `migrations/*.sql` (SQLite-compatible). |
| Agent-specific tables | `0005_agent_state_management.sql`, `0006_add_agent_session_state.sql`. |

## 6.6 Observability

| Feature | Configuration |
| ------- | ------------- |
| Worker logs | Cloudflare Workers dashboard (`wrangler tail`). |
| Observability binding | `"observability": { "enabled": true, "head_sampling_rate": 1 }` in `wrangler.jsonc`. |
| Structured logger | `worker/logger` outputs JSON entries with component tags. |

## 6.7 Deployment Commands

```bash
# Publish Worker + DO + bindings
wrangler publish

# Apply D1 migrations
wrangler d1 migrations apply vibesdk-db --remote

# Tail logs during generation
wrangler tail --format pretty
```

---

These storage and deployment primitives must be recreated (or replaced with equivalents) to port the agent runtime. Use this section as a blueprint for mapping D1 → Postgres, KV → Firestore, R2 → GCS, and sandbox containers → Cloud Run jobs in a GCP migration.
