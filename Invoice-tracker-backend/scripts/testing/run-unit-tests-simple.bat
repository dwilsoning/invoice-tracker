@echo off
echo ============================================================
echo INVOICE TRACKER - UNIT TESTS
echo ============================================================
echo.
echo Running unit tests (no server required)...
echo These tests check PDF parsing and utility functions.
echo.
echo ============================================================
echo.

call npm run test:unit

echo.
echo ============================================================
echo Tests complete!
echo.
echo The results are shown above in this window.
echo Scroll up to see all test results.
echo.
echo ============================================================
echo.
pause
