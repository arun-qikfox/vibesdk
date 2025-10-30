#!/usr/bin/env bash
set -euo pipefail

# Deploy the current build to Cloud Run using Cloud Build, without custom DNS.
# Usage: ./scripts/deploy-cloudrun.sh [service-name] [region] [api-base-url]

SERVICE_NAME="${1:-vibesdk-sandbox-preview}"
REGION="${2:-us-central1}"
LOCATION="${REGION}"
CONTEXT_ARCHIVE="cloudrun-context.tar.gz"
BUILD_BUCKET="gs://vibesdk-build-artifacts/${CONTEXT_ARCHIVE}"
IMAGE_TAG=$(date +%Y%m%d%H%M%S)
DEFAULT_CONTROL_PLANE_URL="https://vibesdk-control-plane-2886014379.us-central1.run.app"
API_BASE_URL_VALUE="${3:-${API_BASE_URL:-${CONTROL_PLANE_API_BASE_URL:-${VITE_API_BASE_URL:-${DEFAULT_CONTROL_PLANE_URL}}}}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

export API_BASE_URL="${API_BASE_URL_VALUE}"
if [[ -z "${VITE_API_BASE_URL:-}" ]]; then
  export VITE_API_BASE_URL="${API_BASE_URL_VALUE}"
fi

echo "[1/5] Installing dependencies and building worker bundle"
npm install
npm run build

echo "[2/5] Generating Cloud Run build context"
APP_SOURCE="dist/client"
if [[ ! -d "${APP_SOURCE}" ]]; then
  echo "[warn] ${APP_SOURCE} not found, falling back to dist/vibesdk_production" >&2
  APP_SOURCE="dist/vibesdk_production"
fi

npm run cloudrun:context -- --src "${APP_SOURCE}" --out "${CONTEXT_ARCHIVE}"

echo "[3/5] Uploading build context to ${BUILD_BUCKET}"
gsutil cp "${CONTEXT_ARCHIVE}" "${BUILD_BUCKET}"

echo "[4/5] Triggering Cloud Build"
SUBSTITUTIONS="_SERVICE_NAME=${SERVICE_NAME},_REGION=${REGION},_LOCATION=${LOCATION},_CONTEXT_TAR=${BUILD_BUCKET},_TAG=${IMAGE_TAG}"

if [[ -n "${API_BASE_URL_VALUE}" ]]; then
    SUBSTITUTIONS="${SUBSTITUTIONS},_API_BASE_URL=${API_BASE_URL_VALUE}"
fi

gcloud builds submit \
  --config cloudbuild/app-deploy.yaml \
  --substitutions="${SUBSTITUTIONS}" \
  --project qfxcloud-app-builder

echo "[5/5] Fetching Cloud Run URL"
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project qfxcloud-app-builder \
  --format='value(status.url)')

echo "Deployment complete. Service available at: ${SERVICE_URL}"
