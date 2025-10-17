# 01 - GCP Landing Zone

Goal: Stand up a repeatable Google Cloud foundation for VibSDK (project, IAM, networking, Artifact Registry, Secret Manager) so later specs can deploy workloads without per-step project setup.

## Outcomes
- Dedicated GCP project with billing attached.
- Service accounts and least-privilege IAM roles for CI, runtime, and local development.
- Terraform skeleton (or equivalent) committed under `infra/gcp/` for reproducibility.
- Artifact Registry repository for container images.
- Secret Manager entries that mirror critical bindings from `wrangler.jsonc`.

## Prerequisites
- Billing account with permission to link new projects.
- `gcloud` CLI authenticated locally.
- Terraform >= 1.7 installed (if you prefer Pulumi, mirror the same modules).
- Organization-level permission to create projects (or an allocated project ID).

## Implementation Steps

### Step 1: Create Project and Enable APIs
- [ ] Choose a project ID `vibesdk-gcp` (update if occupied).
- [ ] Run:
  ```
  gcloud projects create vibesdk-gcp --name="VibSDK GCP"
  gcloud beta billing projects link vibesdk-gcp --billing-account=YOUR_BILLING_ACCOUNT
  ```
- [ ] Enable core services:
  ```
  gcloud services enable compute.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com \
    firestore.googleapis.com \
    iamcredentials.googleapis.com \
    pubsub.googleapis.com
  ```
- [ ] Record the project number for later (store in `migration/.env.example` if helpful).

### Step 2: Bootstrap Terraform Skeleton
- [ ] Create `infra/gcp/main.tf`, `providers.tf`, `variables.tf`, `outputs.tf`.
- [ ] Configure backend (Cloud Storage bucket) for state or document rationale if using local state temporarily.
- [ ] Define variables for `project_id`, `region`, `service_account_names`, and network ranges.
- [ ] Commit an empty `infra/gcp/modules/README.md` with placeholders for upcoming modules (runtime, sql, networking).

### Step 3: Networking Baseline
- [ ] Add a `vpc.tf` module (either inline or referenced) that creates:
  - A custom VPC `vibesdk-vpc`.
  - Two subnets (`private` and `public`) in the target region (e.g., `us-central1`).
  - A serverless VPC connector for Cloud Run/Cloud SQL access.
- [ ] Reserve an external IP or note that HTTPS Load Balancer will manage IPs in later specs.

### Step 4: Service Accounts and IAM
- [ ] Create service accounts:
  - `vibesdk-runtime` (used by Cloud Run services).
  - `vibesdk-ci` (used by CI pipelines).
  - `vibesdk-dev` (short-lived tokens for local testing).
- [ ] Grant minimum roles:
  - Runtime: `roles/run.invoker`, `roles/secretmanager.secretAccessor`, `roles/cloudsql.client`, `roles/pubsub.publisher`, `roles/storage.objectAdmin`.
  - CI: Above plus `roles/artifactregistry.writer`, `roles/cloudbuild.builds.editor`.
  - Dev: `roles/run.invoker`, `roles/secretmanager.secretAccessor`, `roles/cloudsql.client`.
- [ ] Enable workload identity federation if you plan to avoid long-lived JSON keys (recommended).
- [ ] Store the service account emails in `infra/gcp/outputs.tf`.

### Step 5: Artifact Registry and Cloud Build Triggers
- [ ] Create an Artifact Registry repository `vibesdk` in the chosen region (`gcloud artifacts repositories create vibesdk --repository-format=docker --location=us-central1 --description="VibSDK images"`).
- [ ] Configure push roles for the CI service account.
- [ ] Set up a stub Cloud Build trigger referencing the GitHub repo (manual approval is fine for now). Leave build steps empty; they will be filled in `02-runtime-platform.md`.

### Step 6: Mirror Secrets
- [ ] List the required secrets from `wrangler.jsonc` (`GOOGLE_AI_STUDIO_API_KEY`, `JWT_SECRET`, etc.).
- [ ] Create matching placeholders in Secret Manager:
  ```
  printf "placeholder" | gcloud secrets create GOOGLE_AI_STUDIO_API_KEY --data-file=- --project=vibesdk-gcp
  ```
- [ ] Grant access to the runtime service account only.
- [ ] Document secret naming convention in `infra/gcp/README.md`.

### Step 7: Documentation and Check-In
- [ ] Document project and region choices at the top of this file (or directly in `infra/gcp/README.md`).
- [ ] Commit Terraform skeleton and notes.
- [ ] Open a draft PR (`feat/gcp-landing-zone`) capturing open questions before moving forward.

## Verification
- [ ] `gcloud projects describe vibesdk-gcp` returns the project.
- [ ] `gcloud artifacts repositories list --project=vibesdk-gcp` shows `vibesdk`.
- [ ] `gcloud secrets list --project=vibesdk-gcp` lists placeholders.
- [ ] Terraform plan runs cleanly with no resources pending (after initial apply).

## Suggested Next Steps
- Tackle `02-runtime-platform.md` once the landing zone is stable.
- Keep Terraform state clean; future specs will extend the same configuration.

