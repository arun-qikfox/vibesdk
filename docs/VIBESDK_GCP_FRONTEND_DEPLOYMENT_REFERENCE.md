# VibSDK GCP Frontend Deployment - Complete Reference

## Overview

This document provides a complete reference for deploying VibSDK frontend to Google Cloud Run with Google Cloud Storage asset serving. This is the single source of truth for all frontend deployment operations.

## Architecture

### Single Container Approach
- **Backend**: Hono app running in workerd (Cloudflare's open-source runtime)
- **Frontend**: React SPA served from Google Cloud Storage bucket
- **Routing**: Unified routing through workerd container
- **Benefits**: Cost-effective, simple deployment, unified management

### Asset Flow
1. Frontend build → `dist/client/` directory
2. Upload to GCS → `gs://vibesdk-templates/frontend-assets/`
3. Serve via workerd → `GCS_ASSETS_PREFIX` environment variable
4. Route resolution → API calls to Hono, static assets from GCS

## Deployment Commands

### Full Deployment (Recommended)
```bash
# Navigate to project directory
cd /home/arunr/projects/vibesdk

# Run complete deployment (includes frontend upload)
npm run deploy:gcp
```

### Manual Step-by-Step Deployment
```bash
# Step 1: Build frontend
npm run build

# Step 2: Upload to GCS
gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/

# Step 3: Update Cloud Run environment
gcloud run services update vibesdk-control-plane \
  --region=us-central1 \
  --set-env-vars="GCS_ASSETS_PREFIX=frontend-assets"

# Step 4: Verify deployment
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.url)"
```

### Frontend-Only Update (After Backend is Deployed)
```bash
# Build and upload frontend assets only
npm run build
gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/
```

## Configuration

### Environment Variables
| Variable | Value | Description |
|----------|-------|-------------|
| `RUNTIME_PROVIDER` | `gcp` | Runtime provider identifier |
| `GCP_PROJECT_ID` | `qfxcloud-app-builder` | GCP project ID |
| `GCP_REGION` | `us-central1` | GCP region |
| `GCS_TEMPLATES_BUCKET` | `vibesdk-templates` | GCS bucket for assets |
| `GCS_ASSETS_PREFIX` | `frontend-assets` | Prefix for frontend assets in bucket |
| `DEFAULT_DEPLOYMENT_TARGET` | `gcp-cloud-run` | Default deployment target |

### Service Configuration
- **Service Name**: `vibesdk-control-plane`
- **Region**: `us-central1`
- **Port**: `8080`
- **Memory**: `1Gi`
- **CPU**: `1`
- **Max Instances**: `10`
- **Platform**: `managed`
- **Access**: `unauthenticated`

## Testing Commands

### Basic Health Check
```bash
# Test API health
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

# Test root endpoint (should serve frontend)
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/

# Test specific frontend route
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/dashboard
```

### Comprehensive Testing
```bash
# Run automated test suite
./scripts/test-deployment.sh

# Check GCS assets
gsutil ls gs://vibesdk-templates/frontend-assets/

# Check service status
gcloud run services describe vibesdk-control-plane --region=us-central1

# Check service logs
gcloud logs tail --service=vibesdk-control-plane --region=us-central1
```

## Troubleshooting

### Common Issues

#### 1. Frontend Not Loading (404 Errors)
**Symptoms**: Frontend returns 404, API works fine
**Solutions**:
```bash
# Check if assets exist in GCS
gsutil ls gs://vibesdk-templates/frontend-assets/

# Re-upload assets
gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/

# Verify environment variable
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
```

#### 2. API Not Responding
**Symptoms**: API endpoints return errors
**Solutions**:
```bash
# Check service logs
gcloud logs tail --service=vibesdk-control-plane --region=us-central1

# Check service status
gcloud run services describe vibesdk-control-plane --region=us-central1

# Restart service
gcloud run services update vibesdk-control-plane --region=us-central1
```

#### 3. Build Failures
**Symptoms**: `npm run build` fails
**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build 2>&1 | grep -i error

# Check disk space
df -h
```

#### 4. GCS Upload Failures
**Symptoms**: `gsutil` commands fail
**Solutions**:
```bash
# Check authentication
gcloud auth list

# Check project
gcloud config get-value project

# Check bucket permissions
gsutil iam get gs://vibesdk-templates

# Test with verbose output
gsutil -D -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/
```

### Debug Commands

#### Check Service Configuration
```bash
# Get all environment variables
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="export" | grep -A 20 "env:"

# Get service URL
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.url)"

