@echo off
echo.
echo Starting all tests via PowerShell...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0run-all-tests.ps1"
