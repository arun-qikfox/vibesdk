#!/bin/bash

echo "Building and deploying VibSDK with rate limit fixes..."

echo "Step 1: Building Docker image..."
gcloud builds submit --config cloudbuild/workerd-deploy.yaml

echo "Step 2: Deploying with Terraform..."
cd infra/gcp
terraform init
terraform plan
terraform apply -auto-approve

echo "Step 3: Initializing platform configuration..."
cd ../..
npm run init-platform-config

echo "Step 4: Verifying deployment..."
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/health

echo "Deployment complete!"
