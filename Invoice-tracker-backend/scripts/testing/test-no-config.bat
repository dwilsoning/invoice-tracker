@echo off
cd /d "%~dp0"
echo ============================================================
echo INVOICE TRACKER - UNIT TESTS (No Config)
echo ============================================================
echo.
echo Running unit tests without config file...
echo.
echo ============================================================
echo.

node ./node_modules/jest/bin/jest.js tests/unit --no-config

echo.
echo ============================================================
echo Tests complete!
echo ============================================================
echo.
pause
