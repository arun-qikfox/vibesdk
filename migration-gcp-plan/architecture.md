# VibSDK GCP Runtime Architecture

This document describes how the VibSDK control plane runs on Google Cloud Platform and how each managed service fits into the sandbox execution flow.

## High-Level Overview

```
+--------------------+      Pub/Sub topic      +-------------------------+
| Control Plane API  | ----------------------> | Cloud Run Job           |
| (Cloud Run)        |   vibesdk-sandbox-*     | vibesdk-sandbox-job     |
+--------------------+                         +-------------------------+
        |                                               |
        |                                   reads templates / emits logs
        v                                               v
+--------------------+                         +-------------------------+
| Firestore          |<------------------------| Google Cloud Storage    |
| (agentSessions,    |    run state + status   | (templates & assets)    |
|  sandboxRuns)      |                         +-------------------------+
+--------------------+
        |
        v
Control Plane Clients (UI, CLI)
```

### Components

| Service | Purpose |
|---------|---------|
| **Google Cloud Run (control plane)** | Hosts the main VibSDK API (`vibesdk-control-plane`). Handles user requests, orchestrates sandbox sessions, and exposes `/api/agent/*` routes. |
| **Google Pub/Sub** | Topic `vibesdk-sandbox-requests` queues sandbox execution actions (create instance, run commands, etc.). |
| **Cloud Run Job `vibesdk-sandbox-job`** | Stateless worker that dequeues Pub/Sub messages, executes sandbox tasks in the GCP environment, and records status/results. |
| **Firestore (Native mode)** | Stores sandbox run status in `sandboxRuns` and Durable Object session state in `agentSessions` via the shared AgentStore. The control plane reads from both collections during request handling. |
| **Google Cloud Storage `vibesdk-templates`** | Hosts template bundles and shared assets used by both the control plane and the sandbox job. |
| **Secret Manager** | Provides database credentials and API tokens consumed by the control plane and the job. |
| **VPC & Cloud SQL** | Support services (SQL database, connectors) used by the control plane; provided by Terraform but not directly touched by the sandbox job. |

## Execution Flow

1. **User triggers sandbox work** via the control plane (`POST /api/agent`). The API publishes a message to the Pub/Sub topic.
2. **Cloud Run Job execution** (`vibesdk-sandbox-job`) is executed manually or via scheduler/Eventarc. The job:
   - Pulls a message from the subscription.
   - Marks the corresponding document in Firestore (`sandboxRuns/{sessionId}`) as `running` and updates session metadata in `agentSessions/{sessionId}` through the AgentStore when applicable.
   - Performs sandbox work (stubbed for now) and writes the final status to Firestore.
   - Acknowledges the Pub/Sub message.
3. **Control plane reads status** on subsequent API calls (e.g., `/api/agent/:id/preview`). When Firestore reports `succeeded`, the UI can display the preview details.

## Infrastructure Provisioning (Terraform)

All infrastructure is managed by `infra/gcp`:

* `modules/sandbox` provisions:
  - Pub/Sub topic `vibesdk-sandbox-requests`
  - Subscription `vibesdk-sandbox-requests-subscription`
  - Cloud Run job `vibesdk-sandbox-job` pointing at `us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest`
* `modules/runtime` provisions the control plane Cloud Run service.
* `modules/storage`, `modules/sql`, `modules/iam`, etc., create supporting services.

`terraform.tfvars` holds environment-specific values (project, region, image URI, env vars, etc.).

## Deployment Pipeline

1. Build sandbox job image (`docker build --no-cache ...`).
2. Push to Artifact Registry.
3. Run `terraform apply` so the job references the new digest.
4. Publish a test message and execute the job.
5. Verify Firestore (`sandboxRuns/{sessionId}`) and Cloud Run logs.

## Notes & Future Enhancements

* Replace the remaining Cloudflare-specific imports in shared modules with GCP-friendly adapters so the job no longer needs stubs.
* Multi-cloud deployment uses a target registry (`cloudflare-workers`, `gcp-cloud-run`) backed by `shared/platform/deployment`. Cloudflare deploys are routed through the new interface; the registry now defaults to the GCP stub until the Cloud Run build pipeline lands.
* Cloud Run metadata is persisted in the new `app_deployments` table via `DeploymentService`, and the Worker proxies GCP preview traffic directly to the recorded service URL with helpful status messaging.
* Add Cloud Scheduler/Eventarc trigger so the job runs automatically when Pub/Sub messages arrive.
* Implement real sandbox orchestration (instead of the stub that marks runs as succeeded).
* Harden authentication/authorization between control plane and job (use dedicated service accounts and principle-of-least-privilege IAM bindings).
* Add monitoring dashboards and alerts in Cloud Monitoring once the runtime is stable.
