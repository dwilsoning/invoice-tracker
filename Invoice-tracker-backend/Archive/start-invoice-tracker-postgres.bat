@echo off
REM =============================================================================
REM Invoice Tracker - Start Script (PostgreSQL Version)
REM =============================================================================
REM This script starts both the backend (PostgreSQL) and frontend servers
REM Press Ctrl+C to stop both servers
REM =============================================================================

echo.
echo ========================================
echo Invoice Tracker (PostgreSQL Version)
echo ========================================
echo.
echo Starting Invoice Tracker with PostgreSQL database...
echo.

REM Set the backend directory path
set BACKEND_DIR=C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend

REM Change to backend directory
cd /d "%BACKEND_DIR%"
echo Backend directory: %CD%
echo.

REM Check if PostgreSQL is running
echo [1/3] Checking PostgreSQL connection...
node -e "const {pool} = require('./db-postgres.js'); pool.query('SELECT NOW()', (err) => { if(err) { console.error('ERROR: PostgreSQL not connected!'); console.error(err.message); process.exit(1); } else { console.log('PostgreSQL is connected.'); } pool.end(); })"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Cannot connect to PostgreSQL!
    echo Please ensure PostgreSQL is running and .env is configured correctly.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting Backend Server (PostgreSQL)...
start "Invoice Tracker Backend (PostgreSQL)" cmd /k "cd /d "%BACKEND_DIR%" && node server-postgres.js"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Server...
set FRONTEND_DIR=C:\Users\dwils\Claude-Projects\Invoice Tracker\invoice-tracker-frontend
cd /d "%FRONTEND_DIR%"
start "Invoice Tracker Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo ========================================
echo Invoice Tracker Started Successfully!
echo ========================================
echo.
echo Backend (PostgreSQL): http://localhost:3001
echo Frontend:             http://localhost:5173
echo.
echo Two command windows have been opened:
echo   1. Backend Server (PostgreSQL) - DO NOT CLOSE
echo   2. Frontend Server (Vite) - DO NOT CLOSE
echo.
echo To stop the servers:
echo   - Close both command windows
echo   - OR press Ctrl+C in each window
echo.
echo This window can be safely closed.
echo.
pause
