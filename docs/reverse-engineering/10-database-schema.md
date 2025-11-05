# 10 – Database Schema Reference

This document enumerates every table, column, relationship, and migration involved in the Cloudflare Worker deployment (SQLite/D1). Use it to recreate the schema in another database (e.g., Postgres).

## 10.1 Overview

- Primary schema defined in `worker/database/schema.sqlite.ts`.  
- GCP/Postgres variant in `worker/database/schema.gcp.ts` (same logical tables).  
- Drizzle ORM used for runtime queries (`worker/database/services/*`).  
- Migrations stored under `/migrations` with naming pattern `000X_description.sql`.

## 10.2 Tables (Agent Domain)

| Table | Columns | Description |
| ----- | ------- | ----------- |
| `agentSessions` | `id` (PK, UUID), `userId`, `status` (`initialized`, `executing`, `completed`, `failed`), `state` (JSON), `blueprint` (JSON), `templateName`, `agentMode`, `createdAt`, `updatedAt` | Master record for each agent run. |
| `agentPhases` | `id`, `agentId` (FK → agentSessions), `phaseName`, `status`, `concept` (JSON), `artifacts` (JSON), `startedAt`, `completedAt`, `retryCount` | Tracks each phase generated/implemented. |
| `templateAssets` | `id`, `templateName`, `filePath`, `fileHash`, `payload` (text), `createdAt` | Cached template files to avoid repeated downloads from R2. |
| `agentExecutionLogs` | `id`, `agentId`, `level` (`info`, `warn`, `error`), `message`, `metadata` (JSON), `timestamp` | Chronological event log for debug/audit. |
| `websocketConnections` | `id`, `agentId`, `connectionId`, `connectedAt`, `lastSeen`, `clientMeta` | Tracks connected clients for broadcast/resume. |
| `agentUserSuggestions` | `id`, `agentId`, `userId`, `payload` (text), `images` (JSON), `createdAt` | Captures user prompts injected mid-run. |
| `agentCommands` | `id`, `agentId`, `command`, `status`, `output`, `executedAt` | Commands queued/executed by agent (CI/CD, scripts). |

## 10.3 Tables (Apps & Users)

| Table | Columns | Description |
| ----- | ------- | ----------- |
| `apps` | `id`, `userId`, `title`, `description`, `status`, `blueprint`, `previewUrl`, `visibility`, `createdAt`, `updatedAt` | Represents generated apps linked to sessions. |
| `appDeployments` | `id`, `appId`, `environment` (`preview`, `production`), `url`, `status`, `deployedAt`, `logs` | Deployment history. |
| `favorites` | `id`, `userId`, `appId`, `createdAt` | Favorite apps per user. |
| `appLikes` | `id`, `userId`, `appId`, `createdAt` | Social engagement. |
| `appComments` | `id`, `appId`, `userId`, `body`, `createdAt` | Comment threads. |
| `appViews` | `id`, `appId`, `userId`, `viewedAt`, `metadata` | View tracking. |
| `users` | `id`, `email`, `displayName`, `passwordHash`, `emailVerified`, `avatarUrl`, `bio`, `role`, `createdAt`, `updatedAt` | User accounts. |
| `sessions` | `id`, `userId`, `userAgent`, `ipAddress`, `createdAt`, `expiresAt` | Device sessions. |
| `oauthStates` | `id`, `provider`, `state`, `codeVerifier`, `createdAt` | OAuth login support. |
| `apiKeys` | `id`, `userId`, `name`, `hashedKey`, `scopes`, `createdAt` | User API tokens. |
| `userSecrets` | `id`, `userId`, `key`, `value` (encrypted), `createdAt`, `updatedAt` | Secure storage for user-provided credentials. |

## 10.4 Supporting Tables

| Table | Purpose |
| ----- | ------- |
| `auditLogs` | Records administrative events. |
| `systemSettings` | Global configuration toggles (feature flags). |
| `rateLimitBuckets` | Stores KV fallback for rate limiting. |
| `analyticsEvents` | Optional event tracking table. |
| `verificationOtps`, `passwordResetTokens` | OTP/Reset flows. |

## 10.5 Durable Object Tables (Logical)

While not D1 tables, these exist within DO storage (managed manually):

```
cf_agents_state(id TEXT PRIMARY KEY, state TEXT)
cf_agents_queues(id TEXT, payload TEXT, callback TEXT, created_at INTEGER)
cf_agents_schedules(id TEXT, callback TEXT, payload TEXT, type TEXT, time INTEGER, delayInSeconds INTEGER, cron TEXT)
cf_agents_mcp_servers(id TEXT, name TEXT, server_url TEXT, client_id TEXT, auth_url TEXT, callback_url TEXT, server_options TEXT)
```

## 10.6 Migrations

| File | Summary |
| ----- | ------- |
| `0001_initial_schema.sql` | Creates users, sessions, apps, favorites, etc. |
| `0005_agent_state_management.sql` | Adds agentSessions, agentPhases, templateAssets, execution logs. |
| `0006_add_agent_session_state.sql` | Introduces blueprint/state JSON columns and websocketConnections table. |
| `0007_add_agent_user_suggestions.sql` | Tracks conversation inputs. |
| `0008_add_app_deployments.sql` | Deployment tracking. |

Each migration uses SQLite syntax compatible with Cloudflare D1. When porting to Postgres, translate types (`TEXT`, `INTEGER`, `BLOB`, `BOOLEAN`, `TIMESTAMP`).

## 10.7 Indexes & Constraints

- Primary keys generally UUID (`TEXT`).  
- Foreign keys enforced where D1 supports (Future DB should enforce strict FK).  
- Index suggestions:
  - `agentPhases(agentId, phaseName)`  
  - `agentExecutionLogs(agentId, timestamp)`  
  - `apps(userId, status)`  
  - `favorites(userId, appId)` unique.  
  - `sessions(userId, createdAt)` descending.  

## 10.8 ORM Models (Drizzle)

| Table | Drizzle Object | File |
| ----- | -------------- | ---- |
| `agentSessions` | `agentSessions` constant | `worker/database/schema.sqlite.ts` |
| `agentPhases` | `agentPhases` | same file |
| `templateAssets` | `templateAssets` | same file |
| ... | ... | ... |

Services like `AgentStateService` use Drizzle queries:
- `.insert(table).values({...}).returning()`  
- `.update(table).set({...}).where(eq(table.id, id))`  
- `.select().from(table).where(...)`

## 10.9 Seed & Sample Data

- `seed/templates` – JSON manifest for templates (name, description, frameworks).  
- `seed/apps` – Dev data for demo apps.  
- Unit tests seed simple users/apps into in-memory D1.

## 10.10 Porting Notes

When migrating to Postgres:
- Convert `TEXT` → `TEXT`, `INTEGER` → `INTEGER`, `BOOLEAN` → `BOOLEAN`, `BLOB` → `BYTEA`.  
- Replace `datetime('now')` default with `CURRENT_TIMESTAMP`.  
- Ensure JSON columns use `JSONB` (blueprint/state).  
- Implement migrations via `drizzle-kit` (`drizzle.config.remote.ts`) or standard SQL.

---

Refer to this schema when recreating the backend data layer. Ensure services described in sections 08 and 09 align with the table definitions here.
