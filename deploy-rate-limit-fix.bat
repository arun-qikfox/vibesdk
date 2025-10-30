@echo off
echo Building and deploying VibSDK with rate limit fixes...

echo Step 1: Building Docker image...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk && gcloud builds submit --config cloudbuild/workerd-deploy.yaml"

echo Step 2: Deploying with Terraform...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && terraform init"
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && terraform plan"
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk/infra/gcp && terraform apply -auto-approve"

echo Step 3: Initializing platform configuration...
wsl -d Ubuntu -e bash -c "cd /home/arunr/projects/vibesdk && npm run init-platform-config"

echo Step 4: Verifying deployment...
wsl -d Ubuntu -e bash -c "curl https://vibesdk-control-plane-2886014379.us-central1.run.app/health"

echo Deployment complete!
pause
