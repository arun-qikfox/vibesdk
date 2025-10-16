# Google Cloud Migration Specs

This folder contains the migration playbooks for running VibSDK on Google Cloud while keeping compatibility with the existing Cloudflare deployment path. The specs break the work into cursor-friendly chunks so you can execute, test, and verify each stage without refactoring the core architecture.

## How to Use These Specs
- Follow the files in numeric order (`01-` … `06-`).
- Each spec has: scope, prerequisites, implementation steps, verification, and suggested commit boundaries.
- Mark tasks as you finish them and leave notes for the next cursor session directly in the files.
- Only make the minimal code/config changes called out in the tasks; do not redesign existing modules.

## Sequence Overview
1. `01-gcp-landing-zone.md` – create the GCP project, IAM, networks, and baseline automation hooks.
2. `02-runtime-platform.md` – host the current Worker bundle on Google Cloud Run using the open-source `workerd` runtime.
3. `03-data-layer.md` – map D1, KV, and R2 dependencies to Cloud SQL, Firestore/Memorystore, and Cloud Storage.
4. `04-durable-objects-and-sandbox.md` – reproduce Durable Object behaviour and sandbox execution with Cloud Run + Pub/Sub.
5. `05-app-deployment-multicloud.md` – add a dual deployment pipeline so generated apps default to Cloud Run but can also target Cloudflare.
6. `06-local-dev-and-testing.md` – run the platform locally while proxying to Google Cloud resources for end-to-end testing.

## Architectural Guardrails
- Preserve the high-level flow documented in `docs/architecture-diagrams.md`.
- Keep the Hono routing shape at `worker/app.ts` and entry logic in `worker/index.ts`.
- Introduce adapters instead of editing business logic wherever Cloudflare bindings are referenced (for example, new Env provider modules).
- Prefer configuration switches over conditional imports to maintain a single code base.

## Tooling Expectations
- Terraform or Pulumi for GCP infra (Terraform modules are referenced in the specs).
- Cloud Build or GitHub Actions for CI; reuse existing workflows where possible.
- `workerd` container images published to Artifact Registry.
- Bun/Node 18+ for building the worker bundle (`npm run build:worker` will be added in later steps).

## Suggested Branch Strategy
1. `feat/gcp-landing-zone`
2. `feat/gcp-runtime`
3. `feat/gcp-data`
4. `feat/gcp-do-sandbox`
5. `feat/multicloud-deploy`
6. `feat/gcp-local-testing`

Merge each branch only after completing the verification checklist in its spec.

