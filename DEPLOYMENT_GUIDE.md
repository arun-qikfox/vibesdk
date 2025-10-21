# QFX Cloud App - Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the QFX Cloud App (formerly VibeSDK) with custom branding. The deployment process has been optimized to get the frontend running first, with backend services temporarily disabled for stability.

## Current Status
✅ **Build Status**: Successful (`npm run build` completed without errors)
✅ **Frontend**: Ready for deployment with custom branding
⚠️ **Backend**: Temporarily disabled (database services commented out for stability)

## Step-by-Step Deployment Process

### 1. Pre-Deployment Verification

```bash
# Navigate to project directory
cd /home/arunr/projects/vibesdk

# Verify build is successful
npm run build

# Check build artifacts
ls -la dist/
```

### 2. Environment Configuration

The application uses Cloudflare Workers with the following key configurations:

**Current Domain Configuration:**
- Production: `build.cloudflare.dev`
- Preview: `*build-preview.cloudflare.dev/*`

**Key Environment Variables:**
- `TEMPLATES_REPOSITORY`: GitHub templates repository
- `DISPATCH_NAMESPACE`: Cloudflare dispatch namespace
- `MAX_SANDBOX_INSTANCES`: Maximum sandbox instances (currently 10)
- `SANDBOX_INSTANCE_TYPE`: Sandbox instance type (standard-3)

### 3. Custom Branding Implementation

To implement "QFX Cloud App" branding, update the following files:

**Frontend Branding Files:**
- `src/components/Header.tsx` - Update app title
- `src/components/Footer.tsx` - Update footer branding
- `index.html` - Update page title and meta tags
- `src/assets/` - Replace logos and favicons

**Configuration Files:**
- `package.json` - Update app name and description
- `wrangler.jsonc` - Update worker name and metadata

### 4. Deployment Commands

#### Option A: Cloudflare Workers Deployment (Current)

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Deploy with specific environment
npx wrangler deploy --env production

# Deploy with custom domain
npx wrangler deploy --compatibility-date 2025-08-10
```

#### Option B: GCP Cloud Run Deployment (Future)

```bash
# Build Docker image
docker build -t gcr.io/qfxcloud-app-builder/qfx-cloud-app:latest .

# Push to Artifact Registry
docker push gcr.io/qfxcloud-app-builder/qfx-cloud-app:latest

# Deploy to Cloud Run
gcloud run deploy qfx-cloud-app \
  --image gcr.io/qfxcloud-app-builder/qfx-cloud-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 5. Post-Deployment Verification

#### Frontend Verification:
```bash
# Test main application
curl -I https://build.cloudflare.dev

# Test preview functionality
curl -I https://test-app.build-preview.cloudflare.dev

# Check custom branding
curl https://build.cloudflare.dev | grep -i "qfx"
```

#### Backend Verification (When Re-enabled):
```bash
# Test API endpoints
curl https://build.cloudflare.dev/api/health

# Test authentication (when enabled)
curl -X POST https://build.cloudflare.dev/api/auth/login
```

### 6. Monitoring and Logs

#### Cloudflare Workers Logs:
```bash
# View real-time logs
npx wrangler tail

# View logs for specific environment
npx wrangler tail --env production
```

#### GCP Logs (Future):
```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# View specific service logs
gcloud logging read "resource.labels.service_name=qfx-cloud-app" --limit 50
```

### 7. Rollback Procedures

#### Cloudflare Workers Rollback:
```bash
# List deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback [deployment-id]
```

#### GCP Cloud Run Rollback:
```bash
# List revisions
gcloud run revisions list --service=qfx-cloud-app

# Rollback to previous revision
gcloud run services update-traffic qfx-cloud-app --to-revisions=[revision-name]=100
```

## Current Limitations

### Temporarily Disabled Features:
1. **Database Services**: All database operations are disabled
2. **Authentication**: User authentication is disabled
3. **App Management**: App creation, editing, and deletion disabled
4. **Model Configuration**: AI model configuration disabled
5. **Secrets Management**: API key management disabled
6. **Analytics**: User analytics and stats disabled

### Error Responses:
All disabled features return HTTP 503 with message: "Feature temporarily disabled"

## Next Steps

### Phase 1: Frontend Deployment (Current Priority)
1. ✅ Complete build process
2. 🔄 Deploy frontend with custom branding
3. 🔄 Verify frontend functionality
4. 🔄 Test basic UI interactions

### Phase 2: Backend Re-enablement (After Frontend Verification)
1. Re-enable database services one by one
2. Fix remaining Drizzle ORM issues
3. Restore authentication functionality
4. Re-enable app management features
5. Restore analytics and monitoring

### Phase 3: Full Feature Restoration
1. Complete GCP migration
2. Implement custom agent runtime
3. Add advanced features
4. Performance optimization

## Troubleshooting

### Common Issues:

**Build Failures:**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Deployment Failures:**
```bash
# Check Wrangler configuration
npx wrangler whoami
npx wrangler config

# Verify environment variables
npx wrangler secret list
```

**Domain Issues:**
```bash
# Check DNS configuration
nslookup build.cloudflare.dev
dig build.cloudflare.dev
```

## Support and Documentation

- **Migration Plan**: `migration-gcp-plan/`
- **Disabled Features**: `disabled-features.md` (to be created)
- **API Documentation**: `docs/api/`
- **Setup Guide**: `docs/setup.md`

## Contact Information

For deployment issues or questions, refer to the migration plan documentation or contact the development team.

---

**Last Updated**: 2025-01-27
**Build Status**: ✅ Successful
**Deployment Status**: 🔄 Ready for Frontend Deployment
