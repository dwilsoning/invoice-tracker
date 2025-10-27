@echo off
echo ============================================================
echo INVOICE TRACKER - TEST SUITE
echo ============================================================
echo.
echo Running all tests...
echo.

call npm test

if errorlevel 1 (
    echo.
    echo ERROR: Tests failed or npm not found!
    echo Please make sure you have run 'npm install' first.
    echo.
)

echo.
echo ============================================================
echo Tests complete! Press any key to exit...
pause
