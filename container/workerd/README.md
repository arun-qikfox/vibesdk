# Workerd Runtime Configuration

This directory contains the assets required to run the VibSDK worker bundle
inside Cloudflare's open-source `workerd` runtime. The configuration is split
into:

- `service.capnp` – the Cap'n Proto definition that maps the worker bundle and
  bindings to a Cloud Run–friendly service.
- `stubs/` – placeholder implementations that satisfy the Cloudflare-specific
  bindings (KV, R2, D1, Durable Objects, etc.) until native GCP adapters are
  implemented.

## Updating the Bundle Reference

`service.capnp` embeds `../../dist/worker-bundle/index.js`. Run
`npm run build:worker` before building the container image so the latest bundle
is available at that path.

## Replacing Stubs with Real Implementations

Each stub exports the minimum surface area required by the existing worker code
and throws a descriptive error. When the corresponding GCP service is ready:

1. Implement the adapter alongside the runtime code (e.g., Firestore-backed KV).
2. Duplicate or replace the stub module with a real implementation.
3. Update the binding in `service.capnp` to point at the new module or a native
   workerd binding if one exists.

## Environment Variables

The Cap'n Proto configuration reads runtime configuration from environment
variables (e.g., `RUNTIME_PROVIDER`, `DATABASE_URL`, `JWT_SECRET`). When
deploying to Cloud Run, set these variables via Terraform or the console so the
worker code can detect the GCP provider and reach managed services.
