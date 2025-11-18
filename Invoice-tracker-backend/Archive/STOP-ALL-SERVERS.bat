@echo off
echo ================================================
echo  Invoice Tracker - Stop All Servers
echo ================================================
echo.
echo Stopping all Invoice Tracker servers...
echo.

REM Kill any Node.js process running on port 3001
echo [1/3] Checking for processes on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Found process: %%a
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! == 0 (
        echo ✓ Stopped process %%a
    )
)

REM Kill any Node.js process with "server.js" or "server-postgres.js" in the command line
echo [2/3] Checking for server.js processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"server.js" >nul
    if !errorlevel! == 0 (
        echo Found server.js process: %%a
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! == 0 (
            echo ✓ Stopped server.js (PID: %%a)
        )
    )
)

echo [3/3] Checking for server-postgres.js processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"server-postgres.js" >nul
    if !errorlevel! == 0 (
        echo Found server-postgres.js process: %%a
        taskkill /F /PID %%a >nul 2>&1
        if !errorlevel! == 0 (
            echo ✓ Stopped server-postgres.js (PID: %%a)
        )
    )
)

echo.
echo ================================================
echo  All servers stopped!
echo ================================================
echo.

REM Verify port is free
netstat -aon | findstr :3001 | findstr LISTENING >nul 2>&1
if %errorlevel% == 0 (
    echo ⚠️  Warning: Port 3001 may still be in use
    echo    Run 'netstat -aon | findstr :3001' to check
) else (
    echo ✓ Port 3001 is now free
)

echo.
pause
