#!/bin/bash

# Frontend Deployment Script for VibSDK
# This script deploys the frontend assets to GCS and updates the Cloud Run service

set -e

echo "🚀 Starting VibSDK Frontend Deployment"
echo "======================================"

# Configuration
PROJECT_ID="qfxcloud-app-builder"
REGION="us-central1"
SERVICE_NAME="vibesdk-control-plane"
BUCKET_NAME="vibesdk-templates"

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo "  Bucket: $BUCKET_NAME"
echo ""

# Step 1: Build frontend assets
echo "🎨 Step 1: Building frontend assets..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

echo "✅ Frontend build completed"
echo ""

# Step 2: Upload frontend assets to GCS
echo "📤 Step 2: Uploading frontend assets to GCS..."
gsutil -m rsync -r -d dist/client gs://$BUCKET_NAME/frontend-assets/

if [ $? -ne 0 ]; then
    echo "❌ GCS upload failed"
    exit 1
fi

echo "✅ Frontend assets uploaded to GCS"
echo ""

# Step 3: Update Cloud Run service with environment variables
echo "🔧 Step 3: Updating Cloud Run service environment..."
gcloud run services update $SERVICE_NAME \
    --region=$REGION \
    --set-env-vars="GCS_ASSETS_PREFIX=frontend-assets"

if [ $? -ne 0 ]; then
    echo "❌ Cloud Run update failed"
    exit 1
fi

echo "✅ Cloud Run service updated"
echo ""

# Step 4: Get service URL and test
echo "🧪 Step 4: Testing deployment..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo "Service URL: $SERVICE_URL"
echo ""

# Test API health
echo "Testing API health endpoint..."
if curl -s "$SERVICE_URL/api/health" | grep -q "healthy"; then
    echo "✅ API health endpoint responding"
else
    echo "❌ API health endpoint not responding"
fi

# Test frontend
echo "Testing frontend..."
if curl -s "$SERVICE_URL/" | grep -q "html"; then
    echo "✅ Frontend serving HTML"
else
    echo "❌ Frontend not serving HTML"
fi

echo ""
echo "🎉 Frontend deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📋 Next steps:"
echo "  1. Visit the service URL to test the frontend"
echo "  2. Check browser console for any errors"
echo "  3. Test API endpoints at /api/*"
echo "  4. Run: ./scripts/test-deployment.sh for comprehensive testing"
