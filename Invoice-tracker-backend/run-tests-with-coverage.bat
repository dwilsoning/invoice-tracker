@echo off
echo ============================================================
echo INVOICE TRACKER - TEST COVERAGE REPORT
echo ============================================================
echo.
echo Running all tests with coverage analysis...
echo.

call npm run test:coverage

if errorlevel 1 (
    echo.
    echo ERROR: Tests failed or npm not found!
    echo.
) else (
    echo.
    echo Coverage report generated in the 'coverage' folder!
    echo Open coverage/lcov-report/index.html in your browser to view.
)

echo.
echo ============================================================
echo Tests complete! Press any key to exit...
pause
