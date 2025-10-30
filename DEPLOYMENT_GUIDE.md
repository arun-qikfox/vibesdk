# VibeSDK Google Cloud Deployment Guide

This guide provides step-by-step instructions for deploying the VibeSDK application to Google Cloud Platform (GCP) using Terraform, following the migration rules outlined in `migration-gcp-plan/rules.md`.

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Terraform installed
- Docker installed
- Access to the `qfxcloud-app-builder` GCP project
- WSL/Linux environment (for Windows users)
- Node.js and npm installed

## Overview

The deployment process involves:
1. Setting up GCP authentication and access tokens
2. Building and pushing Docker images to Google Artifact Registry
3. Configuring environment variables across multiple files
4. Initializing platform configuration in GCS KV store
5. Deploying infrastructure using Terraform
6. Verifying the deployment

## Step 0: GCP Authentication Setup

### 0.1 Authenticate with Google Cloud
```bash
# Login to Google Cloud
gcloud auth login

# Set the project
gcloud config set project qfxcloud-app-builder

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### 0.2 Create and Configure Service Account
```bash
# Create service account for runtime
gcloud iam service-accounts create vibesdk-runtime \
  --display-name="VibeSDK Runtime Service Account" \
  --description="Service account for VibeSDK runtime operations"

# Grant necessary roles
gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

### 0.3 Generate GCP Access Token
```bash
# Generate a fresh access token (valid for 1 hour)
gcloud auth print-access-token

# For longer-lived tokens, use application default credentials
gcloud auth application-default login
```

**Important**: Copy the access token output and use it in the `GCP_ACCESS_TOKEN` environment variable in `terraform.tfvars`.

## Step 1: Build and Push Docker Image

### 1.1 Cloud Build pipeline for preview apps (reference: `cloudbuild/app-deploy.yaml`)
```bash
npm install
npm run build                           # optional, ensures dist/ exists
npm run cloudrun:context -- --src dist/app --out cloudrun-context.tar.gz
gsutil cp cloudrun-context.tar.gz gs://vibesdk-build-artifacts/cloudrun-context.tar.gz
gcloud builds submit \\
  --config cloudbuild/app-deploy.yaml \\
  --substitutions=_SERVICE_NAME=vibesdk-sandbox-preview,_LOCATION=us-central1,_REGION=us-central1,_CONTEXT_TAR=gs://vibesdk-build-artifacts/cloudrun-context.tar.gz \\
  --project qfxcloud-app-builder
gcloud run services describe vibesdk-sandbox-preview \\
  --region us-central1 \\
  --project qfxcloud-app-builder \\
  --format='value(status.url)'
curl https://<returned-url>/health
```

### 1.2 Build the Docker Image
```bash
# Navigate to project root
cd /home/arunr/projects/vibesdk

# Build the workerd runtime image
docker build -f container/Dockerfile.workerd -t us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest .
```

### 1.3 Push to Artifact Registry
```bash
# Push the image to Google Artifact Registry
docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest
```
### 1.4 Local smoke test
```bash
docker build -f templates/cloudrun-app/Dockerfile -t vibesdk-cloudrun-test .
docker run -p 8080:8080 vibesdk-cloudrun-test
curl http://localhost:8080/health
```


## Step 2: Environment Variable Configuration

Environment variables must be configured in **4 different files** for proper deployment:

### 2.1 Terraform Configuration (`infra/gcp/terraform.tfvars`)

This is the **primary source** of environment variables. Add or update variables in the `runtime_env` section:

```terraform
runtime_env = {
  # Core runtime configuration
  RUNTIME_PROVIDER          = "gcp"
  GCP_PROJECT_ID            = "qfxcloud-app-builder"
  GCP_REGION                = "us-central1"
  
  # Database configuration
  FIRESTORE_PROJECT_ID      = "qfxcloud-app-builder"
  FIRESTORE_COLLECTION      = "vibesdk-kv"
  
  # Storage configuration
  GCS_TEMPLATES_BUCKET      = "vibesdk-templates"
  GCS_FRONTEND_BUCKET       = "vibesdk-frontend"
  GCS_KV_BUCKET             = "vibesdk-frontend"
  GCS_ASSETS_PREFIX         = "frontend-assets"
  
  # Authentication
  GCP_ACCESS_TOKEN          = "your-access-token-here"
  
  # Database configuration
  DATABASE_URL              = "postgresql://user:password@host:port/database"
  
  # Domain configuration
  CUSTOM_DOMAIN             = "vibesdk-control-plane-2886014379.us-central1.run.app"
  CUSTOM_PREVIEW_DOMAIN     = "vibesdk-control-plane-2886014379.us-central1.run.app"
  
  # Other required variables...
}
```

### 2.2 Worker Configuration Types (`worker-configuration.d.ts`)

