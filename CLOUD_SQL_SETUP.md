# Cloud SQL Setup for Local Development

Your Cloud SQL instance: `qfxcloud-app-builder:us-central1:vibesdk-sql`

## 🔧 Cloud SQL Connection Options

### Option 1: Cloud SQL Proxy (RECOMMENDED for Local Development)

The Cloud SQL proxy establishes a secure tunnel and doesn't require SSL certificates.

#### Step 1: Download Cloud SQL Proxy
```bash
# For Windows:
curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/latest/cloud-sql-proxy.exe

# Or use gcloud:
gcloud components install cloud-sql-proxy
```

#### Step 2: Authenticate (one time)
```bash
gcloud auth login
gcloud config set project qfxcloud-app-builder
```

#### Step 3: Start the Proxy
```bash
# Option A: Using gcloud (easier)
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Option B: Using cloud-sql-proxy directly
./cloud-sql-proxy qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432
```

#### Step 4: Keep Proxy Running
Once started, your database is accessible at:
- **Host**: `127.0.0.1`
- **Port**: `5432`
- **Database**: `vibesdk-db`
- **User**: `vibesdk-user` (no password needed with proxy)

### Option 2: Get Direct Connection String

#### Method A: From GCP Console
1. Go to Cloud SQL → Instances → vibesdk-sql
2. **Connections** tab → **Connectivity** → **Public IP**
3. Copy the connection string: `postgresql://vibesdk-user:YOUR_PASSWORD@PUBLIC_IP:5432/vibesdk-db`

#### Method B: Using gcloud
```bash
# Get instance details
gcloud sql instances describe vibesdk-sql --project=qfxcloud-app-builder

# Get connection name (should match your existing: qfxcloud-app-builder:us-central1:vibesdk-sql)
gcloud sql instances describe vibesdk-sql --project=qfxcloud-app-builder --format="value(connectionName)"
```

### Option 3: SSL Certificate Connection

If you need direct SSL connection (not recommended for local dev), download the client certificates from GCP Cloud SQL console.

## 🚀 Run Your Application

```bash
# Terminal 1: Start Cloud SQL Proxy
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Keep proxy running, then start backend in Terminal 2:
npx tsx backend/hono-server.js

# Start frontend in Terminal 3:
npm run dev
```

## 🔍 Verify Connection

Test your database connection:
```bash
# From the Cloud SQL proxy terminal (when running):
# Connection should show: "Connection established successfully"

# Or test with psql:
psql "postgresql://vibesdk-user@127.0.0.1:5432/vibesdk-db"
```

## 📋 Required Database Information

You'll need:
- **Database Name**: `vibesdk-db`
- **Username**: `vibesdk-user`
- **Password**: Ask DBA or check GCP Cloud SQL instance settings
- **SSL Mode**: `require` or `disable` (depending on connection method)

## ⚡ Environment Variables Already Set

Your `.env` file already has:
```env
GCP_PROJECT_ID=qfxcloud-app-builder
DATABASE_URL=postgresql://vibesdk-user@127.0.0.1:5432/vibesdk-db?sslmode=require
```

**Just start the Cloud SQL proxy and run your backend!** 🎯
