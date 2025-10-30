# Environment Variable Configuration Quick Reference

## Files That Need Updates When Adding Environment Variables

### 1. `infra/gcp/terraform.tfvars` (Primary Source)
```terraform
runtime_env = {
  # Add your variable here
  YOUR_NEW_VARIABLE = "your-value"
}
```

### 2. `worker-configuration.d.ts` (TypeScript Types)
```typescript
interface Env {
  // Add to Env interface
  YOUR_NEW_VARIABLE: string;
}

interface ProcessEnv extends StringifyValues<Pick<Cloudflare.Env, 
  // Add to ProcessEnv interface
  "YOUR_NEW_VARIABLE" | 
  // ... other properties
>> {}
```

### 3. `container/workerd/service.capnp` (Workerd Bindings)
```capnp
bindings = [
  // Add binding here
  (name = "YOUR_NEW_VARIABLE", fromEnvironment = "YOUR_NEW_VARIABLE"),
  // ... other bindings
]
```

### 4. Worker Code (Implementation)
```typescript
// Use the variable in your worker code
const myValue = env.YOUR_NEW_VARIABLE;
```

## Vite Frontend Build Variables

| Variable | Purpose | Notes |
|----------|---------|-------|
| `VITE_API_BASE_URL` | Explicit API origin for the SPA. | Optional. When unset, the frontend falls back to `window.location.origin`. Set when the UI is hosted on a different domain than the API service (e.g., custom preview domains). |
| `API_BASE_URL` | Runtime Cloud Run env used by the entrypoint to generate `__app_config__.js`. | Defaults to the control-plane Cloud Run host (`https://vibesdk-control-plane-<...>.run.app`). Override when serving the UI from a different API host. |

## Common Environment Variables

| Variable | Purpose | Required Files |
|----------|---------|----------------|
| `GCS_FRONTEND_BUCKET` | Frontend assets bucket | All 4 files |
| `GCS_TEMPLATES_BUCKET` | Templates storage bucket | All 4 files |
| `FIRESTORE_PROJECT_ID` | Firestore project ID | All 4 files |
| `FIRESTORE_COLLECTION` | Firestore collection name | All 4 files |
| `GCP_ACCESS_TOKEN` | Google Cloud access token | terraform.tfvars only |
| `CUSTOM_DOMAIN` | Service domain | terraform.tfvars only |

## Deployment Commands

```bash
# 1. Build and push Docker image
docker build -f container/Dockerfile.workerd -t us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest .
docker push us-central1-docker.pkg.dev/qfxcloud-app-builder/vibesdk/workerd:latest

# 2. Deploy with Terraform
cd infra/gcp
terraform apply -auto-approve

# 3. Configure permissions
gcloud run services add-iam-policy-binding vibesdk-control-plane --region=us-central1 --member=allUsers --role=roles/run.invoker

# 4. Test deployment
curl https://vibesdk-control-plane-2886014379.us-central1.run.app/debug-env
```

## Verification Checklist

- [ ] Root path returns HTML (200 OK)
- [ ] API health endpoint works (`/api/health`)
- [ ] Debug endpoint shows environment variables (`/debug-env`)
- [ ] CORS headers are present
- [ ] No authentication errors in logs
- [ ] Environment variables are correctly set
