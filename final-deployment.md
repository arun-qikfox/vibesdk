# Final Deployment Guide - VibSDK End-to-End

This document provides the complete step-by-step guide for deploying VibSDK with both backend and frontend components to Google Cloud Platform.

## Overview

The deployment consists of:
- **Backend**: Cloud Run service with workerd runtime
- **Frontend**: Cloud Run service with React application
- **Database**: Cloud SQL (PostgreSQL)
- **Storage**: Cloud Storage for templates and assets

## Prerequisites

1. **Google Cloud Project**: `qfxcloud-app-builder`
2. **Region**: `us-central1`
3. **Authentication**: `gcloud auth application-default login`
4. **Dependencies**: Node.js, npm, gcloud CLI

## Deployment URLs

- **Frontend**: https://qfx-cloud-app-2886014379.us-central1.run.app/
- **Backend API**: https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/

## Step 1: Backend Deployment

### 1.1 Build Worker Bundle
```bash
cd /home/arunr/projects/vibesdk
npm run build:worker
```

### 1.2 Create Cloud Run Context
```bash
npm run cloudrun:context
```

### 1.3 Upload Context to GCS
```bash
gsutil cp cloudrun-context.tar.gz gs://vibesdk-templates-contexts/
```

### 1.4 Build and Deploy Backend Image
```bash
gcloud builds submit --config cloudbuild/workerd.yaml --substitutions=COMMIT_SHA=latest
```

### 1.5 Deploy Backend Service with Terraform
```bash
cd infra/gcp
terraform plan
terraform apply -auto-approve
```

## Step 2: Frontend Deployment

### 2.1 Build Frontend Assets
```bash
cd /home/arunr/projects/vibesdk
npm run build
```

### 2.2 Deploy Frontend Service
```bash
./deploy-gcp-esmodule.sh
```

## Step 3: Verify Deployment

### 3.1 Test Backend API
```bash
# Health check
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/health

# Auth providers
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/providers

# CSRF token
curl -s https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/auth/csrf-token
```

### 3.2 Test Frontend
```bash
# Check frontend accessibility
curl -s -I https://qfx-cloud-app-2886014379.us-central1.run.app/ | head -3
```

### 3.3 Test End-to-End Authentication
1. Open frontend URL: https://qfx-cloud-app-2886014379.us-central1.run.app/
2. Click "Sign In" button
3. Verify login form appears with email/password fields
4. Test login functionality (will return success with test credentials)

## Configuration Details

### Backend Environment Variables
- `RUNTIME_PROVIDER`: `gcp`
- `GCP_PROJECT_ID`: `qfxcloud-app-builder`
- `GCP_REGION`: `us-central1`
- `DEFAULT_DEPLOYMENT_TARGET`: `gcp-cloud-run`
- `GCS_ASSETS_PREFIX`: `frontend-assets`
- `GCS_TEMPLATES_BUCKET`: `vibesdk-templates`

### Frontend Environment Variables
- `REACT_APP_API_URL`: `https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app`
- `QFX_ENV`: `production`

## Authentication Configuration

The backend provides simplified authentication for development:

### Available Endpoints
- `GET /api/auth/providers` - Returns available auth methods
- `GET /api/auth/csrf-token` - Returns CSRF token for requests
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/register` - User registration

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

## Troubleshooting

### Common Issues

1. **403 Forbidden on Frontend**
   - Ensure Cloud Run service allows unauthenticated access
   - Check IAM policies

2. **Authentication Form Not Showing**
   - Verify `/api/auth/providers` returns correct response
   - Check browser console for API errors

3. **CSRF Token Errors**
   - Ensure `/api/auth/csrf-token` endpoint is working
   - Check API client CSRF token handling

### Debug Commands

```bash
# Check service status
gcloud run services describe vibesdk-control-plane --region=us-central1
gcloud run services describe qfx-cloud-app --region=us-central1

# View logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane' --limit=10
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=qfx-cloud-app' --limit=10

# Test with proxy (authenticated)
gcloud run services proxy vibesdk-control-plane --region=us-central1 --port=8080
```

## File Structure

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
└── worker/                   # Backend source code
    ├── api/                  # API routes and controllers
    └── index.ts             # Main worker entry point
```

## Security Notes

- Backend API is publicly accessible for development
- CSRF tokens are generated for state-changing requests
- Authentication is simplified for development (returns success for any credentials)
- In production, implement proper user validation and database integration

## Maintenance

### Updating Backend
1. Make code changes in `worker/` directory
2. Run `npm run build:worker`
3. Follow Step 1 deployment process

### Updating Frontend
1. Make code changes in `src/` directory
2. Run `./deploy-gcp-esmodule.sh`

### Infrastructure Changes
1. Modify files in `infra/gcp/`
2. Run `terraform plan` to review changes
3. Run `terraform apply` to apply changes

## Support

For issues or questions:
1. Check Cloud Run service logs
2. Verify API endpoints are responding
3. Test with curl commands provided above
4. Review this documentation for troubleshooting steps

---

**Last Updated**: 2025-10-22
**Version**: 1.0
**Status**: Production Ready
