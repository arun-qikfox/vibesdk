# Vibesdk Local Development Setup

This guide covers everything needed to run Vibesdk locally with your GCP production services (Cloud SQL, Firestore, GCS).

To run the proxy for google cloud sql
download cloud-sql-proxy.x64.exe from google site `https://docs.cloud.google.com/sql/docs/mysql/connect-auth-proxy#windows-64-bit`
Run the local using
`cloud-sql-proxy.x64.exe  qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432`
Note: Add --private-ip if public IP is disabled and running from Compute engine / VM environment. For local machine enable public IP and remove the --private-ip flag.

Server Start 
go inside backend directory and run  `npx tsx watch hono-server.js`

Frontend: 
from root directory run `npm run dev:win`
For powershell run `npm run dev`

To start full stack 
`npm run dev:full:win`
for other than windows  run `npm run dev:full`

Ref package.json for more details and commands


## 🎯 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment (already configured)
# .env file created with your GCP settings

# 3. Start Cloud SQL proxy (Use proxy for IPv6 networks)
curl -L https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy-x64.exe -o cloud-sql-proxy.exe
./cloud-sql-proxy.exe qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432

# 4. Start backend (Terminal 2)
npx tsx backend/hono-server.js

# 5. Start frontend (Terminal 3)
npm run dev
```

## 🔧 Prerequisites

### Required Tools
- Node.js 18+ and npm
- Google Cloud SDK (`gcloud`)
- Cloud SQL proxy (will be downloaded/setup)

### GCP Configuration
- **Project**: `qfxcloud-app-builder`
- **Cloud SQL**: `qfxcloud-app-builder:us-central1:vibesdk-sql`
- **Database**: `vibesdk-db`
- **User**: `vibesdk-user`
- **Region**: `us-central1`

## 📋 Step-by-Step Setup

### Step 1: Project Setup

```bash
# Clone and enter project
cd c:/arunrajesh/personal/experiments/vibesdk-main

# Install dependencies
npm install
```

### Step 2: Environment Configuration

Environment variables are already configured in `.env`:
- ✅ GCP project ID set
- ✅ Database URL configured for Cloud SQL proxy
- ✅ Authentication secrets generated
- ✅ Storage configurations ready

### Step 3: GCP Authentication

```bash
# Authenticate with GCP (one time)
gcloud auth login
gcloud auth application-default login

# Set project
gcloud config set project qfxcloud-app-builder
```

### Step 4: Database Connection (Cloud SQL Proxy)

```bash
# Method 1: Using gcloud (Recommended)
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Method 2: Using Cloud SQL proxy directly
# Download: https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/latest/cloud-sql-proxy.exe
./cloud-sql-proxy qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432

# Method 3: Direct connection (get from GCP console)
# Go to: Cloud SQL → Instances → vibesdk-sql → Connections → Security
```

**Keep proxy running in background - database accessible at `127.0.0.1:5432`**

### Step 5: Start Services

#### Option A: Manual Start (3 Terminals)

```bash
# Terminal 1: Cloud SQL Proxy (if not using gcloud method)
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Terminal 2: Backend API Server
npx tsx backend/hono-server.js

# Terminal 3: Frontend Development Server
npm run dev
```

#### Option B: Combined Frontend + Backend

```bash
# Terminal 1: Cloud SQL Proxy
gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet

# Terminal 2: Both frontend and backend
npm run dev:with-api
```

### Step 6: Verify Setup

**Backend Health Check:**
```bash
curl http://localhost:3001/health

# Should return:
# {"status":"healthy","timestamp":"2025-01-28T...","platform":"nodejs",...}
```

**API Test:**
```bash
curl http://localhost:3001/api/status
```

**Frontend Test:**
- Open `http://localhost:5173`
- Should show Vibesdk app without connection errors

## 🔍 Troubleshooting

### "ECONNREFUSED" Errors
- **Backend not running**: Start with `npx tsx backend/hono-server.js`
- **Proxy not running**: `gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet`

### Database Connection Issues
- **Proxy not authenticated**: Run `gcloud auth login`
- **Wrong instance**: Verify `qfxcloud-app-builder:us-central1:vibesdk-sql`
- **Test connection**: `psql "postgresql://vibesdk-user@127.0.0.1:5432/vibesdk-db"`

### Cloud SQL Proxy Issues

#### "The system cannot execute the specified program"
- **Download via PowerShell** (preferred for Windows):
  ```powershell
  # Open PowerShell as Administrator
  Invoke-WebRequest -Uri "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy-x64.exe" -OutFile "cloud-sql-proxy.exe"
  ```

- **Manual download**: Visit https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest and download cloud-sql-proxy-x64.exe manually

- **Antivirus blocked**: Temporarily disable antivirus or add exception for the file

#### "Access denied" or "Permission denied"
- **Run as Administrator**: Right-click Command Prompt → "Run as Administrator"
- **File permissions**: Right-click cloud-sql-proxy.exe → Properties → Unblock

#### "IPv6 network not supported"
- **Use proxy instead of gcloud**: `gcloud sql connect` doesn't support IPv6
- **Solution above**: Use downloaded proxy directly

### GCP Permission Issues
- **Firestore access**: Service account needs Datastore permissions
- **GCS access**: Service account needs Storage permissions
- **SQL access**: User `vibesdk-user` needs database permissions

### Common Port Conflicts
- **Port 3001 busy**: Change in `.env` with `PORT=3002`
- **Port 5173 busy**: Vite will auto-increment (runs on 5174)

## 📚 Configuration Files

- **`.env`**: Environment variables (created)
- **`CLOUD_SQL_SETUP.md`**: Detailed database setup
- **`tsconfig.nodejs.json`**: TypeScript compiler for backend
- **`package.json`**: Scripts for development

## 🚀 Production VS Local

| Service | Local | Production |
|---------|--------|------------|
| Database | Cloud SQL proxy | Direct Cloud SQL connection |
| Storage | GCS | GCS |
| Cache | Firestore | Firestore |
| Auth | JWT + Session | JWT + Session |

## 🎉 You're Ready!

Once all services are running:
- ✅ Frontend: `http://localhost:5173`
- ✅ Backend: `http://localhost:3001`
- ✅ Database: Connected via Cloud SQL proxy
- ✅ Storage: Connected to GCS buckets
- ✅ Cache: Connected to Firestore

**Your Vibesdk application now runs locally with full production services!** 🎯
