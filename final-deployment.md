# Final Deployment Guide - VibSDK GCP Deployment

This document provides complete step-by-step guides for deploying VibSDK components to Google Cloud Platform. Each component can be deployed independently.

## Overview

The deployment consists of:
- **Backend**: Cloud Run service with workerd runtime (GCP-native)
- **Frontend**: Cloud Run service with React application
- **Database**: Cloud SQL (PostgreSQL)
- **Storage**: Cloud Storage for templates and assets
- **Infrastructure**: Terraform-managed GCP resources

## Prerequisites

### Required Tools
1. **Google Cloud Project**: `qfxcloud-app-builder`
2. **Region**: `us-central1`
3. **Authentication**: `gcloud auth application-default login`
4. **Dependencies**: Node.js, npm, gcloud CLI, Terraform

### WSL/Cursor Users - Important Setup Notes

**If you're using Cursor with WSL (Windows Subsystem for Linux):**

1. **Terminal Access**: Use `Ctrl+Shift+` ` (backtick) to open integrated terminal in Cursor
2. **WSL Commands**: All commands below should be run in WSL terminal, not Windows PowerShell
3. **Path Format**: Use Linux paths (`/home/username/projects/vibesdk`) not Windows paths (`C:\Users\...`)
4. **File Access**: Files are accessible via `\\wsl.localhost\Ubuntu\home\username\projects\vibesdk\` in Windows Explorer

**WSL-Specific Commands:**
```bash
# Verify you're in WSL (should show Linux kernel version)
uname -a

# Navigate to project directory
cd /home/arunr/projects/vibesdk

# Verify gcloud is installed and authenticated
gcloud auth list
gcloud config get-value project
```

**Cursor Integration:**
- Open project folder: `\\wsl.localhost\Ubuntu\home\arunr\projects\vibesdk`
- Use Cursor's integrated terminal for all deployment commands
- File changes in Cursor automatically sync with WSL filesystem

### Initial Setup (One-time)
```bash
# Authenticate with Google Cloud
gcloud auth application-default login
gcloud config set project qfxcloud-app-builder

# Install dependencies
npm install

# Initialize Terraform (one-time)
cd infra/gcp
terraform init
cd ../..
```

## Current Deployment URLs

- **Frontend**: https://qfx-cloud-app-2886014379.us-central1.run.app/
- **Backend API**: https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/

---

# Backend Deployment (Independent)

## Backend Prerequisites
- PostgreSQL database running in Cloud SQL
- Secret Manager secret: `vibesdk-sql-connection-url`
- Cloud Storage bucket: `vibesdk-templates-contexts`

## Backend Deployment Steps

### Step 1: Build Worker Bundle
```bash
# For WSL/Cursor users: Use integrated terminal (Ctrl+Shift+`)
cd /home/arunr/projects/vibesdk
npm run build:worker
```
**Expected Output**: Worker bundle created in `dist/worker-bundle/`

### Step 2: Create Secure Build Context
```bash
# WSL command - creates context with compiled bundle
npm run cloudrun:context
```
**Expected Output**: `cloudrun-context.tar.gz` created (contains only compiled bundle + Docker files)

### Step 3: Upload Context to Cloud Storage
```bash
# WSL command - uploads to GCS bucket
gsutil cp cloudrun-context.tar.gz gs://vibesdk-templates-contexts/
```
**Expected Output**: Context uploaded to GCS

### Step 4: Build and Deploy Backend Image
```bash
# WSL command - triggers Cloud Build (simplified version)
gcloud builds submit --config cloudbuild/workerd.yaml
```
**Expected Output**: Docker image built and pushed to Artifact Registry

### Step 5: Update Infrastructure
```bash
# WSL commands - update Terraform state
cd infra/gcp
terraform plan
terraform apply -auto-approve
cd ../..
```
**Expected Output**: Cloud Run service updated with new image

### Step 6: Verify Backend Deployment
```bash
# Health check
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/health

# Auth providers
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/providers

