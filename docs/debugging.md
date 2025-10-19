# Debugging TODOs

- **Cloud Run smoke tests:** run `scripts/debug/cloud-run-smoke-tests.sh` (after starting `gcloud run services proxy`) to exercise `/`, `/api/status`, `/api/secrets`, and `/api/proxy/openai` with an identity token and confirm the GCP runtime is responding.
