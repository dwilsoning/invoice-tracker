@echo off
echo.
echo Starting integration tests via PowerShell...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0run-integration-tests.ps1"
