# 05 - App Deployment (Multi-Cloud)

Goal: Allow generated applications to deploy to Google Cloud Run by default while preserving the existing Cloudflare Workers for Platforms path as an optional target.

## Outcomes
- Deployment orchestrator that supports multiple targets (`gcp-cloud-run`, `cloudflare-workers`).
- Updated UI/worker configuration so GCP is the default deployment target.
- Build pipeline that packages generated apps into OCI images and deploys to Cloud Run services.
- Domain and TLS configuration for preview and production apps on Google Cloud.
- Backwards-compatible Cloudflare deployment flow (no regressions).

## Prerequisites
- Runtime, data, and sandbox layers from previous specs operating on GCP.
- Cloud Run job/service for sandbox previews (from `04-durable-objects-and-sandbox.md`).
- Cloud Build trigger capable of building arbitrary app bundles.

## Implementation Steps

### Step 1: Deployment Target Abstraction
- [x] Create `shared/platform/deployment/index.ts` exporting interface:
  ```ts
  export interface DeploymentTarget {
    id: 'gcp-cloud-run' | 'cloudflare-workers';
    deploy(input: DeploymentInput): Promise<DeploymentResult>;
    remove(appId: string): Promise<void>;
    status(appId: string): Promise<DeploymentStatus>;
  }
  ```
- [x] Implement adapters:
  - `cloudflareWorkersTarget` (wrap existing dispatch behaviour).
  - `gcpCloudRunTarget` (new).
- [x] Update orchestration flow in `worker/services/sandbox/sandboxSdkClient.ts` to call the target based on user preference stored in config (`worker/config/index.ts`).

Implementation notes:
- Registered target factories so Cloudflare dispatch now routes through `DeploymentTarget.deploy` while a stub guards the future Cloud Run path. Until the configuration layer grows, the selector honours `DEFAULT_DEPLOYMENT_TARGET` and defaults to GCP by default while still honouring the env override.
- Retained the legacy `getDeploymentAdapter` export to avoid breaking existing consumers while the sandbox service migrates to the new abstraction.

### Step 2: Build Artifacts for Cloud Run
- [x] Define container template in `templates/cloudrun-app/Dockerfile` (Node 20 + generated app build).
- [x] Extend sandbox pipeline so final build outputs a tarball with Docker context.
- [x] Add Cloud Build configuration `cloudbuild/app-deploy.yaml`:
  1. Build app image tagged `app-<appId>:<version>`.
  2. Push to Artifact Registry repository `vibesdk-apps`.
  3. Deploy to Cloud Run service `app-<appId>` (or update existing).
- [x] Provide fallbacks for static-only apps (deploy to Cloud Storage + Cloud CDN if no server needed).

Implementation notes (Step 2):
- Reusable Cloud Run Docker context now lives in `templates/cloudrun-app/` (multi-stage build + smart entrypoint).
- New helper script `npm run cloudrun:context` (see `scripts/create-cloudrun-context.ts`) packages a sandbox workspace and template assets into a `.tar.gz` ready for Cloud Build or manual builds.
- `cloudbuild/app-deploy.yaml` builds, pushes, and deploys the image with configurable substitutions so triggers can supply service name, region, and context location.
- `entrypoint.sh` serves static builds with `serve@14` when no explicit server is defined, covering purely static apps without extra configuration.

### Step 3: Metadata and Routing
- [ ] Create Cloud SQL table `app_deployments` with columns (`app_id`, `version`, `target`, `service_url`, `status`, `created_at`).
- [ ] When deploying to Cloud Run, store resulting service URL.
- [ ] Update `handleUserAppRequest` in `worker/index.ts:52-119` to:
  - Check if request host matches the configured preview domain.
  - Resolve to Cloud Run URL via database lookup when target is `gcp-cloud-run`.
  - Preserve dispatcher path for `cloudflare-workers`.

### Step 4: DNS and TLS
- [ ] Reserve domain (e.g., `apps.vibesdk.example.com`) in Cloud DNS.
- [ ] Configure HTTPS Load Balancer with Cloud Run backend to route `*.apps.vibesdk.example.com`.
- [ ] For preview apps, mint subdomain records dynamically using Cloud DNS API (or rely on Cloud Run domain mappings).
- [ ] Document DNS automation in Terraform.

### Step 5: UI and Configuration Defaults
- [x] Update backend default so `DEFAULT_DEPLOYMENT_TARGET` falls back to `gcp-cloud-run` when unspecified (frontend toggle pending).
- [ ] Add toggle in admin UI to switch per app or per workspace.
- [ ] Update setup wizard (`scripts/setup.ts`) to collect GCP deployment settings (Artifact Registry project, region, service account).
- [ ] Ensure `.dev.vars` includes new environment variables (`DEFAULT_DEPLOYMENT_TARGET`, `GCP_PROJECT_ID`, etc.).

### Step 6: Rollback and Cleanup
- [ ] Implement `remove` method for Cloud Run target to delete services when users discard apps.
- [ ] Add nightly Cloud Scheduler job to prune preview services older than configured threshold.
- [ ] Make sure deletion cascades to Cloud Storage artifacts if required.

### Step 7: Documentation
- [ ] Update `docs/setup.md` after verifying flow (include both deployment targets).
- [ ] Provide runbook in `docs/operations/gcp-deployments.md` describing manual overrides.

## Verification
- [ ] Generate app through UI, deploy to GCP, and confirm accessible at assigned subdomain.
- [ ] Trigger Cloudflare deployment and ensure legacy path still works.
- [ ] Check `app_deployments` table contains accurate records.
- [ ] Run integration tests covering deploy/remove/status flows for both targets.

## Notes
- Keep deployment adapters thin; avoid mixing build logic with network routing.
- Consider future extension to additional targets (AWS, Azure) by following the same interface.
