# Infrastructure provisioning
terraform -chdir=infra/gcp init
terraform -chdir=infra/gcp plan
terraform -chdir=infra/gcp apply

# Secret Manager population examples
printf '%s' 'your-jwt-secret' | gcloud secrets versions add JWT_SECRET --data-file=- --project=qfxcloud-app-builder
printf '%s' 'your-encryption-key' | gcloud secrets versions add SECRETS_ENCRYPTION_KEY --data-file=- --project=qfxcloud-app-builder
printf '%s' 'your-webhook-secret' | gcloud secrets versions add WEBHOOK_SECRET --data-file=- --project=qfxcloud-app-builder
printf '%s' 'your-gemini-key' | gcloud secrets versions add GOOGLE_AI_STUDIO_API_KEY --data-file=- --project=qfxcloud-app-builder
gcloud secrets versions add vibesdk-sql-connection-url --data-file=/path/to/connection-uri.txt --project=qfxcloud-app-builder

gcloud iam service-accounts add-iam-policy-binding vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com   --member="user:<your-email>" --role="roles/iam.serviceAccountTokenCreator"   --project=qfxcloud-app-builder

# Cloud Run verification
terraform -chdir=infra/gcp apply -target=module.runtime

gcloud run services describe vibesdk-control-plane   --project qfxcloud-app-builder   --region us-central1   --format='value(status.url,status.latestCreatedRevisionName,status.conditions)'

gcloud run services logs read vibesdk-control-plane   --project qfxcloud-app-builder   --region us-central1   --limit 100

# Identity token for API calls
TOKEN=$(gcloud auth print-identity-token \
  --impersonate-service-account=vibesdk-runtime@qfxcloud-app-builder.iam.gserviceaccount.com \
  --audiences=https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app)

curl -H "Authorization: Bearer $TOKEN" \
     https://vibesdk-control-plane-2pklfi2owa-uc.a.run.app/api/templates

# Template sync to GCS
gsutil -m rsync -r -d -x "\.git.*" ./templates gs://vibesdk-templates
