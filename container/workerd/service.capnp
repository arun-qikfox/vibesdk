@0xdea1b8b7113b7f1c;

using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "vibesdk-control-plane",
     worker = (
       modules = [
         (name = "index.mjs", esModule = embed "../dist/worker-bundle/index.js"),
         (name = "cloudflare:email", esModule = embed "./stubs/email.js"),
         (name = "cloudflare-internal:email", esModule = embed "./stubs/email-internal.js")
       ],
       compatibilityDate = "2025-10-11",
       compatibilityFlags = ["nodejs_compat"],
       bindings = [
         (name = "RUNTIME_PROVIDER", fromEnvironment = "RUNTIME_PROVIDER"),
         (name = "GCP_PROJECT_ID", fromEnvironment = "GCP_PROJECT_ID"),
         (name = "GCP_REGION", fromEnvironment = "GCP_REGION"),
         (name = "DEFAULT_DEPLOYMENT_TARGET", fromEnvironment = "DEFAULT_DEPLOYMENT_TARGET"),
         (name = "TEMPLATES_REPOSITORY", fromEnvironment = "TEMPLATES_REPOSITORY"),
         (name = "DISPATCH_NAMESPACE", fromEnvironment = "DISPATCH_NAMESPACE"),
         (name = "ENABLE_READ_REPLICAS", fromEnvironment = "ENABLE_READ_REPLICAS"),
         (name = "CLOUDFLARE_AI_GATEWAY", fromEnvironment = "CLOUDFLARE_AI_GATEWAY"),
         (name = "CUSTOM_DOMAIN", fromEnvironment = "CUSTOM_DOMAIN"),
         (name = "MAX_SANDBOX_INSTANCES", fromEnvironment = "MAX_SANDBOX_INSTANCES"),
         (name = "SANDBOX_INSTANCE_TYPE", fromEnvironment = "SANDBOX_INSTANCE_TYPE"),
         (name = "USE_CLOUDFLARE_IMAGES", fromEnvironment = "USE_CLOUDFLARE_IMAGES"),
         (name = "SANDBOX_TOPIC", fromEnvironment = "SANDBOX_TOPIC"),
         (name = "GCS_TEMPLATES_BUCKET", fromEnvironment = "GCS_TEMPLATES_BUCKET"),
         (name = "GCS_FRONTEND_BUCKET", fromEnvironment = "GCS_FRONTEND_BUCKET"),
         (name = "FIRESTORE_PROJECT_ID", fromEnvironment = "FIRESTORE_PROJECT_ID"),
         (name = "AI_GATEWAY_URL", fromEnvironment = "AI_GATEWAY_URL"),
         (name = "AI_GATEWAY_API_KEY", fromEnvironment = "AI_GATEWAY_API_KEY"),
         (name = "JWT_SECRET", fromEnvironment = "JWT_SECRET"),
         (name = "SECRETS_ENCRYPTION_KEY", fromEnvironment = "SECRETS_ENCRYPTION_KEY"),
         (name = "WEBHOOK_SECRET", fromEnvironment = "WEBHOOK_SECRET"),
         (name = "AI_PROXY_JWT_SECRET", fromEnvironment = "AI_PROXY_JWT_SECRET"),
         (name = "GOOGLE_AI_STUDIO_API_KEY", fromEnvironment = "GOOGLE_AI_STUDIO_API_KEY"),
         (name = "GCP_ACCESS_TOKEN", fromEnvironment = "GCP_ACCESS_TOKEN")
       ]
     )
    )
  ],
  sockets = [
    (name = "http",
     address = "*:8080",
     http = (),
     service = "vibesdk-control-plane")
  ]
);
