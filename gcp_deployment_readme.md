# VibSDK GCP Deployment Runbook (Version 2 – Feb 2025)

> **Version Notice:** These steps supersede the workerd-centric flow. Follow Sections 0–11 for the current combined frontend/backend deployment. The previous guide is retained at the end for context.

## 0. Prerequisites (run once per workstation)
- Install `gcloud`, `terraform` (v1.7+), `docker`, `node` 20 (or newer) with `npm`, and optionally `jq` for JSON parsing.
- Ensure your account has IAM permissions for Cloud Run, Artifact Registry, Cloud SQL, Secret Manager, Pub/Sub, and Service Account administration.
- Confirm Cloud SQL (PostgreSQL), Firestore (Datastore mode), required GCS buckets, and Gemini API access are available—this stack persists agent state in Postgres/Firestore and uses Gemini for code generation.
- (Optional) Pre-enable required APIs:
  ```bash
  gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com pubsub.googleapis.com
  ```

## 1. Install workspace dependencies in your existing repo
Run these commands from the root of the local codebase you are already developing in:
```bash
cd /path/to/vibesdk
npm ci
```
_Purpose: ensure all workspaces (frontend, backend, shared) are ready before building the container._

## 2. Declare deployment environment variables
```bash
export PROJECT_ID=qfxcloud-app-builder
export REGION=us-central1
export REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/vibesdk"
export IMAGE_NAME=control-plane
export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
export IMAGE_URI="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
```
_Purpose: centralise the Artifact Registry coordinates used in subsequent commands._

## 3. Authenticate with Google Cloud services
```bash
gcloud auth login
gcloud config set project "$PROJECT_ID"
gcloud auth configure-docker "$REGION-docker.pkg.dev"
gcloud auth application-default login   # optional: lets Terraform reuse Application Default Credentials
```
_Purpose: establish credentials for Docker pushes, Terraform, and gcloud CLI operations._

## 4. Build the Cloud Run control-plane image (frontend + backend)
```bash
docker build -f container/Dockerfile.workerd -t "$IMAGE_URI" .
```
_Purpose: produce a Node 20 image that serves the built Vite SPA and the Hono API/WebSocket server._

## 5. Push the image to Artifact Registry
```bash
docker push "$IMAGE_URI"
```
_Purpose: publish the container so Cloud Run can deploy it._

## 6. Point Terraform at the freshly built image
- macOS/Linux:
  ```bash
  sed -i.bak "s|^runtime_image.*|runtime_image        = \"$IMAGE_URI\"|" infra/gcp/terraform.tfvars
  ```
- Windows PowerShell:
  ```powershell
  (Get-Content infra/gcp/terraform.tfvars) -replace '^runtime_image.*',"runtime_image        = `"$IMAGE_URI`"" | Set-Content infra/gcp/terraform.tfvars
  ```
_Purpose: ensure the Cloud Run revision references the container you just pushed._

## 7. Provision/update infrastructure with Terraform
```bash
cd infra/gcp
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
cd ../..
```
_Purpose: create or update networking, Cloud SQL, buckets, Pub/Sub, secrets, and the Cloud Run control-plane service bound to the new image._

## 8. Seed or rotate Secret Manager values (skip if already populated)
```bash
gcloud secrets versions add JWT_SECRET --data-file=- <<<"$(openssl rand -hex 32)"
gcloud secrets versions add SECRETS_ENCRYPTION_KEY --data-file=- <<<"$(openssl rand -hex 32)"
gcloud secrets versions add WEBHOOK_SECRET --data-file=- <<<"$(openssl rand -hex 32)"
gcloud secrets versions add AI_PROXY_JWT_SECRET --data-file=- <<<"$(openssl rand -hex 32)"
gcloud secrets versions add GOOGLE_AI_STUDIO_API_KEY --data-file=- <<<"your-google-ai-key"
```
_Purpose: provide Cloud Run with the credentials expected by `runtime_secret_bindings`. On Windows, generate secrets with PowerShell (`[Guid]::NewGuid().ToString("N")`) and use `Set-Content` to upload them._

## 9. Apply database migrations to Cloud SQL
```bash
cd backend
npm install --omit=dev
npm run db:migrate
cd ..
```
_Purpose: bring the PostgreSQL schema in line with the agent runtime._

## 10. Sanity-check the deployed Cloud Run service
```bash
CONTROL_PLANE_URL=$(gcloud run services describe vibesdk-control-plane \
  --region "$REGION" --format='value(status.uri)')
