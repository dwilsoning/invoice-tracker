@echo off
echo.
echo Starting unit tests via PowerShell...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0run-unit-tests.ps1"
