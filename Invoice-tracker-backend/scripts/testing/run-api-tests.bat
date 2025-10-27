@echo off
echo ============================================================
echo INVOICE TRACKER - API TESTS
echo ============================================================
echo.
echo NOTE: Make sure the server is running on port 3001!
echo.
echo Starting API tests...
echo.

call npm run test:api

if errorlevel 1 (
    echo.
    echo ERROR: Tests failed or npm not found!
    echo.
)

echo.
echo ============================================================
echo Tests complete! Press any key to exit...
pause
