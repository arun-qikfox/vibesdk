# 06 - Local Development and Testing with GCP

Goal: Run VibSDK locally (frontend + worker dev server) while connecting to Google Cloud resources to validate the migration end-to-end before production rollout.

## Outcomes
- Local `.env.gcp` file with service account impersonation or workload identity instructions.
- `npm run dev:gcp` script that starts the worker using GCP adapters.
- Tunnel or port-forward solution so Cloud Run-managed callbacks reach the local machine when needed.
- Manual and automated test checklists to verify the platform on Google Cloud.

## Prerequisites
- Specs `01` through `05` implemented.
- Service account `vibesdk-dev` created with minimal permissions.
- `wrangler` v3+, `gcloud` CLI, and Ngrok (or `cloudflared`) available locally.

## Implementation Steps

### Step 1: Authenticate Locally
- [ ] Prefer workload identity federation:
  ```
  gcloud auth login
  gcloud config set project vibesdk-gcp
  gcloud iam service-accounts add-iam-policy-binding \
    vibesdk-dev@vibesdk-gcp.iam.gserviceaccount.com \
    --member="user:<your-email>" \
    --role="roles/iam.serviceAccountTokenCreator"
  gcloud auth print-identity-token --audiences=https://iamcredentials.googleapis.com
  ```
- [ ] If using JSON key (temporary), download into `~/.config/gcloud/vibesdk-dev.json` and add to `.gitignore`.
- [ ] Document the chosen approach in `migration/NOTES.md`.

### Step 2: Environment Variables
- [ ] Create `.env.gcp` at repository root containing:
  ```
  GCP_PROJECT_ID=vibesdk-gcp
  GCP_REGION=us-central1
  DEFAULT_DEPLOYMENT_TARGET=gcp-cloud-run
  DATABASE_URL=postgres://...
  FIRESTORE_PROJECT_ID=vibesdk-gcp
  GCS_TEMPLATES_BUCKET=vibesdk-templates
  SANDBOX_TOPIC=sandbox-requests
  ```
- [ ] Update `package.json` scripts to load this file when running dev (`cross-env $(cat .env.gcp ...)`).

### Step 3: Local Worker Runtime
- [ ] Add `npm run dev:gcp` that executes:
  ```
  bunx wrangler dev --local --experimental-local --env .env.gcp --test --compatibility-date=2025-08-10
  ```
  (Adjust once `workerd` local mode is configured.)
- [ ] Ensure adapter selection logic reads `process.env.RUNTIME_PROVIDER`.
- [ ] For sandbox previews, point to staging Cloud Run endpoints until local emulation is available.

### Step 4: Frontend
- [ ] Update Vite config to forward `/api` requests to `localhost:8787` where the worker runs.
- [ ] Run `npm run dev` and confirm app loads with Google Cloud defaults.

### Step 5: Testing Checklist
- [ ] User signup/login flow hits Cloud SQL successfully.
- [ ] Template list loads from Cloud Storage.
- [ ] Generate app, run preview using Cloud Run jobs, verify logs downloadable.
- [ ] Deploy app to Cloud Run target and access via assigned subdomain.
- [ ] Switch target to Cloudflare and ensure fallback pipeline behaves as before.

### Step 6: Automated Tests
- [ ] Add integration test suite under `tests/gcp/` using Playwright or Vitest + supertest.
- [ ] Mock minimal Google Cloud APIs where possible; otherwise, hit staging project with throttled quota.
- [ ] Include smoke test script for CI (run after each merge to main).

### Step 7: Observability During Testing
- [ ] Use `gcloud beta run services proxy` to tail local request logs.
- [ ] Configure OpenTelemetry exporter if additional traces required.
- [ ] Capture log snippets and attach to PR descriptions when testing new features.

## Verification
- [ ] Local commands succeed without Cloudflare bindings present.
- [ ] All adapters select `gcp` path (confirm via logs).
- [ ] Manual checklist completed with screenshots or terminal captures.
- [ ] Tests in `tests/gcp/` pass locally and on CI.

## Wrap-Up
- Once this step is complete, the migration plan is ready for full execution.
- Update `migration/README.md` with any lessons learned or caveats for future contributors.

