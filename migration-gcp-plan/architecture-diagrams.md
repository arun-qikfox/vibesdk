# GCP-Based VibSDK Architecture (ASCII)

```
                                    ┌────────────────────────────────────────┐
                                    │            Google Cloud SDK            │
                                    │  (Developers / Ops via gcloud / Terraform)  │
                                    └────────────────────────────────────────┘
                                                   │
                                                   │ terraform apply / kubectl
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  Google Cloud Platform (Project: qfxcloud-app-builder, Region: us-central1)    │
│                                                                                │
│  ┌──────────────────────────────┐      ┌──────────────────────────┐            │
│  │ Artifact Registry            │      │ Secret Manager           │            │
│  │  vibesdk / sandbox-job-runner│      │ (API keys, DB creds)     │            │
│  └──────────────┬───────────────┘      └───────────────┬──────────┘            │
│                 │                                     │                        │
│                 │  image pulls                        │ secrets/creds          │
│                 ▼                                     ▼                        │
│  ┌──────────────────────────────┐      ┌──────────────────────────┐            │
│  │ Cloud Run (Service)          │      │ Cloud Run (Job)          │            │
│  │ vibesdk-control-plane        │      │ vibesdk-sandbox-job      │            │
│  │ - hosts REST API (/api/…)    │      │ - pulls Pub/Sub messages │            │
│  │ - publishes sandbox jobs     │      │ - runs sandbox tasks     │            │
│  └──────────────┬───────────────┘      └───────┬───────────▲──────┘            │
│                 │ Publish requests             │           │ tasks             │
│                 ▼                              │           │                   │
│  ┌──────────────────────────────┐      ┌───────▼───────────┴───────┐           │
│  │ Pub/Sub Topic                │      │ Pub/Sub Subscription      │           │
│  │ vibesdk-sandbox-requests     │─────▶│ vibesdk-sandbox-requests- │           │
│  └──────────────────────────────┘      │ subscription               │           │
│                                        └────────────────────────────┘           │
│                                                   │ acknowledge                │
│                                                   ▼                            │
│                                        ┌──────────────────────────┐            │
│                                        │ Firestore (Native mode)  │            │
│                                        │ Collection: sandboxRuns  │            │
│                                        │ - job writes status/logs │            │
│                                        │ - control plane reads    │            │
│                                        └──────────────────────────┘            │
│                                                   │                            │
│                                                   ▼                            │
│                                        ┌──────────────────────────┐            │
│                                        │ Google Cloud Storage     │            │
│                                        │ Bucket: vibesdk-templates │           │
│                                        │ - templates/assets       │            │
│                                        └──────────────────────────┘            │
│                                                                                │
│  Other resources:                                                              │
│    - Cloud SQL (managed via Terraform; used by control plane)                  │
│    - VPC networking, VPC Access connector                                     │
│    - IAM service accounts (runtime, job, CI)                                   │
│    - Cloud Build triggers (optional)                                           │
└────────────────────────────────────────────────────────────────────────────────┘

```

### Key:

- **Control plane** publishes sandbox actions to Pub/Sub.
- **Sandbox job** consumes messages, executes workloads, and writes results to Firestore (and optionally GCS).
- **Firestore** persists job status for the control plane and UI to present back to users.
- **Artifact Registry** hosts the job’s container image, built locally and pushed via Docker.

Use this diagram alongside `docs/architecture-diagrams.md` to compare the original Cloudflare-based deployment with the GCP implementation.
