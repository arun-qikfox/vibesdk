# Terraform Modules

This directory contains reusable Terraform modules for the VibSDK Google Cloud infrastructure.

Current and planned modules:
- `networking/` - VPC, subnets, and Serverless VPC Access connectors.
- `iam/` - Service accounts and project-level IAM bindings (runtime, CI, dev).
- `runtime/` - Cloud Run services, IAM bindings, Artifact Registry references.
- `sql/` - Cloud SQL instance, database, users, and secrets.
- `sandbox/` - Cloud Run Jobs, Pub/Sub topics, and supporting IAM for sandbox previews.
- `agents/` - Custom agent runtime infrastructure (post-migration task 07).

Each module should expose clear inputs and outputs and avoid hard-coding project IDs or regions; consume shared variables from `../../variables.tf`.
