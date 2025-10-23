# Frontend Deployment Script for VibSDK (PowerShell)
# This script deploys the frontend assets to GCS and updates the Cloud Run service

param(
    [string]$ProjectId = "qfxcloud-app-builder",
    [string]$Region = "us-central1",
    [string]$ServiceName = "vibesdk-control-plane",
    [string]$BucketName = "vibesdk-templates"
)

Write-Host "🚀 Starting VibSDK Frontend Deployment" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Project ID: $ProjectId"
Write-Host "  Region: $Region"
Write-Host "  Service: $ServiceName"
Write-Host "  Bucket: $BucketName"
Write-Host ""

# Step 1: Build frontend assets
Write-Host "🎨 Step 1: Building frontend assets..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "✅ Frontend build completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Upload frontend assets to GCS
Write-Host "📤 Step 2: Uploading frontend assets to GCS..." -ForegroundColor Cyan
try {
    gsutil -m rsync -r -d dist/client "gs://$BucketName/frontend-assets/"
    Write-Host "✅ Frontend assets uploaded to GCS" -ForegroundColor Green
} catch {
    Write-Host "❌ GCS upload failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Update Cloud Run service with environment variables
Write-Host "🔧 Step 3: Updating Cloud Run service environment..." -ForegroundColor Cyan
try {
    gcloud run services update $ServiceName --region=$Region --set-env-vars="GCS_ASSETS_PREFIX=frontend-assets"
    Write-Host "✅ Cloud Run service updated" -ForegroundColor Green
} catch {
    Write-Host "❌ Cloud Run update failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Get service URL and test
Write-Host "🧪 Step 4: Testing deployment..." -ForegroundColor Cyan
try {
    $ServiceUrl = gcloud run services describe $ServiceName --region=$Region --format="value(status.url)"
    Write-Host "Service URL: $ServiceUrl"
    Write-Host ""
    
    # Test API health
    Write-Host "Testing API health endpoint..."
    $HealthResponse = Invoke-RestMethod -Uri "$ServiceUrl/api/health" -Method Get
    if ($HealthResponse.status -eq "healthy") {
        Write-Host "✅ API health endpoint responding" -ForegroundColor Green
    } else {
        Write-Host "❌ API health endpoint not responding" -ForegroundColor Red
    }
    
    # Test frontend
    Write-Host "Testing frontend..."
    $FrontendResponse = Invoke-WebRequest -Uri $ServiceUrl -Method Get
    if ($FrontendResponse.Content -match "html") {
        Write-Host "✅ Frontend serving HTML" -ForegroundColor Green
    } else {
        Write-Host "❌ Frontend not serving HTML" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Testing failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Frontend deployment completed!" -ForegroundColor Green
Write-Host "🌐 Service URL: $ServiceUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Visit the service URL to test the frontend"
Write-Host "  2. Check browser console for any errors"
Write-Host "  3. Test API endpoints at /api/*"
Write-Host "  4. Run: ./scripts/test-deployment.sh for comprehensive testing"
