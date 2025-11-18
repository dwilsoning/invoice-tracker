@echo off
echo ========================================
echo PostgreSQL Database Backup
echo ========================================
echo.

cd /d "%~dp0"
node scripts/backup/backup-postgres.js

echo.
pause
