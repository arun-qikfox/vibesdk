# GCP Sandbox Runtime Runbook

This document captures the end-to-end steps to build, publish, and execute the sandbox Cloud Run job in the `qfxcloud-app-builder` project. Follow it from top to bottom to provision or re-provision the runtime from scratch.

---

## 1. Environment setup

```bash
export PROJECT_ID="qfxcloud-app-builder"
export REGION="us-central1"
export ARTIFACT_REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/vibesdk"
```

Authenticate locally (replace email with your own account if needed):

```bash
gcloud auth login
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

> **Tip:** Ensure you are _not_ impersonating another service account unless absolutely required. If you previously enabled impersonation, disable it with `gcloud config unset auth/impersonate_service_account`.

---

## 2. Build & push the sandbox job image

```bash
cd /home/arunr/projects/vibesdk
docker build -f SandboxDockerfile -t sandbox-job:latest .
docker tag sandbox-job:latest "${ARTIFACT_REPO}/sandbox-job:latest"
docker push "${ARTIFACT_REPO}/sandbox-job:latest"
```

---

## 3. Terraform configuration

Update `infra/gcp/terraform.tfvars` if needed. Key variables:

```hcl
sandbox_job_image = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job:latest"
sandbox_job_env = {
  RUNTIME_PROVIDER       = "gcp"
  GCP_PROJECT_ID         = "qfxcloud-app-builder"
  GCP_REGION             = "us-central1"
  SANDBOX_TOPIC          = "vibesdk-sandbox-requests"
  SANDBOX_SUBSCRIPTION   = "vibesdk-sandbox-requests-sub"
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

## 4. Publish a sandbox request

```bash
gcloud pubsub topics publish vibesdk-sandbox-requests \
  --message='{"sessionId":"test-session","agentId":"agent-123","templateName":"react-starter","projectName":"demo-app","action":"createInstance","params":{"webhookUrl":"","localEnvVars":{}},"issuedAt":"'"$(date -Iseconds)"'"}' \
  --project "${PROJECT_ID}"
```

---

## 5. Execute the Cloud Run job manually

```bash
gcloud run jobs execute vibesdk-sandbox-job \
  --region "${REGION}" \
  --project "${PROJECT_ID}"
```

> If you encounter `PERMISSION_DENIED` mentioning `run.executions.get`, ensure impersonation is disabled (see step 1) and your account has `Cloud Run Admin` role or equivalent.

---

## 6. Verify Firestore output

```bash
gcloud firestore documents describe sandboxRuns/test-session \
  --project "${PROJECT_ID}"
```

Expect the document to contain `status: succeeded` (or `failed` if errors occurred), along with any logs/output written by the job.

---

## 7. Worker verification

Call the relevant worker endpoint (e.g., `/api/agent/<id>/preview`) and confirm the GCP sandbox service reflects the Firestore state.

---

## 8. Operational notes

- For repeated manual tests, re-run steps 4–6.
- When you update the sandbox job implementation, rebuild + push the image (step 2) and run `terraform apply` again so Cloud Run pulls the new revision.
- To automate execution, set up a Cloud Scheduler or Eventarc trigger that invokes the job when Pub/Sub messages arrive.

