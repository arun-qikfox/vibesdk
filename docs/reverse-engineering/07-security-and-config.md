# 07 – Security, Configuration, and Supporting Systems

This section documents the authentication model, rate limiting, environment configuration, and supporting subsystems that surround the agent runtime.

## 7.1 Authentication & Session Management

| Component | Responsibility | Files |
| --------- | -------------- | ----- |
| `AuthService` | User registration, password hashing, session issuance, JWT generation. | `worker/database/services/AuthService.ts` |
| Auth controllers | REST handlers for `/api/auth/*` (register, login, logout, profile). | `worker/api/controllers/auth/controller.ts` |
| Middleware | Enforces authentication level (`public`, `authenticated`, `owner-only`). | `worker/middleware/auth/auth.ts`, `hono-middleware-adapters.ts` |
| JWT cookies | `session`, `accessToken` stored as HttpOnly cookies; validated on every request. | `AuthService.createSession`, `auth/middleware` |

### 7.1.1 JWT Structure

Payload includes:
```json
{
  "sub": "<user-id>",
  "email": "...",
  "sessionId": "...",
  "type": "access",
  "iat": 1690000000,
  "exp": 1690003600
}
```

Secret: `JWT_SECRET`. Signing algorithm: HS256. Tokens decoded server-side for each request/WS handshake.

## 7.2 Rate Limiting

| Layer | Description |
| ----- | ----------- |
| Durable Object `DORateLimitStore` | Tracks per-user counts using DO storage. |
| KV ratelimit bindings (`API_RATE_LIMITER`, `AUTH_RATE_LIMITER`) | Fail-safe counters configured in `wrangler.jsonc` (`unsafe.bindings`). |
| `RateLimitService` | Exposes `enforceAppCreationRateLimit`, `enforceLLMCallsRateLimit`. |
| Config | `getRateLimitSettings(env)` reads from `worker/config/security.ts` (thresholds per plan). |

If limits are exceeded, controllers return HTTP 429 and the NDJSON stream ends with an error.

## 7.3 Environment Variables & Flags

| Variable | Purpose |
| -------- | ------- |
| `RUNTIME_PROVIDER` | `cloudflare` vs `gcp`; switches schema/runtime factory. |
| `TEMPLATES_REPOSITORY` | Git URL for template manifest. |
| `DISPATCH_NAMESPACE` | Name of dispatch namespace for sandbox tasks. |
| `ENABLE_READ_REPLICAS` | Enables D1 read replicas (where supported). |
| `CUSTOM_DOMAIN`, `MAX_SANDBOX_INSTANCES`, `SANDBOX_INSTANCE_TYPE` | Platform tuning knobs. |
| `USE_CLOUDFLARE_IMAGES` | Dictates whether sandbox uses Cloudflare’s base image. |

Defaults stored under `"vars"` in `wrangler.jsonc`. Secrets injected via `wrangler secret`.

## 7.4 Secrets Management

Secrets required for runtime:
- `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `WEBHOOK_SECRET`  
- `AI_PROXY_JWT_SECRET`, `CLOUDFLARE_AI_GATEWAY_TOKEN`  
- LLM API keys: `GOOGLE_AI_STUDIO_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.  
- OAuth client credentials (Google, GitHub) for sign-in.  

Set using `wrangler secret put <NAME>`. Worker accesses via `env.NAME`.

## 7.5 Email & Notifications

Optional integration via `Mailersend` (see `worker/services/notifications`). Uses API key secret and templates to send verification emails.

## 7.6 Observability & Logging

| Aspect | Details |
| ------ | ------- |
| Structured logging | `worker/logger` (StructuredLogger) outputs JSON with `component`, `level`, `message`, `context`. |
| Sentry | `@sentry/cloudflare` instrumentation optional (environment-specific). |
| Wrangler tail | `wrangler tail --headers --format pretty` for real-time debugging. |

## 7.7 Development & Tooling

| Command | Purpose |
| ------- | ------- |
| `npm run dev:full` | Runs Vite dev server + Hono backend (Node). |
| `npm run api:dev` | Starts backend only. |
| `npm run build:worker` | Builds Cloudflare worker bundle. |
| `npm run test` / `npm run test-gcp-ready` | Executes vitest suites. |

## 7.8 Configuration Files

| File | Description |
| ---- | ----------- |
| `wrangler.jsonc` | Production configuration (bindings, routes, containers, migrations). |
| `tsconfig.worker.json` | TypeScript config for worker bundle. |
| `worker-configuration.d.ts` | Declares `Env` interface with bindings (used throughout code). |

---

Understanding these security and configuration requirements is vital to reproducing the runtime correctly. Any port (e.g., to GCP) must map each binding, secret, and ratelimit mechanism to an equivalent service while preserving behavior.
