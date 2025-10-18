@0xdea1b8b7113b7f1c;

using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "vibesdk-control-plane",
     worker = (
       compatibilityDate = "2025-08-10",
       compatibilityFlags = ["nodejs_compat"],
       mainModule = "main",
       modules = [
         (name = "main", esModule = embed "../dist/worker-bundle/index.js"),
         (name = "kvStub", esModule = embed "./stubs/kv.js"),
         (name = "d1Stub", esModule = embed "./stubs/d1.js"),
         (name = "r2Stub", esModule = embed "./stubs/r2.js"),
         (name = "aiStub", esModule = embed "./stubs/ai.js"),
         (name = "dispatchStub", esModule = embed "./stubs/dispatch.js"),
         (name = "durableObjectStub", esModule = embed "./stubs/durable-object.js"),
         (name = "rateLimitStub", esModule = embed "./stubs/rate-limit.js"),
         (name = "assetsStub", esModule = embed "./stubs/assets.js"),
         (name = "versionMetadataStub", esModule = embed "./stubs/version-metadata.js")
       ],
       bindings = [
         (name = "VibecoderStore", module = "kvStub"),
         (name = "DB", module = "d1Stub"),
         (name = "TEMPLATES_BUCKET", module = "r2Stub"),
         (name = "AI", module = "aiStub"),
         (name = "DISPATCHER", module = "dispatchStub"),
         (name = "CodeGenObject", module = "durableObjectStub"),
         (name = "Sandbox", module = "durableObjectStub"),
         (name = "DORateLimitStore", module = "durableObjectStub"),
         (name = "API_RATE_LIMITER", module = "rateLimitStub"),
         (name = "AUTH_RATE_LIMITER", module = "rateLimitStub"),
         (name = "ASSETS", module = "assetsStub"),
         (name = "CF_VERSION_METADATA", module = "versionMetadataStub"),

         # Environment variables surfaced as bindings.
         (name = "RUNTIME_PROVIDER", envVar = "RUNTIME_PROVIDER"),
         (name = "GCP_PROJECT_ID", envVar = "GCP_PROJECT_ID"),
         (name = "GCP_REGION", envVar = "GCP_REGION"),
         (name = "DEFAULT_DEPLOYMENT_TARGET", envVar = "DEFAULT_DEPLOYMENT_TARGET"),
         (name = "DATABASE_URL", envVar = "DATABASE_URL"),
         (name = "JWT_SECRET", envVar = "JWT_SECRET"),
         (name = "SECRETS_ENCRYPTION_KEY", envVar = "SECRETS_ENCRYPTION_KEY"),
         (name = "WEBHOOK_SECRET", envVar = "WEBHOOK_SECRET"),
         (name = "AI_PROXY_JWT_SECRET", envVar = "AI_PROXY_JWT_SECRET"),
         (name = "TEMPLATES_REPOSITORY", envVar = "TEMPLATES_REPOSITORY"),
         (name = "CLOUDFLARE_AI_GATEWAY", envVar = "CLOUDFLARE_AI_GATEWAY"),
         (name = "CUSTOM_DOMAIN", envVar = "CUSTOM_DOMAIN"),
         (name = "MAX_SANDBOX_INSTANCES", envVar = "MAX_SANDBOX_INSTANCES"),
         (name = "SANDBOX_INSTANCE_TYPE", envVar = "SANDBOX_INSTANCE_TYPE"),
         (name = "USE_CLOUDFLARE_IMAGES", envVar = "USE_CLOUDFLARE_IMAGES"),
         (name = "SANDBOX_TOPIC", envVar = "SANDBOX_TOPIC"),
         (name = "FIRESTORE_PROJECT_ID", envVar = "FIRESTORE_PROJECT_ID"),
         (name = "GCS_TEMPLATES_BUCKET", envVar = "GCS_TEMPLATES_BUCKET"),
         (name = "AI_GATEWAY_URL", envVar = "AI_GATEWAY_URL"),
         (name = "AI_GATEWAY_API_KEY", envVar = "AI_GATEWAY_API_KEY")
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
