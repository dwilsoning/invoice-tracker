@echo off
echo ============================================================
echo PDF PARSING TEST
echo ============================================================
echo.
echo Testing all PDFs from the invoice_pdfs folder...
echo.

node test-parse-pdfs.js

echo.
echo Press any key to exit...
pause > nul
