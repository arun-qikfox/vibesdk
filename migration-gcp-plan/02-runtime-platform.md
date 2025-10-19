# 02 - Runtime Platform on Cloud Run

Goal: Serve the existing Worker entrypoint (`worker/index.ts`) on Google Cloud Run using the open-source `workerd` runtime so the API and asset routing behave identically to Cloudflare.

## Outcomes
- Repeatable build that emits the Worker bundle without deploying to Cloudflare.
- `workerd` configuration mirroring bindings from `wrangler.jsonc`.
- Docker image published to Artifact Registry.
- Cloud Run service `vibesdk-control-plane` running the Worker bundle.
- Static assets served either from the same service or Cloud CDN (decide during this step).

## Prerequisites
- Landing zone from `01-gcp-landing-zone.md` completed.
- `wrangler` CLI available locally (already required by the repo).
- Docker or Cloud Build configured to build container images.

## Implementation Steps

### Step 1: Produce a Worker Bundle for Self-Hosting
- [x] Create `scripts/build-worker.ts` (or reuse a Bun script) that wraps `wrangler deploy --dry-run --out dist/worker-bundle`.
- [x] Add `npm run build:worker` to `package.json` to call the script.
- [x] Confirm the output includes `worker/index.js`, `metadata.json`, and the asset manifest.
- [x] Document the generated artifacts in `migration/NOTES.md` (create the file if helpful).

- [x] Under `container/workerd/`, create `service.capnp` that imports the Worker bundle and maps bindings:
  - Map KV, D1, R2, AI, and dispatch namespaces to stubs (actual implementations will arrive in later specs).
  - Map static assets via `staticContent` pointing to `dist/client`.
  - Set `durableObjects` entries matching those declared in `wrangler.jsonc`.
- [x] Ensure secrets are referenced via environment variables so Cloud Run can inject Secret Manager values.
- [x] Capture any unresolved bindings in a TODO comment for `03-data-layer.md` or `04-durable-objects-and-sandbox.md`.

- [x] Ensure the adapter shims are in place by running `npm ci` (required once per clean checkout) and `npm run build:worker`.
- [x] Sync the bundle into the workerd config context:
  - `rm -rf container/dist`
  - `mkdir -p container/dist`
  - `cp -R dist/worker-bundle container/dist/`
- [x] Upload the current static bundle to the target bucket so GCS serves fresh assets:
  - `gsutil rsync -r dist gs://vibesdk-templates` (replace bucket name if different for your environment)
- [x] Start the local runtime with the GCP environment variables (replace placeholders with secrets available to you):
  ```bash
  RUNTIME_PROVIDER=gcp \
  GCP_PROJECT_ID=qfxcloud-app-builder \
  GCP_REGION=us-central1 \
  DEFAULT_DEPLOYMENT_TARGET=gcp-cloud-run \
  TEMPLATES_REPOSITORY=https://github.com/cloudflare/vibesdk-templates \
  DISPATCH_NAMESPACE=vibesdk-default-namespace \
  ENABLE_READ_REPLICAS=true \
  CLOUDFLARE_AI_GATEWAY=vibesdk-gateway \
  CUSTOM_DOMAIN=control-plane.gcp.vibesdk.internal \
  MAX_SANDBOX_INSTANCES=10 \
  SANDBOX_INSTANCE_TYPE=standard-3 \
  USE_CLOUDFLARE_IMAGES=false \
  SANDBOX_TOPIC=vibesdk-sandbox-requests \
  GCS_TEMPLATES_BUCKET=vibesdk-templates \
  FIRESTORE_PROJECT_ID=qfxcloud-app-builder \
  AI_GATEWAY_URL=https://your-ai-gateway.example.com \
  AI_GATEWAY_API_KEY=replace_me \
  JWT_SECRET=replace_me \
  SECRETS_ENCRYPTION_KEY=replace_me \
  WEBHOOK_SECRET=replace_me \
  AI_PROXY_JWT_SECRET=replace_me \
  GOOGLE_AI_STUDIO_API_KEY=replace_me \
  GCP_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  npx workerd@1.20251011.0 serve container/workerd/service.capnp --verbose
  ```
- [x] From a second terminal, confirm the adapters respond without throwing by issuing:
  - `curl -i -H "Host: control-plane.gcp.vibesdk.internal" http://127.0.0.1:8080/`
  - Any additional adapter-specific endpoints (e.g., sandbox, dispatch, or Firestore-backed APIs) relevant to the runbook.
- [x] Inspect the workerd logs for GCP-specific activity instead of Cloudflare stubs (e.g., look for Firestore, Cloud Storage, or Pub/Sub traces) and document anomalies before continuing.

- [x] Create `container/Dockerfile.workerd`:
  - Stage 1: use `node:20-bullseye` (or Bun image) to run `npm ci` and `npm run build:worker`.
  - Stage 2: base on `gcr.io/distroless/base-debian12` (or `node:20-slim` if debugging is needed).
  - Copy `workerd` binary (download from GitHub or install via `npm install -g workerd` in build stage).
  - Copy bundle artifacts and `service.capnp`.
  - Set entrypoint to `workerd --config /app/service.capnp --watch --port 8080`.
- [x] Add `.dockerignore` to exclude `node_modules`, `dist`, etc.
- [ ] Build locally and run smoke test: `docker run -p 8787:8080 -e CUSTOM_DOMAIN=localhost ...`.

- [x] Create `cloudbuild/workerd.yaml` with steps:
  1. build using the Dockerfile,
  2. push to `us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:TAG`,
  3. substitute `TAG` from commit SHA.
- [x] Test locally with `gcloud builds submit --config cloudbuild/workerd.yaml`.

- [x] Create Terraform module `infra/gcp/modules/runtime` provisioning:
  - Cloud Run service `vibesdk-control-plane`.
  - Environment variables mapping to Secret Manager.
  - Cloud Run revisions built from the Artifact Registry image.
  - VPC connector attachment.
- [x] Configure min instances = 1 (to reduce cold starts) and concurrency ~ 80 (tune later).
- [ ] Add HTTP to HTTPS redirect via Cloud Run domain mapping or defer to load balancer step in `05-app-deployment-multicloud.md`.

### Step 7: Observability
- [x] Enable request logs by default (Cloud Run handles this).
- [ ] Add structured logging inside `worker/index.ts` (`createLogger`) to ensure log format is JSON-friendly (verify current logger supports JSON).
- [ ] Plan to export metrics to Cloud Monitoring (note in TODO section).

### Step 8: Document Outstanding Binding Gaps
- [ ] Record which bindings still point to placeholders (e.g., D1, KV, R2, AI).
- [ ] Reference the follow-up spec that will supply the implementation (e.g., “D1 → Cloud SQL in 03”).

## Verification
- [ ] `curl https://vibesdk-control-plane-<hash>-uc.a.run.app/health` returns 200 once temporary health route is exposed.
- [x] Cloud Run logs show request traces when hitting `/api/status`.
- [x] Static asset fetch (e.g., `/`) returns the built frontend or the chosen static hosting solution.

## Hand-Off Notes
- Keep the Cloud Run service private for now; public exposure will happen after DNS and TLS setup in later specs.
- Update `migration/README.md` with any deviations before merging `feat/gcp-runtime`.
