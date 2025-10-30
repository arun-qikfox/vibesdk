@echo off
echo VibeSDK GCP Deployment Script
echo Following DEPLOYMENT_GUIDE.md step by step
echo ==================================

REM Step 0: GCP Authentication Setup
echo Step 0: Setting up GCP authentication...
wsl -d Ubuntu -e bash -c "gcloud auth login"
wsl -d Ubuntu -e bash -c "gcloud config set project qfxcloud-app-builder"

REM Enable required APIs
echo Enabling required APIs...
wsl -d Ubuntu -e bash -c "gcloud services enable cloudbuild.googleapis.com run.googleapis.com storage.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com pubsub.googleapis.com"

REM Create service account if it doesn't exist
echo Creating service account...
wsl -d Ubuntu -e bash -c "gcloud iam service-accounts create vibesdk-runtime --display-name='VibeSDK Runtime Service Account' --description='Service account for VibeSDK runtime operations' || echo 'Service account already exists'"

REM Grant necessary roles
echo Granting roles to service account...
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/run.invoker'"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/secretmanager.secretAccessor'"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/storage.objectAdmin'"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/iam.serviceAccountTokenCreator'"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/cloudsql.client'"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/pubsub.publisher'"

REM Generate access token
echo Generating access token...
for /f "tokens=*" %%i in ('wsl -d Ubuntu -e bash -c "gcloud auth print-access-token"') do set GCP_ACCESS_TOKEN=%%i
echo Access token generated: %GCP_ACCESS_TOKEN:~0,20%...

REM Step 1: Build and Push Docker Image
echo Step 1: Building and pushing Docker image...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk && docker build -f container/Dockerfile.workerd -t us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:api-auth-rate-limit-fix ."
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk && docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:api-auth-rate-limit-fix"

REM Step 2: Update terraform.tfvars with access token
echo Step 2: Updating Terraform configuration...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && sed -i 's/GCP_ACCESS_TOKEN=.*/GCP_ACCESS_TOKEN=\"%GCP_ACCESS_TOKEN%\"/' terraform.tfvars"

REM Step 3: Initialize Platform Configuration
echo Step 3: Initializing platform configuration...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk && gcloud storage cp platform_configs.json gs://vibesdk-frontend/kv/platform_configs"

REM Step 4: Deploy Infrastructure with Terraform
echo Step 4: Deploying infrastructure with Terraform...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && terraform init"
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && terraform apply -auto-approve"

REM Step 5: Configure Service Permissions
echo Step 5: Configuring service permissions...
wsl -d Ubuntu -e bash -c "gcloud run services add-iam-policy-binding vibesdk-control-plane --region=us-central1 --member=allUsers --role=roles/run.invoker"
wsl -d Ubuntu -e bash -c "gcloud projects add-iam-policy-binding qfxcloud-app-builder --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/storage.objectViewer'"
wsl -d Ubuntu -e bash -c "gcloud storage buckets add-iam-policy-binding gs://vibesdk-frontend --member='serviceAccount:vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com' --role='roles/storage.objectAdmin'"

REM Step 6: Verify Deployment
echo Step 6: Verifying deployment...
echo Testing root path...
wsl -d Ubuntu -e bash -c "curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/ | head -5"
echo Testing API health endpoint...
wsl -d Ubuntu -e bash -c "curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/api/health"
echo Testing debug endpoint...
wsl -d Ubuntu -e bash -c "curl -s https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env"

echo ✅ Deployment completed successfully!
echo Service URL: https://vibesdk-control-plane-2886014379.us-central1.run.app
echo Debug URL: https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env
pause
