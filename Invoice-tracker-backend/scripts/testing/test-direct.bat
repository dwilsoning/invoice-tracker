@echo off
cd /d "%~dp0"
echo ============================================================
echo INVOICE TRACKER - UNIT TESTS (Direct Method)
echo ============================================================
echo.
echo Current directory: %CD%
echo Running unit tests...
echo.
echo ============================================================
echo.

node ./node_modules/jest/bin/jest.js tests/unit

echo.
echo ============================================================
echo Tests complete!
echo Scroll up to see all results.
echo ============================================================
echo.
pause