curl "$CONTROL_PLANE_URL/health"
curl "$CONTROL_PLANE_URL/api/health"
```
_Purpose: confirm the service responds over HTTP(S) before connecting the frontend._

## 11. Validate the agentic flow end-to-end
1. Open `$CONTROL_PLANE_URL` in a browser (the built SPA is served by the same container).
2. Register or log in, start a generation, and monitor `/api/agent` responses (NDJSON) plus `/api/agent/<id>/ws` upgrades via browser DevTools.
3. Tail Cloud Run logs when troubleshooting:
   ```bash
   gcloud run services logs read vibesdk-control-plane --region "$REGION" --project "$PROJECT_ID"
   ```

---

## Version 1 (Archived – Original Instructions)
### GCP Deployment Guide for VibSDK ??

Based on your infrastructure code, here's the **complete step-by-step deployment process** to Google Cloud Platform:

## ?? **OVERVIEW**
This deployment uses **Terraform + Cloud Run + Cloud SQL** architecture with containerized services running in Google Cloud.

---

## ?? **PREREQUISITES**

**Required Tools:**
- `terraform` =1.7.0
- `gcloud` CLI
- `docker`
- `kubectl` (optional)
- `git`

**Required Permissions:**
- GCP Owner/Editor permissions
- Cloud SQL Admin
- Artifact Registry Admin
- Cloud Run Admin

---

## ??? **STEP 1: INFRASTRUCTURE PROVISIONING**

### **1.1 Initialize Terraform**
```bash
cd infra/gcp
# Authenticate with GCP
gcloud auth login
gcloud config set project qfxcloud-app-builder

# Initialize Terraform
terraform init
```

### **1.2 Plan Infrastructure Changes**
```bash
terraform plan -var-file=terraform.tfvars
```

### **1.3 Apply Infrastructure**
```bash
terraform apply -var-file=terraform.tfvars
```

**?? This creates:**
- VPC network with private subnets
- Cloud SQL PostgreSQL instance
- Service accounts and IAM roles
- Artifact Registry repositories
- Storage buckets for templates/apps
- Cloud Run services (control plane + sandbox)

---

## ?? **STEP 2: BUILD & PUSH CONTAINER IMAGES**

### **2.1 Build Worker Runtime Image**
```bash
# Navigate to root directory
cd ../../

# Build the Worker Runtime container
npm run build:worker
gcloud builds submit --config cloudbuild/worker-runtime.yaml \
  --substitutions=_SERVICE_NAME=vibesdk-control-plane \
  --project qfxcloud-app-builder
```

### **2.2 Build Sandbox Job Image**
```bash
# Build and push sandbox container image
gcloud builds submit --tag us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest \
  --project qfxcloud-app-builder \
  .
# (Use appropriate Dockerfile and build context)
```

---

## ?? **STEP 3: DATABASE SETUP**

### **3.1 Run Database Migrations**
```bash
# Connect to Cloud SQL
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Run migrations (from the GCP migrations)
npm run db:migrate:remote
```

### **3.2 Verify Database Connection**
```bash
# Test connection
npm run check-db
```

---

## ?? **STEP 4: CONFIGURE SECRETS & ENVIRONMENT**

### **4.1 Cloud Secret Manager**

**Required Secrets to Create:**
```bash
# JWT & Security
gcloud secrets create JWT_SECRET --data-file=- <<< "your-32-char-jwt-secret"
gcloud secrets create SECRETS_ENCRYPTION_KEY --data-file=- <<< "your-32-char-encryption-key"
gcloud secrets create WEBHOOK_SECRET --data-file=- <<< "your-webhook-secret"
gcloud secrets create AI_PROXY_JWT_SECRET --data-file=- <<< "your-ai-proxy-jwt-secret"

# Database Connection
gcloud secrets create DATABASE_URL --data-file=- <<< "postgresql://vibesdk-user:PASSWORD@YOUR_SQL_CONNECTION_NAME?sslmode=require"

# AI Services (Optional)
gcloud secrets create GOOGLE_AI_STUDIO_API_KEY --data-file=- <<< "your-google-ai-key"
```

### **4.2 Update Terraform Variables**

**Required Variables (`terraform.tfvars`):**
```hcl
# Required - Update these values
runtime_image = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:deploy-20251027-195013"
```
*(Ensure other variables match your project setup.)*

---

## ?? **STEP 5: DEPLOY TO CLOUD RUN**

### **5.1 Configure Environment Variables**
```bash
# Run from the root of the repository
export PROJECT_ID=qfxcloud-app-builder
export REGION=us-central1
export SERVICE_NAME=vibesdk-control-plane
```

### **5.2 Apply Terraform (Deployment)**
```bash
cd infra/gcp
terraform apply -var-file=terraform.tfvars
```

---

## ? **STEP 6: TESTING & VERIFICATION**

### **6.1 Health Check Endpoint**
```bash
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/health
```

### **6.2 App Handshake**
```bash
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/api/status
```

### **6.3 NDJSON Streaming Test**
```bash
curl -N https://vibesdk-control-plane-2886014379.us-central1.run.app/api/agent/test-agent-id
```

---

## ?? **STEP 7: POST-DEPLOYMENT TASKS**

### **7.1 Logging & Monitoring**
```bash
gcloud logs read --project=qfxcloud-app-builder --limit=50
```

### **7.2 Rate Limiting (Optional)**
Adjust `runtime_env` in `terraform.tfvars` to tune rate limiter settings.

### **7.3 Monitoring Dashboards**
Set up alerts and dashboards in **Cloud Monitoring** for:
- Cloud Run request latency
- Cloud SQL CPU/connection utilisation
- Pub/Sub delivery failures

---

## ??? **STEP 8: OPERATIONS CHECKLIST**
- [ ] Rotate secrets regularly
- [ ] Backup Cloud SQL on schedule
- [ ] Monitor Pub/Sub queue depth
- [ ] Review Cloud Run revisions after each deploy
- [ ] Audit IAM roles monthly

---

## ?? **STEP 9: MANUAL RUNBOOK**

### **9.1 Trigger Agent Generation (Manual Test)**
```bash
curl -X POST https://vibesdk-control-plane-2886014379.us-central1.run.app/api/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"query":"Create a sample React todo app"}'
```

### **9.2 Static Asset Verification**
```bash
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/assets/index-<hash>.js
```

### **9.3 WebSocket Connection Test**
Use browser DevTools or `wscat`:
```bash
wscat -c wss://vibesdk-control-plane-2886014379.us-central1.run.app/api/agent/<agent-id>/ws
```

---

## ?? **COMMON COMMANDS**
```bash
# View Cloud Run services
gcloud run services list --project=qfxcloud-app-builder --region=us-central1

