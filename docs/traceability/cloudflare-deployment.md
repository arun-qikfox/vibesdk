# Cloudflare Runtime Deployment Trace (Workers + D1 + KV + Durable Objects)

The production runtime is described in `wrangler.jsonc`. This guide enumerates every step required to stand up the same environment from scratch, including database, KV, Durable Objects, and the sandbox container image.

## 1. Prerequisites
1. Install the Cloudflare CLI: `npm i -g wrangler`.
2. Authenticate once: `wrangler login`.
3. Clone/build the repo (`npm ci && npm run build:worker`) so the worker bundle at `worker/index.ts` compiles.

## 2. Secrets & Variables
Store runtime secrets that never ship in Git (all referenced by `worker/index.ts` or the agent stack):
```bash
wrangler secret put JWT_SECRET
wrangler secret put SECRETS_ENCRYPTION_KEY
wrangler secret put WEBHOOK_SECRET
wrangler secret put AI_PROXY_JWT_SECRET
wrangler secret put GOOGLE_AI_STUDIO_API_KEY
wrangler secret put CLOUDFLARE_AI_GATEWAY_TOKEN
```
Optional providers (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_CLIENT_SECRET`, etc.) can be added the same way. Non-secret flags such as `MAX_SANDBOX_INSTANCES` and `SANDBOX_INSTANCE_TYPE` are plain-text entries under `"vars"` in `wrangler.jsonc`.

## 3. D1 Database Provisioning
1. Create the remote database referenced by the binding name `DB`:
   ```bash
   wrangler d1 create vibesdk-db
   ```
2. Apply migrations defined under `/migrations` (the same folder consumed by the Drizzle schema):
   ```bash
   wrangler d1 migrations apply vibesdk-db --remote
   ```
3. To seed or inspect, use prepared statements. Example:
   ```bash
   wrangler d1 execute vibesdk-db --remote --command "SELECT count(*) FROM users;"
   ```
All Worker database access goes through `worker/database/clients/d1Client.ts`, which wraps the D1 binding in Drizzle and enforces parameterized queries.

## 4. KV Namespace & R2 Bucket
The Worker expects the bindings declared in `wrangler.jsonc`:

| Binding | Resource | Purpose |
| ------- | -------- | ------- |
| `VibecoderStore` | KV namespace | Stores cached template assets, user session hints, and feature flags (`shared/platform/kv/cloudflareKVProvider.ts`). |
| `TEMPLATES_BUCKET` | R2 bucket | Hosts the canonical template source and generated preview artifacts. |

Provision them through Wrangler if they do not already exist:
```bash
wrangler kv namespace create VibecoderStore --preview --env production
wrangler r2 bucket create vibesdk-templates
```
Update `wrangler.jsonc` with the resulting IDs if they differ.

## 5. Durable Objects & Migrations
`wrangler.jsonc` lists three Durable Object classes:
- `CodeGeneratorAgent` – the Gemini-driven agent logic (`worker/agents/core/simpleGeneratorAgent.ts`).
- `UserAppSandboxService` – orchestrates Cloudflare Containers for preview builds.
- `DORateLimitStore` – holds anti-abuse counters that supplement the KV ratelimiters.

The `"migrations"` block ensures they are registered server-side. When you add a new DO class, append a migration tag before publishing:
```bash
wrangler publish --new-sqlite-class MyNewDurableObject --name vibesdk-production
```

## 6. Sandbox Container Rollout
The sandbox service runs as a Cloudflare Container (`"containers"` array). Two options exist:
1. **Build locally** – populate `SandboxDockerfile` and run `wrangler deploy --minify --publish` after pushing the container to Cloudflare’s registry.
2. **Use prebuilt image** – uncomment the `registry.cloudflare.com/...` image reference inside `wrangler.jsonc`.

Any change to the sandbox image should be rolled out with a versioned tag, updated in `wrangler.jsonc`, and deployed with `wrangler publish`.

## 7. AI Gateway Binding
The Worker uses the AI binding (`"ai": { "binding": "AI", "remote": true }`) to call Gemini models. Ensure the Cloudflare account has an AI Gateway named `vibesdk-gateway`. If a different name is required, update both:
- `wrangler.jsonc` → `"CLOUDFLARE_AI_GATEWAY"` var.
- Runtime secret `CLOUDFLARE_AI_GATEWAY_TOKEN`.

## 8. Publish
When all bindings exist:
```bash
wrangler publish --env production
```
Wrangler will:
- Upload the `worker/index.ts` bundle.
- Bind the Worker to the configured routes (e.g., `build.cloudflare.dev`).
- Deploy the Durable Objects, KV, D1, and container configuration atomically.

## 9. Post-deploy Verification
1. `wrangler tail --env production` to follow Worker logs while issuing a sample `/api/agent` request.
2. `wrangler d1 execute ...` to confirm agent sessions persist after generation.
3. Visit the preview URL returned by `/api/agent/:id/preview` to verify the sandbox container is serving the built app.

Following these steps reproduces the exact Cloudflare environment relied on by the production agent, including secured access to D1, KV, R2, the AI gateway, and the Durable Object state machine.
