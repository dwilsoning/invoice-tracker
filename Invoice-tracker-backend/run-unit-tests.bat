@echo off
echo ============================================================
echo INVOICE TRACKER - UNIT TESTS
echo ============================================================
echo.
echo Running unit tests (PDF parsing, utilities)...
echo.

call npm run test:unit

if errorlevel 1 (
    echo.
    echo ERROR: Tests failed or npm not found!
    echo.
)

echo.
echo ============================================================
echo Tests complete! Press any key to exit...
pause
