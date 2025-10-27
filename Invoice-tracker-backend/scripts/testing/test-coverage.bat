@echo off
echo.
echo Starting tests with coverage via PowerShell...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0run-coverage.ps1"