# CSRF token
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/csrf-token
```

---

# Frontend Deployment (Independent)

## Frontend Prerequisites
- Backend API URL (if backend is deployed)
- Node.js build environment

## Frontend Deployment Steps

### Step 1: Build Frontend Assets
```bash
# WSL command - build React frontend
cd /home/arunr/projects/vibesdk
npm run build
```
**Expected Output**: Frontend assets created in `dist/client/`

### Step 2: Deploy Frontend Service
```bash
# WSL command - deploy to Cloud Run
./deploy-gcp-esmodule.sh
```
**Expected Output**: Frontend deployed to Cloud Run

### Step 3: Verify Frontend Deployment
```bash
# WSL commands - test frontend accessibility
curl -s -I https://qfx-cloud-app-2886014379.us-central1.run.app/ | head -3
curl -s https://qfx-cloud-app-2886014379.us-central1.run.app/ | grep -o '<title>.*</title>'
```

---

# Infrastructure Management (Independent)

## Infrastructure Prerequisites
- Terraform initialized
- GCP project with required APIs enabled

## Infrastructure Deployment Steps

### Step 1: Review Infrastructure Changes
```bash
cd infra/gcp
terraform plan
```

### Step 2: Apply Infrastructure Changes
```bash
terraform apply -auto-approve
```

### Step 3: Verify Infrastructure
```bash
# Check Cloud Run services
gcloud run services list --region=us-central1

# Check Cloud SQL instances
gcloud sql instances list

# Check Cloud Storage buckets
gsutil ls
```

---

# End-to-End Testing

## Backend API Testing

### Core Authentication Endpoints
```bash
# 1. Health Check
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/health

# 2. CSRF Token
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/csrf-token

# 3. Auth Providers
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/providers

# 4. User Registration
curl -s -X POST 'https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://qfx-cloud-app-2886014379.us-central1.run.app' \
  -d '{"email":"user@example.com","password":"SecurePassword123!","name":"Test User"}'

# 5. User Login
curl -s -X POST 'https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://qfx-cloud-app-2886014379.us-central1.run.app' \
  -d '{"email":"user@example.com","password":"SecurePassword123!"}'
```

### Protected Endpoints (Require Authentication)
```bash
# Get User Profile (requires JWT token)
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/profile

# Get User Apps (requires JWT token)
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/user/apps
```

## Frontend Testing

### 1. Basic Accessibility
```bash
# Check frontend loads
curl -s -I https://qfx-cloud-app-2886014379.us-central1.run.app/ | head -3

# Verify HTML content
curl -s https://qfx-cloud-app-2886014379.us-central1.run.app/ | grep -o '<title>.*</title>'
```

### 2. Browser Testing
1. Open frontend URL: https://qfx-cloud-app-2886014379.us-central1.run.app/
2. Click "Sign In" button
3. Verify login form appears with email/password fields
4. Test registration functionality
5. Test login functionality

---

# Configuration Details

## Backend Environment Variables
```bash
RUNTIME_PROVIDER=gcp
GCP_PROJECT_ID=qfxcloud-app-builder
GCP_REGION=us-central1
DEFAULT_DEPLOYMENT_TARGET=gcp-cloud-run
GCS_ASSETS_PREFIX=frontend-assets
GCS_TEMPLATES_BUCKET=vibesdk-templates
DATABASE_URL=postgres://... (from Secret Manager)
KV_IN_MEMORY=true  # For local development
```

## Frontend Environment Variables
```bash
REACT_APP_API_URL=https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app
QFX_ENV=production
```

## Authentication Configuration

The backend provides full authentication with PostgreSQL integration:

### Available Endpoints
- `GET /api/auth/providers` - Returns available auth methods
- `GET /api/auth/csrf-token` - Returns CSRF token for requests
- `POST /api/auth/register` - User registration with database storage
- `POST /api/auth/login` - Email/password login with session management
- `GET /api/auth/profile` - Get user profile (requires authentication)
- `PUT /api/auth/profile` - Update user profile (requires authentication)
- `POST /api/auth/logout` - Logout and session cleanup

### Auth Provider Response
```json
{
  "success": true,
  "providers": {
    "google": false,
    "github": false,
    "email": true
  },
  "hasOAuth": false,
  "requiresEmailAuth": true
}
```

---

# Troubleshooting

## Common Issues

### 1. Backend Issues

**403 Forbidden on API calls**
```bash
# Check Cloud Run service permissions
gcloud run services describe vibesdk-control-plane --region=us-central1

# Verify public access is enabled
gcloud run services get-iam-policy vibesdk-control-plane --region=us-central1
```

**Database Connection Errors**
```bash
# Check Secret Manager secret
gcloud secrets versions access latest --secret="vibesdk-sql-connection-url" --project="qfxcloud-app-builder"

# Verify Cloud SQL instance is running
gcloud sql instances list
```

**Build Failures**
```bash
# Check Cloud Build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

### 2. Frontend Issues

