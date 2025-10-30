@echo off
echo 🔄 Starting Vibesdk with REAL Production Services...

echo Step 1: Starting Cloud SQL Proxy...
start "Cloud SQL Proxy" cmd /k "gcloud sql connect vibesdk-sql --user=vibesdk-user --quiet"

timeout /t 5 /nobreak > nul

echo Step 2: Starting Backend Server...
start "Vibesdk Backend" cmd /k "npx tsx backend/hono-server.js"

timeout /t 3 /nobreak > nul

echo Step 3: Starting Frontend...
start "Vibesdk Frontend" cmd /k "npm run dev"

echo ✅ All services starting in separate windows... 
echo Close all 3 windows (Ctrl+C) when done.
pause
