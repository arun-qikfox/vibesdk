# GCP Deployment Guide for VibSDK 🔥

Based on your infrastructure code, here's the **complete step-by-step deployment process** to Google Cloud Platform:

## 🔥 **OVERVIEW**
This deployment uses **Terraform + Cloud Run + Cloud SQL** architecture with containerized services running in Google Cloud.

---

## 📋 **PREREQUISITES**

**Required Tools:**
- `terraform` ≥1.7.0
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

## 🏗️ **STEP 1: INFRASTRUCTURE PROVISIONING**

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

**⚠️ This creates:**
- VPC network with private subnets
- Cloud SQL PostgreSQL instance
- Service accounts and IAM roles
- Artifact Registry repositories
- Storage buckets for templates/apps
- Cloud Run services (control plane + sandbox)

---

## 🐳 **STEP 2: BUILD & PUSH CONTAINER IMAGES**

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

## 🗄️ **STEP 3: DATABASE SETUP**

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

## 🚀 **STEP 4: CONFIGURE SECRETS & ENVIRONMENT**

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
sandbox_job_image = "us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/sandbox-job-runner:latest"

# Environment Variables
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
  SANDBOX_RUN_COLLECTION    = "sandboxRuns"
  GCS_TEMPLATES_BUCKET      = "vibesdk-templates"
  GCS_FRONTEND_BUCKET       = "vibesdk-frontend"
  GCS_KV_BUCKET             = "vibesdk-frontend"
  FIRESTORE_PROJECT_ID      = "qfxcloud-app-builder"
  FIRESTORE_COLLECTION      = "vibesdk-kv"
}

# Database Configuration
sql_user_name = "vibesdk_user"  # Update if different
sql_database_name = "vibesdk"   # Update if different
sql_password_secret_id = "vibesdk-sql-app-password"  # Your secret name

# Storage
templates_bucket_name = "vibesdk-templates"
deployment_context_bucket_name = "vibesdk-templates-contexts"

# Preview Domain (Optional - for live deployments)
enable_preview_ingress = false
preview_domain = "ai.qikfox.com"
```

### **4.3 Additional Secrets for Full Functionality**

```bash
# OAuth (Optional)
gcloud secrets create GOOGLE_CLIENT_ID --data-file=- <<< "your-google-oauth-client-id"
gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- <<< "your-google-oauth-client-secret"
gcloud secrets create GITHUB_CLIENT_ID --data-file=- <<< "your-github-oauth-client-id"
gcloud secrets create GITHUB_CLIENT_SECRET --data-file=- <<< "your-github-oauth-client-secret"

# AI API Keys (Optional - based on providers you want)
gcloud secrets create OPENAI_API_KEY --data-file=- <<< "your-openai-key"
gcloud secrets create ANTHROPIC_API_KEY --data-file=- <<< "your-anthropic-key"
gcloud secrets create OPENROUTER_API_KEY --data-file=- <<< "your-openrouter-key"
gcloud secrets create GROQ_API_KEY --data-file=- <<< "your-groq-key"
```

---

## 🔄 **STEP 5: REDEPLOY WITH SECRETS**

### **5.1 Update Terraform with Secret References**
```bash
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### **5.2 Deploy Application Code**
```bash
# Deploy control plane
npm run deploy

# Or manual Cloud Run deploy
gcloud run deploy vibesdk-control-plane \
  --image us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="RUNTIME_PROVIDER=gcp" \
  --service-account vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com \
  --vpc-connector vibesdk-connector \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest"
```

---

## 🧪 **STEP 6: VERIFICATION**

### **6.1 Check Health Endpoints**
```bash
# Test control plane
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/health

# Check logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane" \
  --limit 50 --project qfxcloud-app-builder
```

### **6.2 Test Database Connection**
```bash
gcloud run exec vibesdk-control-plane --region us-central1 \
  --command "pg_isready -h /cloudsql/qfxcloud-app-builder:us-central1:vibesdk-sql"
```

### **6.3 Test Application Features**
```bash
# Test API health
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

# Test authentication
curl -X POST https://vibesdk-control-plane-2886014379.us-central1.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass","name":"Test User"}'
```

---

## 🔧 **CRITICAL ENVIRONMENT VARIABLES (MUST BE SET)**

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

## 🚨 **TROUBLESHOOTING**

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

## 📊 **COST ESTIMATION**

**Monthly Cost Breakdown:**
- **Cloud Run (2 services)**: $35-70/month
- **Cloud SQL (PostgreSQL)**: $15-30/month
- **Cloud Storage**: $5-15/month
- **Secret Manager**: $1-3/month
- **Artifact Registry**: Free tier covers most usage

**Total Estimated Monthly Cost: $56-118**

**💡 Production Considerations:**
- Enable Cloud SQL high availability
- Set up monitoring with Cloud Monitoring
- Configure proper backup schedules
- Implement rate limiting
- Set up proper domain certificates

---

## 🔐 **SECURITY NOTES**

1. **Database**: Private IP only, no public access
2. **Secrets**: All sensitive data in Secret Manager
3. **IAM**: Least privilege service accounts
4. **Networking**: Private VPC with serverless VPC access
5. **SSL/TLS**: Automatic HTTPS on Cloud Run

---

**🚀 Happy Deploying! Start with Step 1 and follow the sequence carefully.**
