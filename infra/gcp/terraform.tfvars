project_id = "qfxcloud-app-builder"
region     = "us-central1"

runtime_image        = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/vibesdk-control-plane:20251023-113415"
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
  SANDBOX_SUBSCRIPTION      = "vibesdk-sandbox-requests-subscription"
  SANDBOX_RUN_COLLECTION    = "sandboxRuns"   # optional, defaults to sandboxRuns if omitted
  GCS_TEMPLATES_BUCKET      = "vibesdk-templates"
  GCS_ASSETS_PREFIX         = "frontend-assets"
  FIRESTORE_PROJECT_ID      = "qfxcloud-app-builder"
  FIRESTORE_COLLECTION      = "vibesdk-kv"
  AI_GATEWAY_URL            = ""
  AI_GATEWAY_API_KEY        = ""
  GCP_ACCESS_TOKEN          = ""
}

runtime_ingress = "INGRESS_TRAFFIC_ALL"
runtime_vpc_egress = "PRIVATE_RANGES_ONLY"

sandbox_job_name            = "vibesdk-sandbox-job"
sandbox_pubsub_topic        = "vibesdk-sandbox-requests"
sandbox_job_service_account = "vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com"
sandbox_job_max_retries     = 1
sandbox_job_timeout         = "1800s"
sandbox_job_image           = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest"
sandbox_job_env = {
  RUNTIME_PROVIDER       = "gcp"
  GCP_PROJECT_ID         = "qfxcloud-app-builder"
  GCP_REGION             = "us-central1"
  SANDBOX_TOPIC          = "vibesdk-sandbox-requests"
  SANDBOX_SUBSCRIPTION   = "vibesdk-sandbox-requests-subscription"
  SANDBOX_RUN_COLLECTION = "sandboxRuns"
  GCS_TEMPLATES_BUCKET   = "vibesdk-templates"
}