Add the environment variable to the TypeScript interface definitions:

```typescript
interface Env {
  // ... existing properties
  GCS_FRONTEND_BUCKET: string;
  GCS_KV_BUCKET: string;
  FIRESTORE_PROJECT_ID: string;
  FIRESTORE_COLLECTION: string;
  DATABASE_URL: string;
  // ... other properties
}

interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env, 
  "TEMPLATES_REPOSITORY" | 
  "ALLOWED_EMAIL" | 
  // ... other properties
  "GCS_FRONTEND_BUCKET" | 
  "GCS_KV_BUCKET" |
  "FIRESTORE_PROJECT_ID" |
  "FIRESTORE_COLLECTION" |
  "DATABASE_URL" |
  // ... other properties
>> {}
```

### 2.3 Workerd Runtime Configuration (`container/workerd/service.capnp`)

Add the environment variable binding to expose it to the worker runtime:

```capnp
bindings = [
  // ... existing bindings
  (name = "GCS_TEMPLATES_BUCKET", fromEnvironment = "GCS_TEMPLATES_BUCKET"),
  (name = "GCS_FRONTEND_BUCKET", fromEnvironment = "GCS_FRONTEND_BUCKET"),
  (name = "GCS_KV_BUCKET", fromEnvironment = "GCS_KV_BUCKET"),
  (name = "FIRESTORE_PROJECT_ID", fromEnvironment = "FIRESTORE_PROJECT_ID"),
  (name = "FIRESTORE_COLLECTION", fromEnvironment = "FIRESTORE_COLLECTION"),
  (name = "DATABASE_URL", fromEnvironment = "DATABASE_URL"),
  // ... other bindings
]
```

### 2.4 Worker Code Implementation

Use the environment variable in your worker code:

```typescript
// In worker/index.ts or other worker files
const frontendBucket = env.GCS_FRONTEND_BUCKET;
const kvBucket = env.GCS_KV_BUCKET;
```

## Step 3: Initialize Platform Configuration

### 3.1 Create Default Platform Configuration

For greenfield deployments, you need to initialize the platform configuration in the GCS KV store. Create a file called `platform_configs.json`:

```json
{
  "security": {
    "rateLimit": {
      "apiRateLimit": {
        "enabled": true,
        "store": "RATE_LIMITER",
        "bindingName": "API_RATE_LIMITER"
      },
      "authRateLimit": {
        "enabled": true,
        "store": "RATE_LIMITER",
        "bindingName": "AUTH_RATE_LIMITER"
      },
      "appCreation": {
        "enabled": true,
        "store": "DURABLE_OBJECT",
        "limit": 10,
        "dailyLimit": 50,
        "period": 3600
      },
      "llmCalls": {
        "enabled": true,
        "store": "DURABLE_OBJECT",
        "limit": 100,
        "period": 3600,
        "dailyLimit": 400,
        "excludeBYOKUsers": true
      }
    }
  },
  "globalMessaging": {
    "globalUserMessage": "",
    "changeLogs": ""
  }
}
```

### 3.2 Upload Platform Configuration to GCS

```bash
# Upload the platform configuration to the KV bucket
gcloud storage cp platform_configs.json gs://vibesdk-frontend/kv/platform_configs

# Verify the upload
gcloud storage cat gs://vibesdk-frontend/kv/platform_configs
```

**Location**: The configuration is stored at `gs://vibesdk-frontend/kv/platform_configs`

**Purpose**: This configuration provides default settings for:
- Rate limiting (API, auth, app creation, LLM calls)
- Security settings
- Global messaging configuration

## Step 4: Deploy Infrastructure with Terraform

### 4.1 Initialize Terraform
```bash
cd infra/gcp
terraform init
```

### 4.2 Apply Terraform Configuration
```bash
# Deploy the infrastructure
terraform apply -auto-approve
```

**Note**: This command may show errors about destroying services with dependencies. These can be ignored as they don't affect the Cloud Run service deployment.

### 4.3 Configure Preview DNS and TLS

Terraform provisions an HTTPS load balancer, managed certificate, and Cloud DNS zone for preview applications. After the apply completes, fetch the output to see the details:

```bash
terraform output preview_ingress
terraform output -json preview_ingress | jq
```

1. Delegate the subdomain (e.g., `ai.qikfox.com`) to Google Cloud DNS by configuring NS records at your registrar with the name servers returned in `preview_ingress.name_servers`.
2. The module pre-creates `A` records for the apex and wildcard hostnames pointing at the reserved global IP. No additional per-app DNS entries are required.
3. Wait for the managed certificate to reach the `ACTIVE` state:
   ```bash
   gcloud compute ssl-certificates describe ai-qikfox-preview-cert --global \
     --format='value(managed.status)'
   ```
4. Once active, verify TLS by hitting the preview domain root:
   ```bash
   curl -I https://ai.qikfox.com
   ```

