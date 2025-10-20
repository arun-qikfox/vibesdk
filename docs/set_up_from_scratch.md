# VibSDK GCP Sandbox Runtime – Full Setup Runbook

This document walks you from a fresh checkout to a working GCP sandbox job that reads Pub/Sub messages and writes status records to Firestore.

> **Project Assumptions**
>
> - GCP project: `qfxcloud-app-builder`
> - Region: `us-central1`
> - Artifact Registry repo: `us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk`
> - Terraform state already stored in `gs://qfxcloud-tf-state/landing-zone`

---

## 0. Clone the repo (fresh checkout)

```bash
cd /home/arunr/projects
git clone git@github.com:cloudflare/vibesdk.git
cd vibesdk
git checkout <your-branch>
```

---

## 1. Install dependencies & compile the sandbox job

```bash
cd /home/arunr/projects/vibesdk
npm install
npm install --save-dev tsx @types/node

npx tsc sandbox-job/index.ts \
  --outDir sandbox-job/dist \
  --module commonjs \
  --target ES2022
```

---

## 2. Build the Cloud Run job image

Create `sandbox-job/Dockerfile` (once):

```Dockerfile
# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY sandbox-job ./sandbox-job
COPY shared ./shared

RUN npx tsc sandbox-job/index.ts --outDir sandbox-job/dist --module commonjs --target ES2022

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/sandbox-job/dist ./sandbox-job/dist
COPY shared ./shared

ENV NODE_ENV=production

ENTRYPOINT ["node", "sandbox-job/dist/index.js"]
```

Build & push:

```bash
docker build -f sandbox-job/Dockerfile -t sandbox-job-runner:latest .
docker tag sandbox-job-runner:latest us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest
docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest
```

---

## 3. Configure Terraform

Edit `infra/gcp/terraform.tfvars`:

```hcl
sandbox_job_image = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest"

sandbox_job_env = {
  RUNTIME_PROVIDER       = "gcp"
  GCP_PROJECT_ID         = "qfxcloud-app-builder"
  GCP_REGION             = "us-central1"
  SANDBOX_TOPIC          = "vibesdk-sandbox-requests"
  SANDBOX_SUBSCRIPTION   = "vibesdk-sandbox-requests-subscription"
  SANDBOX_RUN_COLLECTION = "sandboxRuns"
  GCS_TEMPLATES_BUCKET   = "vibesdk-templates"
}
```

Apply Terraform:

```bash
cd infra/gcp
terraform init
terraform apply
```

---

## 4. Test the pipeline

Publish a sandbox request:

```bash
gcloud pubsub topics publish vibesdk-sandbox-requests \
  --message='{"sessionId":"test-session","agentId":"agent-123","templateName":"react-starter","projectName":"demo-app","action":"createInstance","params":{"webhookUrl":"","localEnvVars":{}},"issuedAt":"'"$(date -Iseconds)"'"}' \
  --project qfxcloud-app-builder
```

Execute the job:

```bash
gcloud run jobs execute vibesdk-sandbox-job \
  --region us-central1 \
  --project qfxcloud-app-builder
```

Inspect Firestore:

```bash
ACCESS_TOKEN="$(gcloud auth print-access-token)"
curl -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://firestore.googleapis.com/v1/projects/qfxcloud-app-builder/databases/(default)/documents/sandboxRuns/test-session"
```

You should see `status`, `message`, and `output` fields from the job run.

---

## 5. Worker verification

- Call the worker endpoint (`/api/agent/:agentId/preview`) to confirm it reads Firestore correctly.
- Tail job logs if needed:

```bash
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="vibesdk-sandbox-job"' \
  --project qfxcloud-app-builder \
  --limit 20 --format=json
```

---

## 6. Operational tips

- Rebuild & push the image whenever `sandbox-job/index.ts` changes.
- Reapply Terraform after updating the image tag or environment variables.
- Ensure your user has `roles/datastore.user` (or stronger) to read documents via API.
- To automate execution, schedule the job with Cloud Scheduler or Eventarc once it is fully functional.

