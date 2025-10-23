@echo off
echo Stopping Invoice Tracker servers...
echo.

REM Kill all Node.js processes (this will stop both frontend and backend)
echo Stopping Node.js processes...
taskkill /IM node.exe /F /T >nul 2>&1

REM Wait a moment for processes to terminate
timeout /t 1 /nobreak >nul

REM Verify they're stopped
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I /N "node.exe">nul
if "%ERRORLEVEL%"=="0" (
    echo Warning: Some Node.js processes may still be running.
    echo Attempting force kill...
    wmic process where "name='node.exe'" delete >nul 2>&1
) else (
    echo All Node.js processes stopped successfully.
)

echo.
echo Invoice Tracker servers stopped.
echo.
echo This window will close in 3 seconds...
timeout /t 3 /nobreak >nul