The preview host value is supplied to the control plane via `CUSTOM_PREVIEW_DOMAIN` in `infra/gcp/terraform.tfvars`, so generated apps automatically receive URLs such as `https://<deployment-id>.ai.qikfox.com`.
If you want to test the Google-provided Cloud Run URLs first, set `enable_preview_ingress = false` and leave `CUSTOM_PREVIEW_DOMAIN` blank; you can re-enable both once you are ready to delegate DNS.

## Step 5: Configure Service Permissions

### 5.1 Allow Unauthenticated Access
```bash
# Allow public access to the Cloud Run service
gcloud run services add-iam-policy-binding vibesdk-control-plane \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker
```

### 5.2 Grant Storage Permissions
```bash
# Grant storage access to the service account
gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Grant access to the frontend bucket specifically
gcloud storage buckets add-iam-policy-binding gs://vibesdk-frontend \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## Step 6: Verify Deployment

### 6.1 Test Service Endpoints
```bash
# Test root path (should return HTML)
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/

# Test API health endpoint
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

# Test debug endpoint
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env

# Test preview domain routing (expects 404 until an app deployment exists)
curl -I https://ai.qikfox.com
```

### 6.2 Check Service Logs
```bash
# View recent logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane' \
  --limit=20 \
  --format='value(textPayload)'
```

### 6.3 Verify Environment Variables
The debug endpoint should return:
```json
{
  "runtimeProvider": "gcp",
  "gcsFrontendBucket": "vibesdk-frontend",
  "gcsTemplatesBucket": "vibesdk-templates",
  "firestoreProjectId": "qfxcloud-app-builder",
  "firestoreCollection": "vibesdk-kv",
  "customDomain": "vibesdk-control-plane-2886014379.us-central1.run.app",
  "hostname": "vibesdk-control-plane-2886014379.us-central1.run.app",
  "pathname": "/debug-env",
  "databaseUrl": "SET",
  "allEnvVars": [
    "GCS_TEMPLATES_BUCKET",
    "GCS_FRONTEND_BUCKET",
    "GCS_KV_BUCKET",
    "FIRESTORE_PROJECT_ID",
    "FIRESTORE_COLLECTION",
    "DATABASE_URL"
  ]
}
```

## Step 7: Update Service URL (if needed)

If the service URL changes, update it in `infra/gcp/terraform.tfvars`:

```terraform
runtime_env = {
  # ... other variables
  CUSTOM_DOMAIN = "new-service-url.us-central1.run.app"
  # ... other variables
}
```

Then reapply Terraform:
```bash
terraform apply -auto-approve
```

## Environment Variable Reference

### Required Environment Variables

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `RUNTIME_PROVIDER` | Runtime environment identifier | `"gcp"` |
| `GCP_PROJECT_ID` | Google Cloud project ID | `"qfxcloud-app-builder"` |
| `GCP_REGION` | Google Cloud region | `"us-central1"` |
| `FIRESTORE_PROJECT_ID` | Firestore project ID | `"qfxcloud-app-builder"` |
| `FIRESTORE_COLLECTION` | Firestore collection name | `"vibesdk-kv"` |
| `GCS_TEMPLATES_BUCKET` | Templates storage bucket | `"vibesdk-templates"` |
| `GCS_FRONTEND_BUCKET` | Frontend assets bucket | `"vibesdk-frontend"` |
| `GCS_KV_BUCKET` | KV store bucket | `"vibesdk-frontend"` |
| `CUSTOM_DOMAIN` | Primary control-plane hostname | `"vibesdk-control-plane-2886014379.us-central1.run.app"` |
| `CUSTOM_PREVIEW_DOMAIN` | Preview applications wildcard host | `"ai.qikfox.com"` |
| `DATABASE_URL` | PostgreSQL connection string | `"postgresql://user:pass@host:port/db"` |
| `GCP_ACCESS_TOKEN` | Google Cloud access token | `"ya29.a0ATi6K..."` |

### Frontend Build Variables

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `VITE_API_BASE_URL` | (Optional) Overrides the SPA API origin when the UI is served from a different domain than the Cloud Run backend. | `"https://vibesdk-sandbox-preview-2pklfi2owa-uc.a.run.app"` |
| `API_BASE_URL` | Runtime Cloud Run env for the generated app preview. Defaults to the control-plane URL so the SPA calls the correct API host. | `"https://vibesdk-control-plane-2886014379.us-central1.run.app"` |

### Adding New Environment Variables

When adding a new environment variable:

1. **Add to `terraform.tfvars`** (primary source)
2. **Add to `worker-configuration.d.ts`** (TypeScript types)
3. **Add to `service.capnp`** (workerd bindings)
4. **Use in worker code** (implementation)

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Re-run the IAM policy binding command
2. **401 Invalid Credentials**: Update `GCP_ACCESS_TOKEN` with a fresh token
3. **Environment variable not available**: Check all 4 configuration files
4. **Service not accessible**: Verify ingress is set to `INGRESS_TRAFFIC_ALL`
5. **Platform configuration not found**: Ensure `platform_configs.json` is uploaded to `gs://vibesdk-frontend/kv/platform_configs`
6. **Rate limit service failing**: Verify platform configuration is properly loaded from KV store