# Tail Cloud Run logs
gcloud run services logs read vibesdk-control-plane --project=qfxcloud-app-builder --region=us-central1 --stream

# Describe Cloud SQL instance
gcloud sql instances describe vibesdk-sql --project=qfxcloud-app-builder
```

---

## ?? **FRONTEND VALIDATION**
- Deploy the frontend build to Cloud Storage bucket `vibesdk-frontend`.
- Ensure CDN or Cloud Run static serving points to the correct bucket.
- Verify environment variables in the frontend `.env` match backend endpoints.

---

## ?? **API SMOKE TESTS**
```bash
# Check authentication
curl -X POST https://vibesdk-control-plane-2886014379.us-central1.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass","name":"Test User"}'
```

---

## ?? **CRITICAL ENVIRONMENT VARIABLES (MUST BE SET)**

### **Required for Basic Operation:**
```bash
# GCP Configuration
GCP_PROJECT_ID=qfxcloud-app-builder
GCP_REGION=us-central1

# Database
DATABASE_URL=postgresql://vibesdk-user:PASSWORD@/cloudsql/INSTANCE_CONNECTION_NAME/vibesdk?sslmode=require

# Security
JWT_SECRET=32-character-random-string
SECRETS_ENCRYPTION_KEY=32-character-random-string
WEBHOOK_SECRET=random-webhook-secret
AI_PROXY_JWT_SECRET=32-character-random-string

# Runtime
RUNTIME_PROVIDER=gcp
MAX_SANDBOX_INSTANCES=10

# Storage
GCS_TEMPLATES_BUCKET=vibesdk-templates
GCS_FRONTEND_BUCKET=vibesdk-frontend
GCS_KV_BUCKET=vibesdk-frontend
FIRESTORE_PROJECT_ID=qfxcloud-app-builder
FIRESTORE_COLLECTION=vibesdk-kv
```

### **Optional for Advanced Features:**
```bash
# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_STUDIO_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...
WEBHOOK_SECRET=random-webhook-secret
```

---

## ?? **TROUBLESHOOTING**

### **Common Issues:**

**Terraform Errors:**
```bash
# Reset terraform state
rm -rf .terraform
terraform init

# Check service account permissions
gcloud iam service-accounts get-iam-policy YOUR-SA@PROJECT.iam.gserviceaccount.com
```

**Container Build Failures:**
```bash
# Check Cloud Build logs
gcloud builds list --project qfxcloud-app-builder
gcloud builds log BUILD_ID --project qfxcloud-app-builder
```

**Database Connection Issues:**
```bash
# Check Cloud SQL instance status
gcloud sql instances list --project qfxcloud-app-builder

# Test connection from Cloud Run
gcloud run exec SERVICE_NAME --region us-central1 --command "curl -f http://localhost:8080/health"
```

**Service Account Issues:**
```bash
# List service accounts
gcloud iam service-accounts list --project qfxcloud-app-builder

# Check roles
gcloud projects get-iam-policy qfxcloud-app-builder --flatten="bindings[].members" --format="table(bindings.role,bindings.members)" --filter="bindings.members:SERVICE_ACCOUNT_EMAIL"
```

---

## ?? **COST ESTIMATION**

**Monthly Cost Breakdown:**
- **Cloud Run (2 services)**: $35-70/month
- **Cloud SQL (PostgreSQL)**: $15-30/month
- **Cloud Storage**: $5-15/month
- **Secret Manager**: $1-3/month
- **Artifact Registry**: Free tier covers most usage

**Total Estimated Monthly Cost: $56-118**

**?? Production Considerations:**
- Enable Cloud SQL high availability
- Set up monitoring with Cloud Monitoring
- Configure proper backup schedules
- Implement rate limiting
- Set up proper domain certificates

---

## ?? **SECURITY NOTES**

1. **Database**: Private IP only, no public access
2. **Secrets**: All sensitive data in Secret Manager
3. **IAM**: Least privilege service accounts
4. **Networking**: Private VPC with serverless VPC access
5. **SSL/TLS**: Automatic HTTPS on Cloud Run

---

**?? Happy Deploying! Start with Step 1 and follow the sequence carefully.**
