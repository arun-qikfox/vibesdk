# GCP App Engine Environment Variables

This document lists all environment variables required for Google App Engine deployment support.

## 🔑 Required Variables

### Core GCP Configuration

#### `GOOGLE_CLOUD_PROJECT_ID` (Required)
- **Type**: String
- **Description**: Your Google Cloud Project ID
- **Example**: `my-awesome-project-123456`
- **Where to Find**: [Google Cloud Console](https://console.cloud.google.com) → Project Settings → Project ID
- **Set As**: Regular environment variable or in `wrangler.jsonc` vars
- **Usage**: Used in deployment URL generation and gcloud commands

#### `GOOGLE_SERVICE_ACCOUNT_KEY` (Required)
- **Type**: String (Base64-encoded JSON)
- **Description**: Service account key file content, base64-encoded
- **Format**: Base64-encoded JSON string
- **Required Permissions**:
  - `roles/appengine.admin` (App Engine Admin)
  - `roles/storage.admin` (Cloud Storage Admin)
  - `roles/iam.serviceAccountUser` (Service Account User)
- **Set As**: Worker Secret (sensitive data)
- **Command**: `wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY`
- **Usage**: Used for gcloud CLI authentication during deployment

#### `DEFAULT_DEPLOYMENT_TARGET` (Optional)
- **Type**: String
- **Values**: `'cloudflare'` | `'app_engine'`
- **Default**: `'app_engine'` (if not set)
- **Description**: Default deployment target for generated applications
- **Set As**: Regular environment variable or in `wrangler.jsonc` vars
- **Usage**: Determines which deployment path to use

## 📋 Setup Instructions

### Step 1: Get Google Cloud Project ID

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select or create a project
3. Copy the **Project ID** (not Project Name)
4. Set as environment variable:
   ```bash
   wrangler secret put GOOGLE_CLOUD_PROJECT_ID
   # Enter your project ID when prompted
   ```

### Step 2: Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name: `vibesdk-deployer` (or your preferred name)
4. Click **Create and Continue**

### Step 3: Grant Permissions

Grant these roles to your service account:
- **App Engine Admin** (`roles/appengine.admin`)
- **Cloud Storage Admin** (`roles/storage.admin`)
- **Service Account User** (`roles/iam.serviceAccountUser`)

### Step 4: Create and Download Key

1. Select your service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the JSON file

### Step 5: Encode Service Account Key

**Linux/macOS:**
```bash
cat path/to/service-account-key.json | base64 -w 0
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\service-account-key.json"))
```

**macOS (alternative):**
```bash
base64 -i path/to/service-account-key.json -o - | tr -d '\n'
```

### Step 6: Set Environment Variables

#### For Cloudflare Workers (Production)

**Set Project ID:**
```bash
wrangler secret put GOOGLE_CLOUD_PROJECT_ID
# Paste: my-awesome-project-123456
```

**Set Service Account Key (as secret):**
```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Paste the base64-encoded JSON key
```

**Set Default Deployment Target (optional):**
Add to `wrangler.jsonc`:
```json
{
  "vars": {
    "DEFAULT_DEPLOYMENT_TARGET": "app_engine"
  }
}
```

#### For Local Development (.dev.vars)

```bash
GOOGLE_CLOUD_PROJECT_ID=my-awesome-project-123456
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded-json-key>
DEFAULT_DEPLOYMENT_TARGET=app_engine
```

#### For Production (.prod.vars)

```bash
GOOGLE_CLOUD_PROJECT_ID=my-awesome-project-123456
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded-json-key>
DEFAULT_DEPLOYMENT_TARGET=app_engine
```

## 🔒 Security Best Practices

### ✅ Do:
- **Use Worker Secrets** for `GOOGLE_SERVICE_ACCOUNT_KEY` in production
- **Rotate keys regularly** (every 90 days recommended)
- **Limit permissions** to only what's needed
- **Use separate service accounts** for dev/staging/production
- **Never commit** keys to version control
- **Monitor key usage** in Google Cloud Console

### ❌ Don't:
- **Don't commit** service account keys to git
- **Don't share** keys between environments
- **Don't use** overly permissive roles
- **Don't hardcode** keys in source code
- **Don't expose** keys in logs or error messages

## 🔍 Verification

### Check Environment Variables

**In Cloudflare Workers:**
```bash
# Check if variables are set (won't show values)
wrangler secret list
```

**In Local Development:**
```bash
# Check .dev.vars file
cat .dev.vars | grep GOOGLE
```

### Test Deployment

1. Create a test application
2. Trigger deployment
3. Check logs for authentication success
4. Verify deployment URL is accessible

## 🐛 Troubleshooting

### Error: "GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_KEY must be set"
- **Solution**: Verify both variables are set correctly
- **Check**: Use `wrangler secret list` to verify secrets are set
- **Verify**: Check `.dev.vars` or `.prod.vars` for local testing

### Error: "Failed to authenticate gcloud"
- **Solution**: Verify service account key is correctly base64-encoded
- **Check**: Decode and verify JSON structure: `echo $KEY | base64 -d | jq`
- **Verify**: Key hasn't expired or been revoked
- **Check**: Service account has required permissions

### Error: "App Engine API not enabled"
- **Solution**: Enable App Engine Admin API
- **Steps**:
  1. Go to [APIs & Services](https://console.cloud.google.com/apis/library)
  2. Search for "App Engine Admin API"
  3. Click **Enable**
  4. Wait a few minutes for activation

### Error: "Insufficient permissions"
- **Solution**: Verify service account roles
- **Required Roles**:
  - App Engine Admin
  - Cloud Storage Admin
  - Service Account User
- **Check**: IAM & Admin → Service Accounts → Your Account → Permissions

## 📊 Variable Reference Table

| Variable | Type | Required | Sensitive | Set As |
|----------|------|----------|-----------|--------|
| `GOOGLE_CLOUD_PROJECT_ID` | String | ✅ Yes | ❌ No | Env var or wrangler.jsonc |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | String (Base64) | ✅ Yes | ✅ Yes | Worker Secret |
| `DEFAULT_DEPLOYMENT_TARGET` | String | ❌ No | ❌ No | Env var or wrangler.jsonc |

## 🔄 Variable Priority

Environment variables are resolved in this order (highest to lowest):
1. **Worker Secrets** (via `wrangler secret put`)
2. **Environment Variables** (from `.dev.vars` or `.prod.vars`)
3. **wrangler.jsonc vars**
4. **Default values** (defined in code)

## 📝 Example Configuration

### Complete .dev.vars Example
```bash
# GCP App Engine Configuration
GOOGLE_CLOUD_PROJECT_ID=my-project-123456
GOOGLE_SERVICE_ACCOUNT_KEY=eyJ0eXAiOiJKV1QiLCJhbGc... # (base64-encoded JSON)
DEFAULT_DEPLOYMENT_TARGET=app_engine

# Other existing variables...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
# ... etc
```

### Complete wrangler.jsonc Example
```jsonc
{
  "vars": {
    "DEFAULT_DEPLOYMENT_TARGET": "app_engine",
    "GOOGLE_CLOUD_PROJECT_ID": "my-project-123456"
    // Note: GOOGLE_SERVICE_ACCOUNT_KEY should be set as secret, not here
  }
}
```

## 🔗 Related Documentation

- [Architecture](./architecture.md) - How these variables are used
- [Rules](./rules.md) - When to use GCP deployment
- [Phases](./phases.md) - Implementation roadmap

