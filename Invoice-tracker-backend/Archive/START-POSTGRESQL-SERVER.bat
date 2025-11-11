@echo off
echo ================================================
echo  Invoice Tracker - PostgreSQL Server
echo ================================================
echo.
echo Starting PostgreSQL backend server...
echo Server will run on http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo ================================================
echo.

cd /d "%~dp0"
node server-postgres.js

pause