### Getting Fresh Access Token
```bash
# Generate a fresh access token (valid for 1 hour)
gcloud auth print-access-token

# For longer-lived tokens, use application default credentials
gcloud auth application-default login
```

### Checking Service Status
```bash
gcloud run services describe vibesdk-control-plane --region=us-central1
```

### Verifying Platform Configuration
```bash
# Check if platform configuration exists
gcloud storage ls gs://vibesdk-frontend/kv/

# View the platform configuration
gcloud storage cat gs://vibesdk-frontend/kv/platform_configs
```

## Migration Rules Reference

This deployment follows the migration rules from `migration-gcp-plan/rules.md`:

- **Step 1**: GCP Landing Zone (✅ Complete)
- **Step 2**: Runtime Platform (✅ Complete) 
- **Step 3**: Data Layer (✅ Complete)
- **Step 4**: Durable Objects and Sandbox (Pending)
- **Step 5**: App Deployment Multi-cloud (✅ Complete)
- **Step 6**: Local Dev and Testing (Pending)
- **Step 7**: Custom Agent Runtime (Pending)

## Success Criteria

The deployment is successful when:
- ✅ Root path returns HTML content (200 OK)
- ✅ API endpoints return JSON responses (200 OK)
- ✅ CORS headers are properly set
- ✅ Environment variables are correctly configured
- ✅ KV store uses Google Cloud Storage (GCS)
- ✅ CSRF validation is disabled for GCP environment
- ✅ Static assets are served from GCS bucket
- ✅ Platform configuration is loaded from KV store
- ✅ Rate limit service is working properly
- ✅ Database connection is established

## Greenfield Deployment Commands

For a complete greenfield deployment, run these commands in sequence:

```bash
# 1. Set up authentication
gcloud auth login
gcloud config set project qfxcloud-app-builder

# 2. Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com storage.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com pubsub.googleapis.com

# 3. Create service account and grant roles
gcloud iam service-accounts create vibesdk-runtime --display-name="VibeSDK Runtime Service Account"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/run.invoker"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding qfxcloud-app-builder --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/pubsub.publisher"

# 4. Get access token
export GCP_ACCESS_TOKEN=$(gcloud auth print-access-token)

# 5. Build and push Docker image
cd /home/arunr/projects/vibesdk
docker build -f container/Dockerfile.workerd -t us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest .
docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest

### Local smoke test (optional)
```bash
docker build -f templates/cloudrun-app/Dockerfile -t vibesdk-cloudrun-test .
docker run -p 8080:8080 vibesdk-cloudrun-test
curl http://localhost:8080/health
```

# 6. Create platform configuration
cat > platform_configs.json << 'EOF'
{
  "security": {
    "rateLimit": {
      "apiRateLimit": {
        "enabled": true,
        "store": "RATE_LIMITER",
        "bindingName": "API_RATE_LIMITER"
      },
      "authRateLimit": {
        "enabled": true,
        "store": "RATE_LIMITER",
        "bindingName": "AUTH_RATE_LIMITER"
      },
      "appCreation": {
        "enabled": true,
        "store": "DURABLE_OBJECT",
        "limit": 10,
        "dailyLimit": 50,
        "period": 3600
      },
      "llmCalls": {
        "enabled": true,
        "store": "DURABLE_OBJECT",
        "limit": 100,
        "period": 3600,
        "dailyLimit": 400,
        "excludeBYOKUsers": true
      }
    }
  },
  "globalMessaging": {
    "globalUserMessage": "",
    "changeLogs": ""
  }
}
EOF

# 7. Deploy infrastructure
cd infra/gcp
terraform init
terraform apply -auto-approve

# 8. Upload platform configuration
gcloud storage cp ../../platform_configs.json gs://vibesdk-frontend/kv/platform_configs

# 9. Configure service permissions
gcloud run services add-iam-policy-binding vibesdk-control-plane --region=us-central1 --member=allUsers --role=roles/run.invoker
gcloud storage buckets add-iam-policy-binding gs://vibesdk-frontend --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"

# 10. Verify deployment
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env
```

## Next Steps

After successful deployment:
1. Configure DNS and TLS (if using custom domain)
2. Set up monitoring and alerting
3. Implement CI/CD pipeline
4. Configure local development environment
5. Plan migration of remaining Cloudflare-specific features
