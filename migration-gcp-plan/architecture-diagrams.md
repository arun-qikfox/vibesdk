# GCP-Based VibSDK Architecture (ASCII)

## Platform Overview

```
             +---------------------------+
             |   Google Cloud SDK / CI   |
             |  (gcloud, Terraform, CI)  |
             +-------------+-------------+
                           |
                           v
+--------------------+      Pub/Sub topic      +-------------------------+
| Control Plane API  | ----------------------> | Cloud Run Job           |
| (Cloud Run)        |   vibesdk-sandbox-*     | vibesdk-sandbox-job     |
+--------------------+                         +-------------------------+
        |                                               |
        | publishes sandbox state                       | pulls messages
        v                                               v
+--------------------+                         +-------------------------+
| Firestore          |<------------------------| Google Cloud Storage    |
| - sandboxRuns      |    writes status + logs | - templates & assets    |
| - agentSessions    |                         +-------------------------+
+--------------------+
        ^
        |
        | serves previews & state
        v
Control Plane Clients (UI, CLI)

Supporting services (not shown to scale):
- Artifact Registry: `us-central1-docker.pkg.dev/.../vibesdk/*`
- Secret Manager: runtime secrets for Cloud Run service and sandbox job
- VPC Connector & Cloud SQL: control plane persistence
- Deployment target registry resolves `cloudflare-workers` (active) and `gcp-cloud-run` adapters for downstream deployment orchestration, defaulting to `gcp-cloud-run` when unset. Cloud Run proxy uses `app_deployments` metadata to forward preview traffic.
```

## Durable Object Compatibility Layer

```
+--------------------+        +-------------------------+
| Control Plane API  |  uses  | AgentStore factory      |
| (Cloud Run)        |------->| (shared/platform/DO)    |
+--------------------+        +-----------+-------------+
                                         |
                                         v
+--------------------+        +-------------------------+
| Firestore          |        | Firestore Sandbox Runs  |
| agentSessions      |<-------| collection (`sandboxRuns`)|
| (session payloads) |   job  | (status, logs, preview) |
+---------+----------+ writes +-------------------------+
          |                                    ^
          |                                    |
          | rate-limit reads/writes            | sandbox job updates
          v                                    |
+--------------------+                        |
| Rate Limit Store   | (current: Durable      |
| (DO buckets ->     |  Object `DORateLimit`) |
|  future: Redis)    |                        |
+--------------------+                        |
          ^                                    |
          |                                    |
          +------------------------------------+
```

The GCP implementation replaces Durable Objects with:
- Firestore-backed session storage (`agentSessions`) using transactional writes to preserve single-writer semantics.
- Pub/Sub + Cloud Run Jobs for asynchronous sandbox operations, with results persisted to `sandboxRuns`.
- A forthcoming Memorystore/SQL-backed rate limiter to supplant `DORateLimitStore`.
