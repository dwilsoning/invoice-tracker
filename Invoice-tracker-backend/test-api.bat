@echo off
echo.
echo Starting API tests via PowerShell...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0run-api-tests.ps1"
