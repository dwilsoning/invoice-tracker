@echo off
echo.
echo ============================================================
echo ⚠️  DEPRECATION WARNING ⚠️
echo ============================================================
echo.
echo This script starts the OLD SQLite server (server.js)
echo which has been SUPERSEDED by PostgreSQL.
echo.
echo DO NOT USE THIS SCRIPT!
echo.
echo Please use: start-invoice-tracker-postgres.bat
echo.
echo This script is kept for reference only.
echo To revert to SQLite in the future (if needed), edit this file.
echo.
echo ============================================================
echo.
pause
exit /b 1

REM Uncomment below to allow starting SQLite server
REM echo.
REM echo Starting Invoice Tracker API on port 3001...
REM echo Database: SQLite (sql.js - cross-platform)
REM echo.
REM node server.js
