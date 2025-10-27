@echo off
echo ========================================
echo Setup Daily Automatic Database Backup
echo ========================================
echo.
echo This will create a Windows Task Scheduler task to backup
echo the database daily at 2:00 AM.
echo.
pause

set BACKEND_DIR=%~dp0
set BACKUP_SCRIPT=%BACKEND_DIR%scripts\backup\backup-postgres.js

echo Creating scheduled task...
echo.
echo Task will run: node "%BACKUP_SCRIPT%"
echo.

schtasks /Create /TN "Invoice Tracker - Daily Backup" /TR "node \"%BACKUP_SCRIPT%\"" /SC DAILY /ST 02:00 /F /RL HIGHEST /SD 01/01/2025

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✓ Daily backup task created successfully!
    echo ========================================
    echo.
    echo Task Name: Invoice Tracker - Daily Backup
    echo Schedule:  Daily at 2:00 AM
    echo.
    echo The backup will run automatically every day.
    echo Backups are stored in: %BACKEND_DIR%backups
    echo Backups older than 30 days are automatically deleted.
    echo.
    echo To view the task:
    echo   schtasks /Query /TN "Invoice Tracker - Daily Backup"
    echo.
    echo To disable the task:
    echo   schtasks /Change /TN "Invoice Tracker - Daily Backup" /DISABLE
    echo.
    echo To delete the task:
    echo   schtasks /Delete /TN "Invoice Tracker - Daily Backup" /F
    echo.
) else (
    echo.
    echo ========================================
    echo ✗ Failed to create scheduled task
    echo ========================================
    echo.
    echo Please run this script as Administrator.
    echo Right-click and select "Run as administrator"
    echo.
)

pause
