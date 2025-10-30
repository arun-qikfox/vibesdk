#!/bin/bash

# VibeSDK GCP Deployment Script
# Following DEPLOYMENT_GUIDE.md step by step

set -e  # Exit on any error

echo "🚀 Starting VibeSDK GCP Deployment..."
echo "=================================="

# Step 0: GCP Authentication Setup
echo "Step 0: Setting up GCP authentication..."
gcloud auth login
gcloud config set project qfxcloud-app-builder

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable pubsub.googleapis.com

# Create service account if it doesn't exist
echo "Creating service account..."
gcloud iam service-accounts create vibesdk-runtime \
  --display-name="VibeSDK Runtime Service Account" \
  --description="Service account for VibeSDK runtime operations" \
  || echo "Service account already exists"

# Grant necessary roles
echo "Granting roles to service account..."
gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# Generate access token
echo "Generating access token..."
export GCP_ACCESS_TOKEN=$(gcloud auth print-access-token)
echo "Access token generated: ${GCP_ACCESS_TOKEN:0:20}..."

# Step 1: Build and Push Docker Image
echo "Step 1: Building and pushing Docker image..."
cd /home/arunr/projects/vibesdk

# Build the workerd runtime image
docker build -f container/Dockerfile.workerd -t us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:api-auth-rate-limit-fix .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:api-auth-rate-limit-fix

# Step 2: Update terraform.tfvars with access token
echo "Step 2: Updating Terraform configuration..."
cd infra/gcp

# Update the access token in terraform.tfvars
sed -i "s/GCP_ACCESS_TOKEN=.*/GCP_ACCESS_TOKEN=\"$GCP_ACCESS_TOKEN\"/" terraform.tfvars

# Step 3: Initialize Platform Configuration
echo "Step 3: Initializing platform configuration..."
cd ../..

# Upload platform configuration to GCS
gcloud storage cp platform_configs.json gs://vibesdk-frontend/kv/platform_configs

# Step 4: Deploy Infrastructure with Terraform
echo "Step 4: Deploying infrastructure with Terraform..."
cd infra/gcp

# Initialize Terraform
terraform init

# Apply Terraform configuration
terraform apply -auto-approve

# Step 5: Configure Service Permissions
echo "Step 5: Configuring service permissions..."

# Allow unauthenticated access
gcloud run services add-iam-policy-binding vibesdk-control-plane \
  --region=us-central1 \
  --member=allUsers \
  --role=roles/run.invoker

# Grant storage permissions
gcloud projects add-iam-policy-binding qfxcloud-app-builder \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

gcloud storage buckets add-iam-policy-binding gs://vibesdk-frontend \
  --member="serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Step 6: Verify Deployment
echo "Step 6: Verifying deployment..."

# Test service endpoints
echo "Testing root path..."
curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/ | head -5

echo "Testing API health endpoint..."
curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health

echo "Testing debug endpoint..."
curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env

echo "✅ Deployment completed successfully!"
echo "Service URL: https://vibesdk-control-plane-2886014379.us-central1.run.app"
echo "Debug URL: https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env"
