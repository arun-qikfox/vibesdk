# 09 – Backend Services (Beyond the Agent)

While sections 01–07 focus on the code-generation pipeline, this document covers the remainder of the backend built with Hono (running under Cloudflare Workers and the Node adapter for local dev). It includes authentication, user app APIs, utilities, and middleware.

## 9.1 Server Entry Points

| File | Purpose |
| ---- | ------- |
| `backend/hono-server.js` (Node dev) | Boots Hono app, sets up WebSocket server, loads worker-compatible services, bridges environment variables. |
| `worker/index.ts` (Cloudflare) | Main Worker fetch handler. Registers routes, attaches middleware, delegates to controllers. |
| `backend/setup-env.js` | Loads secrets/env variables into `global.env`, initializes Postgres/GCS/Firestore clients during GCP dev. |

## 9.2 Authentication Services

### 9.2.1 Controllers (`worker/api/controllers/auth/*.ts`)

Endpoints:
- `POST /api/auth/register` – Validates payload (email, password, displayName). Uses `AuthService.register` (hash via Argon2).  
- `POST /api/auth/login` – Email/password, returns session + JWT cookies.  
- `POST /api/auth/logout` – Clears cookies.  
- `GET /api/auth/profile` – Returns current user profile.  
- `GET /api/auth/csrf-token` – Issues CSRF token stored server-side (KV).  
- `POST /api/auth/resend-verification`, `POST /api/auth/verify-email` – OTP flow via email provider.

### 9.2.2 Services

| Component | File | Notes |
| --------- | ---- | ----- |
| `AuthService` | `worker/database/services/AuthService.ts` | CRUD for users, sessions; password hashing (Argon2), JWT issuance (JOSÉ library). |
| `SessionService` | `worker/database/services/SessionService.ts` | Manages `sessions` table, supports multiple devices. |
| `PasswordService` | `worker/database/services/PasswordService.ts` | Handles password reset tokens. |
| `UserService` | `worker/database/services/UserService.ts` | Profile updates, avatar URLs, provider linking. |

Cookies:
- `session` (UUID) – identifies DB session row.  
- `accessToken` (JWT) – bearer token with short TTL.  
- Secure, HttpOnly, SameSite=Lax.

## 9.3 User App & Catalog APIs

| Endpoint | Description | Controller |
| -------- | ----------- | ---------- |
| `GET /api/apps` | List generated apps for user (with pagination metadata). | `worker/api/controllers/apps/controller.ts` |
| `POST /api/apps` | Create new app record manually (optional). | Same controller. |
| `GET /api/apps/:appId` | Fetch single app (includes status, preview URL, metadata). | Hono route stubbed in Node dev. |
| `GET /api/apps/favorites` | Fetch favorited apps. | `AppController.getFavoriteApps`. |
| `POST /api/apps/:appId/favorite` | Toggle favorite. | Same controller. |
| `GET /api/apps/recent` | Recent completions. | Stub for UI until GCP parity. |

Services:
- `AppService` (`worker/database/services/AppService.ts`) – interacts with `apps`, `appDeployments`, `favorites`, `appLikes`, etc.  
- `FavoritesService`, `StarsService` handle user-star relationship tables.  
- `AuditService` records audit logs for state changes.

## 9.4 Utility Middleware

| Middleware | File | Role |
| ---------- | ---- | ---- |
| `authenticate` | `worker/middleware/auth/auth.ts` | Ensures authenticated user, attaches `context.user`. |
| `setAuthLevel` / `enforceAuthRequirement` | `backend/hono-middleware-adapters.js` | Set required auth level per route. |
| `validateWebSocketOrigin` | `worker/middleware/security/websocket.ts` | Blocks unwanted WS origins. |
| `errorHandler` | `worker/middleware/errorHandler.ts` | Global try/catch; logs exceptions via `StructuredLogger`. |

## 9.5 Utility Controllers

| Domain | File | Features |
| ------ | ---- | -------- |
| Sessions | `worker/api/controllers/session/controller.ts` | Manage active device sessions (list, revoke). |
| Profile | `worker/api/controllers/profile/controller.ts` | Update display name, bio, timezone, avatar. |
| Settings | `worker/api/controllers/settings/controller.ts` | Save user preferences (theme, default agent mode). |
| Analytics | `worker/api/controllers/analytics/controller.ts` | Provide usage stats (total apps, runtime metrics). |
| Health | `worker/api/controllers/status/controller.ts` | `GET /api/status` returns runtime status, version, DB connectivity. |

## 9.6 Supporting Services

| Service | Responsibility | Key Methods |
| ------- | -------------- | ----------- |
| `NotificationService` | send email/Slack/webhook notifications. | `sendAppCompleted`, `sendErrorAlert`. |
| `TelemetryService` | Track timed events, interactions. | `recordEvent`, `recordPhaseDuration`. |
| `CacheService` | Wraps KV namespace for caching (templates, preview metadata). | `get`, `setJSON`, `delete`. |
| `SecretsService` | (Optional) encrypts/decrypts user secrets via `SECRETS_ENCRYPTION_KEY`. |

## 9.7 Error Handling Strategy

| Layer | Behavior |
| ----- | -------- |
| Controllers | Wrap in try/catch, log error, return `BaseController.createErrorResponse`. |
| Services | Throw `AppError` with `statusCode` when client fault; log context via `StructuredLogger`. |
| LLM operations | On failure, broadcast WebSocket `error` and log to `agentExecutionLogs`. |
| Sandbox | If deploy fails, `deployment_failed` message with error details. |

## 9.8 Background Jobs & Cron

| Job | Implementation |
| ----| --------------- |
| Sandbox cleanup | `ResourceProvisioner` schedules TTL-based cleanup via DO alarms. |
| Session cleanup | Periodic job (Cron Worker) deletes expired sessions from D1. |
| Rate limit resets | KV counters auto-expire; DO alarms ensure fallback reset. |
| Analytics aggregation | Optional Cron job computing daily metrics into `analytics_summary` table. |

## 9.9 Configuration (Node Dev vs Cloudflare)

| Environment | Adaptations |
| ----------- | ----------- |
| Node Dev (`npm run dev:full`) | `backend/setup-env.js` loads `.env`, instantiates Postgres client, GCS client, Firestore wrapper, Gemini service. Stubs Cloudflare-specific APIs (KV → Firestore, R2 → GCS, DO storage → in-memory). |
| Cloudflare | `worker/index.ts` uses native bindings.  
  - `env.DB` (D1)  
  - `env.VibecoderStore` (KV)  
  - `env.TEMPLATES_BUCKET` (R2)  
  - `env.DisPATCH` namespace for sandbox  
  - `env.AI` for model inference. |

## 9.10 Testing

| Type | Tools | Notes |
| ---- | ----- | ----- |
| Unit tests | Vitest | Focus on services (AuthService, AppService). |
| Integration | Wrangler + Miniflare | Simulate Worker environment for API tests. |
| E2E | Playwright | Auth flow, agent generation, preview viewing. |

---

This backend overview, combined with previous sections, provides everything needed to regenerate the entire server-side stack—including user management, app catalogs, metrics, and supporting middleware—alongside the agent runtime.