# Get service status
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.conditions[0].status)"
```

#### Check Asset Serving
```bash
# List all assets in bucket
gsutil ls -r gs://vibesdk-templates/frontend-assets/

# Check specific file
gsutil cat gs://vibesdk-templates/frontend-assets/index.html

# Test asset access
curl -I https://vibesdk-control-plane-2886014379.us-central1.run.app/assets/index.css
```

## File Structure

### Key Files Modified
- `scripts/deploy-gcp.ts` - Added `uploadFrontendAssets()` method
- `worker/index.ts` - Updated `buildAssetKeyCandidates()` for GCS prefix
- `container/workerd/service.capnp` - Added `GCS_ASSETS_PREFIX` binding
- `infra/gcp/terraform.tfvars` - Added `GCS_ASSETS_PREFIX` environment variable
- `scripts/test-deployment.sh` - Added frontend-specific tests

### Build Output
- `dist/client/` - Frontend build output
- `dist/worker-bundle/` - Worker bundle for Cloud Run
- `gs://vibesdk-templates/frontend-assets/` - Deployed frontend assets

## Deployment Scripts

### Main Deployment Script
```bash
#!/bin/bash
# File: deploy-frontend.sh

set -e

PROJECT_ID="qfxcloud-app-builder"
REGION="us-central1"
SERVICE_NAME="vibesdk-control-plane"
BUCKET_NAME="vibesdk-templates"

echo "🚀 Starting VibSDK Frontend Deployment"

# Build frontend
npm run build

# Upload to GCS
gsutil -m rsync -r -d dist/client gs://$BUCKET_NAME/frontend-assets/

# Update Cloud Run
gcloud run services update $SERVICE_NAME \
    --region=$REGION \
    --set-env-vars="GCS_ASSETS_PREFIX=frontend-assets"

# Test deployment
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
curl -s "$SERVICE_URL/api/health" | grep -q "healthy" && echo "✅ API healthy"
curl -s "$SERVICE_URL/" | grep -q "html" && echo "✅ Frontend serving"

echo "🎉 Deployment completed: $SERVICE_URL"
```

## Monitoring and Maintenance

### Health Checks
```bash
# API health
curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

# Frontend health
curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/ | head -1

# Service status
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.conditions[0].status)"
```

### Log Monitoring
```bash
# Real-time logs
gcloud logs tail --service=vibesdk-control-plane --region=us-central1

# Recent errors
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane AND severity>=ERROR" --limit=10

# Asset serving logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane AND textPayload:\"Failed to read asset from GCS\"" --limit=5
```

### Performance Monitoring
```bash
# Service metrics
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.traffic[0].percent,status.traffic[0].revisionName)"

# Request metrics
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vibesdk-control-plane AND httpRequest.requestUrl:\"/api/\"" --limit=10
```

## Security Considerations

### IAM Permissions
- Cloud Run service account needs `storage.objectViewer` role on `vibesdk-templates` bucket
- Deployment account needs `storage.objectAdmin` role for uploads
- Service account needs `run.invoker` role for public access

### Environment Variables
- All sensitive data stored in Secret Manager
- `GCS_ASSETS_PREFIX` is non-sensitive configuration
- Bucket names are non-sensitive identifiers

## Cost Optimization

### Resource Limits
- Memory: 1Gi (sufficient for workerd + asset serving)
- CPU: 1 (adequate for typical load)
- Max instances: 10 (prevents runaway costs)
- Min instances: 0 (cost-effective for low traffic)

### Storage Optimization
- GCS Standard storage for frontend assets
- Automatic cleanup of old deployment contexts
- Efficient asset serving via workerd

## Future Enhancements

### Planned Improvements
1. **CDN Integration**: Cloud CDN for global asset distribution
2. **Asset Versioning**: Cache-busting for frontend updates
3. **Compression**: Gzip compression for static assets
4. **Security Headers**: Enhanced security headers for static assets
5. **Monitoring**: Custom metrics for asset serving performance

### Migration Path
- Current: Single container with GCS asset serving
- Future: Separate CDN service for optimal performance
- Maintain: Backward compatibility with current architecture

## Quick Reference Commands

```bash
# Deploy everything
npm run deploy:gcp

# Deploy frontend only
npm run build && gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/

# Test deployment
./scripts/test-deployment.sh

# Check service status
gcloud run services describe vibesdk-control-plane --region=us-central1

# View logs
gcloud logs tail --service=vibesdk-control-plane --region=us-central1

# Get service URL
gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.url)"
```

---

**Last Updated**: January 27, 2025  
**Version**: 1.0  
**Status**: Production Ready
