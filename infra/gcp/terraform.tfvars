project_id = "qfxcloud-app-builder"
region     = "us-central1"

runtime_image        = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:6cc658aa9a840dc295591959109b1ef6fe27c3c2"
runtime_service_name = "vibesdk-control-plane"

templates_bucket_name     = "vibesdk-templates"
templates_bucket_location = "us-central1"

runtime_env = {
  RUNTIME_PROVIDER          = "gcp"
  GCP_PROJECT_ID            = "qfxcloud-app-builder"
  GCP_REGION                = "us-central1"
  DEFAULT_DEPLOYMENT_TARGET = "gcp-cloud-run"
  TEMPLATES_REPOSITORY      = "https://github.com/cloudflare/vibesdk-templates"
  DISPATCH_NAMESPACE        = "vibesdk-default-namespace"
  ENABLE_READ_REPLICAS      = "true"
  CLOUDFLARE_AI_GATEWAY     = "vibesdk-gateway"
  CUSTOM_DOMAIN             = "vibesdk-control-plane-2pklfi2owa-uc.a.run.app"
  MAX_SANDBOX_INSTANCES     = "10"
  SANDBOX_INSTANCE_TYPE     = "standard-3"
  USE_CLOUDFLARE_IMAGES     = "false"
  SANDBOX_TOPIC             = "vibesdk-sandbox-requests"
  FIRESTORE_PROJECT_ID      = "qfxcloud-app-builder"
  FIRESTORE_COLLECTION      = "vibesdk-kv"
  AI_GATEWAY_URL            = ""
  AI_GATEWAY_API_KEY        = ""
  GCP_ACCESS_TOKEN          = ""
}

runtime_ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"
