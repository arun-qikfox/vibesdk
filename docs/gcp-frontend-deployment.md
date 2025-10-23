# GCP Frontend Deployment Guide

This document describes how the VibSDK frontend is deployed to Google Cloud Run using Google Cloud Storage for asset serving.

## Architecture Overview

The frontend deployment uses a **single container approach** where:

1. **Backend**: Hono app running in workerd (Cloudflare's open-source runtime) handles all `/api/*` routes
2. **Frontend**: React SPA assets served from Google Cloud Storage bucket via the same container
3. **Routing**: The workerd container routes requests - API calls go to Hono, static assets are served from GCS

## Deployment Process

### 1. Build Frontend Assets
```bash
npm run build
```
This creates the production build in `dist/client/` directory.

### 2. Upload to GCS
```bash
gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/
```
Assets are uploaded to the `frontend-assets/` prefix in the templates bucket.

### 3. Deploy Container
The workerd container is built and deployed with:
- Worker bundle containing the Hono backend
- Environment variable `GCS_ASSETS_PREFIX=frontend-assets`
- Access to the GCS bucket for asset serving

## Configuration

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `GCS_ASSETS_PREFIX` | `frontend-assets` | Prefix for frontend assets in GCS bucket |
| `GCS_TEMPLATES_BUCKET` | `vibesdk-templates` | GCS bucket name for assets |
| `RUNTIME_PROVIDER` | `gcp` | Runtime provider identifier |

### Asset Serving Logic

The worker code (`worker/index.ts`) handles asset serving:

1. **API Routes**: Requests to `/api/*` are handled by the Hono app
2. **Static Assets**: All other requests are served from GCS using `serveAssetFromObjectStore()`
3. **SPA Routing**: Non-existent paths serve `index.html` for client-side routing

### Asset Path Resolution

For a request to `/dashboard`, the system looks for:
1. `frontend-assets/dashboard` (exact path)
2. `frontend-assets/index.html` (SPA fallback)

## Testing

### Manual Testing
```bash
# Test API health
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

# Test frontend (should serve index.html)
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/

# Check GCS assets
gsutil ls gs://vibesdk-templates/frontend-assets/
```

### Automated Testing
```bash
# Run deployment tests
./scripts/test-deployment.sh
```

## Troubleshooting

### Frontend Not Loading
1. **Check GCS assets**: `gsutil ls gs://vibesdk-templates/frontend-assets/`
2. **Verify environment**: Check `GCS_ASSETS_PREFIX` is set in Cloud Run
3. **Check logs**: `gcloud logs tail --service=vibesdk-control-plane --region=us-central1`

### 404 Errors
1. **Asset not in GCS**: Re-run deployment to upload assets
2. **Wrong prefix**: Verify `GCS_ASSETS_PREFIX` matches bucket structure
3. **Permissions**: Ensure Cloud Run service account has `storage.objectViewer` role

### API Errors
1. **Backend issues**: Check Hono app logs in Cloud Run
2. **Database**: Verify database connection and migrations
3. **Environment**: Check all required environment variables are set

## Deployment Commands

### Full Deployment
```bash
npm run deploy:gcp
```

### Frontend Only (after backend is deployed)
```bash
npm run build
gsutil -m rsync -r -d dist/client gs://vibesdk-templates/frontend-assets/
```

### Update Environment Variables
```bash
gcloud run services update vibesdk-control-plane \
  --region=us-central1 \
  --set-env-vars="GCS_ASSETS_PREFIX=frontend-assets"
```

## Benefits of This Approach

1. **Cost Effective**: Single Cloud Run service, no additional infrastructure
2. **Simple Deployment**: One container, one deployment pipeline
3. **Scalable**: GCS handles CDN-like distribution automatically
4. **Consistent**: Same routing logic for API and static assets
5. **Maintainable**: Clear separation between backend and frontend concerns

## Future Improvements

1. **CDN Integration**: Use Cloud CDN for better global performance
2. **Asset Versioning**: Implement cache-busting for frontend assets
3. **Compression**: Enable gzip compression for static assets
4. **Security Headers**: Add security headers for static assets
