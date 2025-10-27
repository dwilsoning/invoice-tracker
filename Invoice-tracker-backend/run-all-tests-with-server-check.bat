@echo off
echo ============================================================
echo INVOICE TRACKER - COMPLETE TEST SUITE
echo ============================================================
echo.
echo Checking if server is running on port 3001...
echo.

REM Check if server is running using curl or PowerShell
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/api/invoices' -TimeoutSec 2 -UseBasicParsing; Write-Host 'Server is running!' -ForegroundColor Green; exit 0 } catch { Write-Host 'Server is NOT running!' -ForegroundColor Red; exit 1 }" 2>nul

if errorlevel 1 (
    echo.
    echo ============================================================
    echo WARNING: Server is not running!
    echo ============================================================
    echo.
    echo API and Integration tests will fail without the server.
    echo.
    echo To start the server, open a new command prompt and run:
    echo   cd C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend
    echo   npm start
    echo.
    echo Would you like to:
    echo   1. Run UNIT tests only (no server required)
    echo   2. Run ALL tests anyway (many will fail)
    echo   3. Exit and start server first
    echo.
    choice /C 123 /N /M "Enter your choice (1, 2, or 3): "

    if errorlevel 3 goto :end
    if errorlevel 2 goto :runall
    if errorlevel 1 goto :unitonly
)

:runall
echo.
echo Running ALL tests...
echo.
call npm test
goto :done

:unitonly
echo.
echo Running UNIT tests only (PDF parsing, utilities)...
echo.
call npm run test:unit
goto :done

:done
echo.
echo ============================================================
echo Tests complete!
echo.
echo To view a detailed HTML report, run:
echo   run-tests-with-coverage.bat
echo.
echo ============================================================
pause
goto :end

:end
