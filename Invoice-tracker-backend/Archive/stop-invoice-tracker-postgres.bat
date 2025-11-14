@echo off
REM =============================================================================
REM Invoice Tracker - Stop Script
REM =============================================================================
REM This script stops both the backend and frontend servers
REM =============================================================================

echo.
echo ========================================
echo Stopping Invoice Tracker
echo ========================================
echo.

echo Stopping Node.js servers (Backend)...
taskkill /FI "WINDOWTITLE eq Invoice Tracker Backend*" /T /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Backend server stopped.
) else (
    echo No backend server found running.
)

echo.
echo Stopping Vite servers (Frontend)...
taskkill /FI "WINDOWTITLE eq Invoice Tracker Frontend*" /T /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Frontend server stopped.
) else (
    echo No frontend server found running.
)

echo.
echo Cleaning up any remaining Node.js processes on ports 3001 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul

echo.
echo ========================================
echo Invoice Tracker Stopped
echo ========================================
echo.
pause
