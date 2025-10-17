# Code-First Migration Plan (GCP Runtime)

This plan prioritizes code changes so the application can run directly against Google Cloud services while keeping the original execution plan intact. Use it alongside `migration/rule.md`; it does not alter the existing Terraform sequencing, but it lets you stage the refactors in source control before provisioning infrastructure.

## Guiding Principles
- Maintain current Cloudflare behaviour until the GCP adapters are ready.
- Introduce interfaces/adapters first, then plug in GCP implementations.
- Keep `RUNTIME_PROVIDER` (or similar flag) as the switch between environments.
- Each phase should be mergeable on its own, with unit/integration tests where possible.

## Phase 0 – Prerequisites
- [ ] Confirm local dev environment can run all tests (`npm test`, `bun run lint` etc.).
- [ ] Create feature branch `feat/gcp-code-first`.
- [ ] Add `.env.gcp.example` with placeholders for upcoming env variables (GCP project, region, DB URL, etc.).

## Phase 1 – Runtime Provider Abstraction
- [ ] Introduce `shared/platform/runtimeProvider.ts` with helper functions (`isCloudflare()`, `isGcp()`).
- [ ] Update `worker/index.ts`, `worker/app.ts`, setup scripts, and any env-dependent modules to use the helper rather than directly reading Cloudflare bindings.
- [ ] Add unit tests confirming the provider detection logic.

## Phase 2 – Database Adapter
- [ ] Create `worker/database/clients` containing:
  - `cloudflareD1Client.ts` (current behaviour).
  - `postgresClient.ts` using `drizzle-orm/postgres-js`.
  - `createDatabaseClient(env)` factory the rest of the code calls.
- [ ] Refactor `worker/database/database.ts` and all services to consume the factory.
- [ ] Add configuration entries for `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (if needed).
- [ ] Write integration tests using an in-memory Postgres (e.g., `pg-mem`) or test container.

## Phase 3 – KV / Cache / Rate Limit Providers
- [ ] Define `shared/platform/kv/kvProvider.ts` interface (`get`, `put`, `delete`, `list`).
- [ ] Implement `cloudflareKvProvider` (wrap existing `env.VibecoderStore`).
- [ ] Stub `gcpFirestoreProvider` initially (with TODO comments); return mock to satisfy TypeScript.
- [ ] Update call sites (`worker/config/index.ts`, `worker/services/rate-limit/rateLimits.ts`, `worker/services/cache/KVCache.ts`) to use the provider.
- [ ] Add unit tests covering rate limit behaviour via the provider.

## Phase 4 – Object Storage Adapter
- [ ] Create `shared/platform/storage/objectStore.ts` interface (`getObject`, `putObject`, `deleteObject`).
- [ ] Implement Cloudflare R2 adapter (`cloudflareObjectStore`).
- [ ] Add stub for `gcpStorageObjectStore`.
- [ ] Refactor image utilities, sandbox template loading, and scripts (`scripts/setup.ts`, `scripts/deploy.ts`) to use the interface.

## Phase 5 – Sandbox & Deployment Abstractions
- [ ] Introduce `shared/platform/sandbox/index.ts` exposing methods like `runPreview`, `getLogs`, `cleanup`.
- [ ] Wrap current `@cloudflare/sandbox` logic in a Cloudflare adapter.
- [ ] Create stub GCP implementation calling placeholder functions (to be completed later).
- [ ] Update `worker/services/sandbox/sandboxSdkClient.ts` to use the adapter.
- [ ] Add `shared/platform/deployment/index.ts` interface for `deploy`, `remove`, `status`.
- [ ] Keep existing Cloudflare dispatcher path, add stub GCP deployment target.

## Phase 6 – Configuration & Setup Updates
- [ ] Extend setup wizard (`scripts/setup.ts`) to capture GCP-specific settings (project ID, region, default deployment target).
- [ ] Update `.dev.vars.example` and the new `.env.gcp.example`.
- [ ] Ensure `wrangler.jsonc` changes (if any) remain backwards compatible.

## Phase 7 – Tests & Tooling
- [ ] Create `tests/gcp/` directory with smoke tests that run against stubs (no real GCP calls yet).
- [ ] Update CI workflows (if applicable) to run the new test suites.
- [ ] Document how to execute the tests locally.

## Phase 8 – Cleanup & Review
- [ ] Audit for direct Cloudflare binding access; ensure code paths use adapters.
- [ ] Remove any temporary TODO comments once real GCP implementations land.
- [ ] Prepare PR checklist summarizing the staged changes.

## After Code Refactor
Once stubs are in place and tests pass:
- Implement real GCP providers in the same module locations.
- Populate `.env.gcp` with actual values.
- Run end-to-end tests pointing at a staging GCP project.
- Proceed with Terraform apply when ready, then follow the main migration plan for deploying services.

Keep this plan in sync with progress: mark completed tasks, note blockers, and cross-reference with `migration/rule.md` milestones.

