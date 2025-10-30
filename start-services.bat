@echo off
echo 🎯 Vibesdk Local Development Startup

echo Step 1: Downloading Cloud SQL Proxy...
if not exist cloud-sql-proxy.exe (
    echo Downloading via PowerShell...
    powershell -Command "Invoke-WebRequest -Uri 'https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy-x64.exe' -OutFile 'cloud-sql-proxy.exe'"
    echo ✅ Cloud SQL Proxy downloaded
) else (
    echo ✅ Cloud SQL Proxy already exists
)

echo.
echo Step 2: Starting Cloud SQL Proxy... (Terminal 1)
echo Connection: qfxcloud-app-builder:us-central1:vibesdk-sql
echo Command: ./cloud-sql-proxy.exe qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432
start "Cloud SQL Proxy" cmd /k "./cloud-sql-proxy.exe qfxcloud-app-builder:us-central1:vibesdk-sql --port 5432"

timeout /t 3 /nobreak > nul

echo.
echo Step 3: Starting Backend Server... (Terminal 2)
echo Command: npx tsx backend/hono-server.js
start "Vibesdk Backend" cmd /k "npx tsx backend/hono-server.js"

timeout /t 3 /nobreak > nul

echo.
echo Step 4: Starting Frontend... (Terminal 3)
echo Command: npm run dev
start "Vibesdk Frontend" cmd /k "npm run dev"

echo.
echo ✅ SUCCESS! All services starting...
echo.
echo 📋 SERVICE ENDPOINTS:
echo 🔵 Frontend: http://localhost:5173
echo 🔴 Backend:  http://localhost:3001
echo 🗄️  Database: localhost:5432 (via proxy)
echo.
echo 🔍 TO TEST CONNECTION:
echo curl http://localhost:3001/health
echo curl http://localhost:3001/api/status
echo.
echo Close all terminal windows (Ctrl+C) when done.
pause
