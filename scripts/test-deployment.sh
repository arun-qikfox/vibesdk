#!/bin/bash
# Simple deployment test script for VibSDK
# Run this from the project root: ./scripts/test-deployment.sh

set -e

echo "🧪 Testing VibSDK Deployment Flow"
echo "================================="

# Test 1: Check if Cloud Run context creation works
echo "Test 1: Creating Cloud Run context..."
mkdir -p /tmp/test-app
echo '{"name":"test","version":"1.0.0","main":"index.js"}' > /tmp/test-app/package.json
echo 'console.log("Hello World");' > /tmp/test-app/index.js

npm run cloudrun:context -- --src /tmp/test-app --out /tmp/test-context.tar.gz

if [ -f /tmp/test-context.tar.gz ]; then
    echo "✅ Cloud Run context creation works"
else
    echo "❌ Cloud Run context creation failed"
    exit 1
fi

# Test 2: Check if gcloud is configured
echo "Test 2: Checking gcloud configuration..."
if gcloud config get-value project | grep -q "qfxcloud-app-builder"; then
    echo "✅ gcloud is configured for correct project"
else
    echo "❌ gcloud not configured for qfxcloud-app-builder"
    exit 1
fi

# Test 3: Check if Artifact Registry exists
echo "Test 3: Checking Artifact Registry..."
if gcloud artifacts repositories describe vibesdk-apps --location=us-central1 &>/dev/null; then
    echo "✅ Artifact Registry repository exists"
else
    echo "❌ Artifact Registry repository not found"
    exit 1
fi

# Test 4: Check if Cloud Storage bucket exists
echo "Test 4: Checking Cloud Storage bucket..."
if gsutil ls gs://vibesdk-deployment-contexts &>/dev/null; then
    echo "✅ Cloud Storage bucket exists"
else
    echo "❌ Cloud Storage bucket not found"
    exit 1
fi

# Test 5: Check if Cloud Run control plane is running
echo "Test 5: Checking Cloud Run control plane..."
if gcloud run services describe vibesdk-control-plane --region=us-central1 &>/dev/null; then
    SERVICE_URL=$(gcloud run services describe vibesdk-control-plane --region=us-central1 --format="value(status.url)")
    echo "✅ Control plane is running at: $SERVICE_URL"
else
    echo "❌ Cloud Run control plane not found"
    exit 1
fi

# Test 6: Check if frontend assets are uploaded to GCS
echo "Test 6: Checking frontend assets in GCS..."
if gsutil ls gs://vibesdk-templates/frontend-assets/ &>/dev/null; then
    echo "✅ Frontend assets found in GCS bucket"
    # Check for index.html specifically
    if gsutil ls gs://vibesdk-templates/frontend-assets/index.html &>/dev/null; then
        echo "✅ Frontend index.html found"
    else
        echo "⚠️  Frontend index.html not found (may need deployment)"
    fi
else
    echo "⚠️  Frontend assets not found in GCS (may need deployment)"
fi

# Test 7: Test API health endpoint
echo "Test 7: Testing API health endpoint..."
if [ ! -z "$SERVICE_URL" ]; then
    if curl -s "$SERVICE_URL/api/health" | grep -q "healthy"; then
        echo "✅ API health endpoint responding"
    else
        echo "❌ API health endpoint not responding"
    fi
else
    echo "⚠️  Skipping API test (no service URL)"
fi

echo ""
echo "🎉 All basic tests passed!"
echo ""
echo "Next steps:"
echo "1. Run: npm run deploy:gcp"
echo "2. Test the full deployment flow through the UI"
echo "3. Check the deployment logs in Cloud Build"

# Cleanup
rm -rf /tmp/test-app
rm -f /tmp/test-context.tar.gz
