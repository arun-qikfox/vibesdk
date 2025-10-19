#!/usr/bin/env bash

set -euo pipefail

SERVICE="${SERVICE:-vibesdk-control-plane}"
PROJECT="${PROJECT:-qfxcloud-app-builder}"
REGION="${REGION:-us-central1}"
PROXY_PORT="${PROXY_PORT:-8080}"

# Resolve the service host if HOST is not provided.
if [[ -z "${HOST:-}" ]]; then
  HOST="$(gcloud run services describe "${SERVICE}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --format='value(status.url)')"
  HOST="${HOST#https://}"
fi

echo "🔍 Cloud Run smoke test"
echo "  Project : ${PROJECT}"
echo "  Service : ${SERVICE}"
echo "  Region  : ${REGION}"
echo "  Host    : ${HOST}"
echo "  Proxy   : http://127.0.0.1:${PROXY_PORT}"
echo
echo "Make sure 'gcloud run services proxy ${SERVICE} --project=${PROJECT} --region=${REGION} --port=${PROXY_PORT}' is running in another terminal."
echo

TOKEN="$(gcloud auth print-identity-token)"
if [[ -z "${TOKEN}" ]]; then
  echo "❌ Failed to retrieve an identity token. Run 'gcloud auth login' and try again." >&2
  exit 1
fi

if [[ "$#" -gt 0 ]]; then
  mapfile -t ENDPOINTS < <(printf '%s\n' "$@")
else
  ENDPOINTS=(/ /api/status /api/secrets /api/proxy/openai)
fi

for path in "${ENDPOINTS[@]}"; do
  echo ">>> GET ${path}"
  set +e
  curl -sS -D - \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Host: ${HOST}" \
    "http://127.0.0.1:${PROXY_PORT}${path}"
  STATUS=$?
  set -e
  echo
  echo
  if [[ ${STATUS} -ne 0 ]]; then
    echo "⚠️  Request to ${path} exited with status ${STATUS}" >&2
  fi
done

echo "✅ Finished Cloud Run smoke test"
