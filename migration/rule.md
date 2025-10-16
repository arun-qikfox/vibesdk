# Migration Execution Rules

Use this rule file to coordinate the Google Cloud migration. An LLM or human operator should always read from here first, execute the next actionable spec, and update the status fields so progress is resumable across sessions.

## How to Run the Plan
- Always select the first step in the table marked `pending`. Only one step may be `in-progress` at a time.
- Before starting work on a step, change its status to `in-progress` and add your name/date in the `Owner` column.
- After completing a step, switch the status to `done`, log the completion date, and include a short summary in the `Notes` column (or link to a longer log).
- If work is blocked, set status to `blocked`, describe the blocker in `Notes`, and stop; do not advance to later steps.
- Keep detailed implementation notes inside each spec file (e.g., `migration/02-runtime-platform.md`) to maintain context.

## Migration Progress Tracker

| Step | File | Summary | Status | Owner | Last Update | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `migration/01-gcp-landing-zone.md` | Create project, IAM, networking, Terraform skeleton, Artifact Registry, and secret placeholders. | in-progress | Codex/user | 2025-05-31 | Project `qik-vibe` ready; Terraform skeleton + networking & IAM modules planned; Artifact Registry + Cloud Build modules planned; Secret Manager placeholders seeded (update values before go-live). |
| 2 | `migration/02-runtime-platform.md` | Build Worker bundle, package with `workerd`, publish to Artifact Registry, and deploy Cloud Run control plane. | pending | - | - | - |
| 3 | `migration/03-data-layer.md` | Map D1/KV/R2 to Cloud SQL, Firestore/Memorystore, Cloud Storage, and update adapters. | pending | - | - | - |
| 4 | `migration/04-durable-objects-and-sandbox.md` | Reproduce Durable Object state, rate limiting, and sandbox flows using Firestore, Redis, Cloud Run Jobs. | pending | - | - | - |
| 5 | `migration/05-app-deployment-multicloud.md` | Implement multi-target deployment with Cloud Run default, maintain Cloudflare path, and configure DNS/TLS. | pending | - | - | - |
| 6 | `migration/06-local-dev-and-testing.md` | Configure local dev/testing against GCP resources, add scripts, and validate end-to-end scenarios. | pending | - | - | - |
| 7 | `migration/07-custom-agent-runtime.md` | Design and integrate a first-party agent runtime replacing Cloudflare Agents, leveraging GCP services after migration is complete. | pending | - | - | - |

## Reference Summary
- The migration playbook preserves the existing architecture while introducing GCP parity. See `migration/README.md` for guardrails and branch strategy.
- Each numbered spec (`01`–`06`) contains prerequisites, implementation steps, verification, and follow-up notes designed for cursor-based development.

## Next Actions
1. Work through `migration/01-gcp-landing-zone.md` to bootstrap the Google Cloud foundation.
2. Build and deploy the Cloud Run runtime described in `migration/02-runtime-platform.md` before tackling data, Durable Object, and deployment adapters.
3. After steps 1-6 are complete, plan and deliver `migration/07-custom-agent-runtime.md` to transition from Cloudflare Agents to an in-house agent stack on GCP.

Update this rule file whenever progress changes so future runs know exactly where to resume.
