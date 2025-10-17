# Code-First Migration Plan (GCP Runtime)

This plan prioritizes code changes so the application can run directly against Google Cloud services while keeping the original execution plan intact. Use it alongside `migration/rule.md`; it does not alter the existing Terraform sequencing, but it lets you stage the refactors in source control before provisioning infrastructure.

## Guiding Principles
- Maintain current Cloudflare behaviour until the GCP adapters are ready.
- Introduce interfaces/adapters first, then plug in GCP implementations.
- Keep `RUNTIME_PROVIDER` (or similar flag) as the switch between environments.
- Each phase should be mergeable on its own, with unit/integration tests where possible.

## Phase 0 – Prerequisites
- [x] Confirm local dev environment can run builds/tests (`npm install`, `npm run build`).
- [x] Add `.env.gcp.example` with placeholders for GCP settings.
- [ ] Create feature branch `feat/gcp-code-first` (optional if covered by git workflow).

## Phase 1 – Runtime Provider Abstraction
- [x] Introduce `shared/platform/runtimeProvider.ts` with helper functions (`getRuntimeProvider`, `isCloudflareRuntime`, `isGcpRuntime`).
- [x] Update `worker/index.ts`, `worker/app.ts`, setup script, and types to read runtime provider through the helper.
- [ ] Add unit tests confirming the provider detection logic.

## Phase 2 – Database Adapter
- [x] Create `worker/database/clients` containing:
  - `cloudflareD1Client.ts` (current behaviour with Sentry instrumentation).
  - `postgresClient.ts` stub (guards unimplemented path).
  - `createDatabaseClient(env)` factory used by the rest of the code.
- [x] Refactor `worker/database/database.ts` and dependent services to consume the factory.
- [ ] Add integration/unit tests (e.g., with pg-mem) and configuration entries for Postgres connection when implemented.

## Phase 3 – KV / Cache / Rate Limit Providers
- [x] Define `shared/platform/kv` interfaces and provider factory (`get`, `put`, `delete`, `list`).
- [x] Implement Cloudflare adapter and GCP stub (placeholder throwing until Firestore integration lands).
- [x] Update call sites (`worker/config/index.ts`, `worker/services/rate-limit/rateLimits.ts`, `worker/services/cache/KVCache.ts`, sandbox KV usage) to use the provider.
- [ ] Add unit tests covering rate-limit and cache behaviour via the provider abstraction.

## Phase 4 – Object Storage Adapter
- [x] Create `shared/platform/storage` interface and factory (`get`, `put`, `delete`, metadata access).
- [x] Implement Cloudflare R2 adapter and GCP stub (throws until storage integration exists).
- [x] Refactor worker code paths (`BaseSandboxService`, sandbox client template/download logic, image helpers, screenshot controller) to rely on the adapter.
- [ ] Update CLI scripts if needed (`scripts/setup.ts`, `scripts/deploy.ts`) and add tests around storage use.

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