**Authentication Form Not Showing**
```bash
# Verify backend API is responding
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/providers

# Check browser console for API errors
# Verify REACT_APP_API_URL is set correctly
```

**CORS Errors**
```bash
# Check if Origin header is being sent
curl -s -H "Origin: https://qfx-cloud-app-2886014379.us-central1.run.app" \
  https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/providers
```

### 3. Infrastructure Issues

**Terraform Apply Failures**
```bash
# Check Terraform state
cd infra/gcp
terraform state list
terraform plan

# Check GCP quotas and limits
gcloud compute project-info describe --project=qfxcloud-app-builder
```

## Debug Commands

```bash
# WSL commands - check service status
gcloud run services list --region=us-central1

# WSL commands - view logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane' --limit=10
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=qfx-cloud-app' --limit=10

# WSL command - test with proxy (authenticated)
gcloud run services proxy vibesdk-control-plane --region=us-central1 --port=8080
```

## WSL/Cursor Specific Troubleshooting

### Common WSL Issues

**1. PowerShell vs WSL Terminal Confusion**
```bash
# Verify you're in WSL (should show Linux kernel)
uname -a

# If you see Windows paths, you're in PowerShell - switch to WSL
# In Cursor: Ctrl+Shift+` to open integrated terminal
```

**2. Path Issues**
```bash
# Correct WSL path format
cd /home/arunr/projects/vibesdk

# Wrong Windows path format (don't use)
cd C:\Users\arunr\projects\vibesdk
```

**3. File Permission Issues**
```bash
# Make scripts executable in WSL
chmod +x deploy-gcp-esmodule.sh
chmod +x scripts/*.sh
```

**4. Environment Variables**
```bash
# Export from .env.local in WSL
export $(cat .env.local | xargs)

# Verify environment
echo $GCP_PROJECT_ID
echo $DATABASE_URL
```

**5. Cursor Integration Issues**
- **File Access**: Use `\\wsl.localhost\Ubuntu\home\arunr\projects\vibesdk\` in Windows Explorer
- **Terminal**: Always use Cursor's integrated terminal (`Ctrl+Shift+` `)
- **Git**: WSL handles Git operations, not Windows Git
- **Node.js**: Use WSL Node.js, not Windows Node.js

---

# File Structure

```
vibesdk/
├── infra/gcp/                 # Terraform infrastructure
│   ├── main.tf               # Main infrastructure
│   ├── variables.tf          # Variable definitions
│   ├── terraform.tfvars      # Variable values
│   └── modules/              # Terraform modules
├── cloudbuild/               # Cloud Build configurations
│   ├── workerd.yaml         # Backend build config
│   └── deploy.yaml          # Generic deploy config
├── deploy-gcp-esmodule.sh    # Frontend deployment script
├── scripts/                  # Build and deployment scripts
│   ├── build-worker.ts      # Worker build script
│   ├── deploy-gcp.ts         # GCP deployment script
│   └── create-cloudrun-context.ts
├── worker/                   # Backend source code
│   ├── api/                  # API routes and controllers
│   ├── database/            # Database services and clients
│   └── index.ts             # Main worker entry point
├── src/                      # Frontend source code
└── dist/                     # Build outputs
    ├── worker-bundle/        # Compiled backend
    └── client/              # Compiled frontend
```

---

# Security Notes

- Backend API is publicly accessible for development
- CSRF tokens are generated for state-changing requests
- Full PostgreSQL authentication with session management
- All user data stored in Cloud SQL
- Secrets managed through Google Secret Manager
- In production, implement proper user validation and rate limiting

---

# Maintenance

## Updating Backend Only
1. Make code changes in `worker/` directory
2. Run backend deployment steps (Steps 1-6)
3. Test backend endpoints

## Updating Frontend Only
1. Make code changes in `src/` directory
2. Run frontend deployment steps (Steps 1-3)
3. Test frontend functionality

## Updating Infrastructure Only
1. Modify files in `infra/gcp/`
2. Run infrastructure deployment steps (Steps 1-3)
3. Verify all services are running

## Full System Update
1. Update backend (if needed)
2. Update frontend (if needed)
3. Update infrastructure (if needed)
4. Run comprehensive testing

---

# Support

For issues or questions:
1. Check Cloud Run service logs
2. Verify API endpoints are responding
3. Test with curl commands provided above
4. Review this documentation for troubleshooting steps
5. Check Terraform state and GCP resource status

---

**Last Updated**: 2025-10-23
**Version**: 2.0
**Status**: Production Ready - GCP Native
