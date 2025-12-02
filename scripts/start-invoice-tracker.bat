@echo off
setlocal enabledelayedexpansion

echo ================================================
echo  Invoice Tracker - Start Servers
echo ================================================
echo.

REM Step 1: Stop any existing servers
echo [1/4] Stopping any existing servers...
echo.

REM Kill any Node.js process running on port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING 2^>nul') do (
    echo Found process on port 3001: %%a
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! == 0 (
        echo   ✓ Stopped process %%a
    )
)

REM Kill any server.js or server-postgres.js processes
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr /C:"PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"server.js\|server-postgres.js" >nul 2>&1
    if !errorlevel! == 0 (
        echo Found server process: %%a
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! == 0 (
            echo   ✓ Stopped server (PID: %%a)
        )
    )
)

REM Kill any Vite dev server processes (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    echo Found process on port 5173: %%a
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! == 0 (
        echo   ✓ Stopped process %%a
    )
)

echo.

REM Step 2: Validate ports are free
echo [2/4] Validating ports are free...
echo.

set "port3001_free=1"
set "port5173_free=1"

netstat -aon | findstr :3001 | findstr LISTENING >nul 2>&1
if !errorlevel! == 0 (
    set "port3001_free=0"
    echo   ⚠️  WARNING: Port 3001 still in use!
) else (
    echo   ✓ Port 3001 is free
)

netstat -aon | findstr :5173 | findstr LISTENING >nul 2>&1
if !errorlevel! == 0 (
    set "port5173_free=0"
    echo   ⚠️  WARNING: Port 5173 still in use!
) else (
    echo   ✓ Port 5173 is free
)

if !port3001_free! == 0 (
    echo.
    echo ❌ ERROR: Port 3001 is still in use. Cannot start backend.
    echo    Please manually check: netstat -aon ^| findstr :3001
    echo.
    pause
    exit /b 1
)

if !port5173_free! == 0 (
    echo.
    echo ❌ ERROR: Port 5173 is still in use. Cannot start frontend.
    echo    Please manually check: netstat -aon ^| findstr :5173
    echo.
    pause
    exit /b 1
)

echo.

REM Step 3: Start Backend Server
echo [3/4] Starting Backend Server...
start /min "Invoice Tracker - Backend" cmd /k "cd /d \"C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend\" && npm run dev"

REM Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

echo   ✓ Backend server started
echo.

REM Step 4: Start Frontend Server
echo [4/4] Starting Frontend Server...
start /min "Invoice Tracker - Frontend" cmd /k "cd /d "C:\Users\dwils\Claude-Projects\Invoice Tracker\invoice-tracker-frontend" && npm run dev"

echo   ✓ Frontend server started
echo.

echo ================================================
echo  Both servers are running!
echo ================================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo The server windows are running minimized in the taskbar.
echo Close this window when you're done.
echo.
pause
