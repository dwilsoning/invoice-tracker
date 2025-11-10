@echo off
echo ============================================================
echo PDF PARSING VALIDATION
echo ============================================================
echo.
echo This will validate PDF parsing by comparing extracted data
echo from actual PDFs against what's stored in the database.
echo.
echo NOTE: PostgreSQL database must be running!
echo.
echo Press any key to start validation...
pause > nul
echo.

node validate-pdf-parsing.js

echo.
echo ============================================================
echo Validation complete!
echo Check pdf-validation-report.json for detailed results.
echo ============================================================
echo.
echo Press any key to exit...
pause > nul
