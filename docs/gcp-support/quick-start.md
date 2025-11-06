# GCP App Engine Quick Start Guide

Quick reference guide for setting up and using GCP App Engine deployment.

## 🚀 Quick Setup (5 Minutes)

### 1. Enable App Engine API
```bash
# Via Console
# Go to: https://console.cloud.google.com/apis/library
# Search: "App Engine Admin API"
# Click: Enable
```

### 2. Create Service Account
```bash
# Via Console
# Go to: IAM & Admin → Service Accounts
# Click: Create Service Account
# Name: vibesdk-deployer
# Roles: App Engine Admin, Cloud Storage Admin, Service Account User
```

### 3. Download and Encode Key
```bash
# Download JSON key from service account
# Encode to base64:
cat service-account-key.json | base64 -w 0  # Linux
# OR
[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))  # PowerShell
```

### 4. Set Environment Variables
```bash
# Set Project ID
wrangler secret put GOOGLE_CLOUD_PROJECT_ID
# Enter: your-project-id

# Set Service Account Key
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
# Paste: base64-encoded-key

# Set Default Target (optional, defaults to app_engine)
# Add to wrangler.jsonc:
# "vars": { "DEFAULT_DEPLOYMENT_TARGET": "app_engine" }
```

### 5. Deploy!
Your next application deployment will automatically use App Engine if `DEFAULT_DEPLOYMENT_TARGET` is set to `app_engine`.

## ✅ Verification Checklist

- [ ] App Engine Admin API enabled
- [ ] Service account created with required roles
- [ ] Service account key downloaded and encoded
- [ ] `GOOGLE_CLOUD_PROJECT_ID` set
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` set as secret
- [ ] `DEFAULT_DEPLOYMENT_TARGET` set (optional)
- [ ] Test deployment successful

## 🔗 Next Steps

- Read [Architecture](./architecture.md) for detailed flow
- Check [Rules](./rules.md) for decision criteria
- Review [Environment Variables](./environment-variables.md) for full setup

