#!/bin/bash

# VibSDK Deployment Verification Script
# Run this script to verify the current deployment status

set -e

echo "🔍 VibSDK Deployment Verification"
echo "================================="

# Configuration
SERVICE_URL="https://vibesdk-control-plane-2886014379.us-central1.run.app"
PROJECT_ID="qfxcloud-app-builder"
REGION="us-central1"
SERVICE_NAME="vibesdk-control-plane"
BUCKET_NAME="vibesdk-templates"

echo "📋 Configuration:"
echo "  Service URL: $SERVICE_URL"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo "  Bucket: $BUCKET_NAME"
echo ""

# Test 1: Check if gcloud is configured
echo "🔧 Test 1: Checking gcloud configuration..."
if gcloud config get-value project | grep -q "$PROJECT_ID"; then
    echo "✅ gcloud is configured for correct project"
else
    echo "❌ gcloud not configured for $PROJECT_ID"
    echo "   Run: gcloud config set project $PROJECT_ID"
    exit 1
fi

# Test 2: Check Cloud Run service status
echo "🚀 Test 2: Checking Cloud Run service status..."
if gcloud run services describe $SERVICE_NAME --region=$REGION &>/dev/null; then
    SERVICE_STATUS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.conditions[0].status)")
    if [ "$SERVICE_STATUS" = "True" ]; then
        echo "✅ Cloud Run service is running"
    else
        echo "❌ Cloud Run service not ready (status: $SERVICE_STATUS)"
        exit 1
    fi
else
    echo "❌ Cloud Run service not found"
    exit 1
fi

# Test 3: Check API health endpoint
echo "🏥 Test 3: Testing API health endpoint..."
if curl -s "$SERVICE_URL/api/health" | grep -q "healthy"; then
    echo "✅ API health endpoint responding"
else
    echo "❌ API health endpoint not responding"
    echo "   Check service logs: gcloud logs tail --service=$SERVICE_NAME --region=$REGION"
fi

# Test 4: Check root endpoint
echo "🌐 Test 4: Testing root endpoint..."
ROOT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/")
if [ "$ROOT_RESPONSE" = "200" ]; then
    echo "✅ Root endpoint responding (HTTP $ROOT_RESPONSE)"
else
    echo "⚠️  Root endpoint returned HTTP $ROOT_RESPONSE"
fi

# Test 5: Check if frontend assets exist in GCS
echo "📦 Test 5: Checking frontend assets in GCS..."
if gsutil ls gs://$BUCKET_NAME/frontend-assets/ &>/dev/null; then
    echo "✅ Frontend assets found in GCS bucket"
    
    # Check for index.html specifically
    if gsutil ls gs://$BUCKET_NAME/frontend-assets/index.html &>/dev/null; then
        echo "✅ Frontend index.html found"
    else
        echo "⚠️  Frontend index.html not found"
    fi
else
    echo "⚠️  Frontend assets not found in GCS"
    echo "   Run: npm run build && gsutil -m rsync -r -d dist/client gs://$BUCKET_NAME/frontend-assets/"
fi

# Test 6: Check environment variables
echo "⚙️  Test 6: Checking environment variables..."
ENV_VARS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.template.spec.containers[0].env[].name)" | tr '\n' ' ')
if echo "$ENV_VARS" | grep -q "GCS_ASSETS_PREFIX"; then
    echo "✅ GCS_ASSETS_PREFIX environment variable set"
else
    echo "⚠️  GCS_ASSETS_PREFIX environment variable not set"
    echo "   Run: gcloud run services update $SERVICE_NAME --region=$REGION --set-env-vars=\"GCS_ASSETS_PREFIX=frontend-assets\""
fi

# Test 7: Test frontend serving
echo "🎨 Test 7: Testing frontend serving..."
FRONTEND_RESPONSE=$(curl -s "$SERVICE_URL/" | head -1)
if echo "$FRONTEND_RESPONSE" | grep -q "html"; then
    echo "✅ Frontend serving HTML content"
else
    echo "⚠️  Frontend not serving HTML content"
    echo "   Response: $FRONTEND_RESPONSE"
fi

echo ""
echo "📊 Summary:"
echo "  Service URL: $SERVICE_URL"
echo "  API Status: $(curl -s "$SERVICE_URL/api/health" | grep -o '"status":"[^"]*"' || echo 'Unknown')"
echo "  Frontend Status: $(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/")"
echo ""

# Provide next steps
echo "📋 Next Steps:"
if ! gsutil ls gs://$BUCKET_NAME/frontend-assets/ &>/dev/null; then
    echo "  1. Deploy frontend assets:"
    echo "     npm run build"
    echo "     gsutil -m rsync -r -d dist/client gs://$BUCKET_NAME/frontend-assets/"
    echo "     gcloud run services update $SERVICE_NAME --region=$REGION --set-env-vars=\"GCS_ASSETS_PREFIX=frontend-assets\""
    echo ""
fi

echo "  2. Test the deployment:"
echo "     curl $SERVICE_URL/"
echo "     curl $SERVICE_URL/api/health"
echo ""
echo "  3. View logs if needed:"
echo "     gcloud logs tail --service=$SERVICE_NAME --region=$REGION"
echo ""

echo "🎉 Verification completed!"