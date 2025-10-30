project_id             = "qfxcloud-app-builder"
region                 = "us-central1"
preview_domain         = "ai.qikfox.com"
preview_dns_zone_name  = "ai-qikfox-preview"
enable_preview_ingress = false

runtime_image        = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:deploy-20251027-195013"
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
  CUSTOM_DOMAIN             = "vibesdk-control-plane-2886014379.us-central1.run.app"
  CUSTOM_PREVIEW_DOMAIN     = ""
  MAX_SANDBOX_INSTANCES     = "10"
  SANDBOX_INSTANCE_TYPE     = "standard-3"
  USE_CLOUDFLARE_IMAGES     = "false"
  SANDBOX_TOPIC             = "vibesdk-sandbox-requests"
  SANDBOX_SUBSCRIPTION      = "vibesdk-sandbox-requests-subscription"
  SANDBOX_RUN_COLLECTION    = "sandboxRuns" # optional, defaults to sandboxRuns if omitted
  GCS_TEMPLATES_BUCKET      = "vibesdk-templates"
  GCS_FRONTEND_BUCKET       = "vibesdk-frontend"
  GCS_KV_BUCKET             = "vibesdk-frontend"
  FIRESTORE_PROJECT_ID      = "qfxcloud-app-builder"
  FIRESTORE_COLLECTION      = "vibesdk-kv"
  AI_GATEWAY_URL            = ""
  AI_GATEWAY_API_KEY        = ""
}

runtime_ingress = "INGRESS_TRAFFIC_ALL"

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
