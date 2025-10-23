@echo off
echo Starting Invoice Tracker...
echo.

REM Start Backend Server (minimized)
echo Starting Backend Server...
start /min "Invoice Tracker - Backend" cmd /k "cd /d "C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend" && npm start"

REM Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

REM Start Frontend Server (minimized)
echo Starting Frontend Server...
start /min "Invoice Tracker - Frontend" cmd /k "cd /d "C:\Users\dwils\Claude-Projects\Invoice Tracker\invoice-tracker-frontend" && npm run dev"

echo.
echo Both servers are starting in minimized windows...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo The server windows are running minimized in the taskbar.
echo Close this window when you're done.
pause
