@echo off
echo ============================================================
echo INVOICE TRACKER - INTEGRATION TESTS
echo ============================================================
echo.
echo NOTE: Make sure the server is running on port 3001!
echo.
echo Running integration tests (complete workflows)...
echo.

call npm run test:integration

if errorlevel 1 (
    echo.
    echo ERROR: Tests failed or npm not found!
    echo.
)

echo.
echo ============================================================
echo Tests complete! Press any key to exit...
pause
