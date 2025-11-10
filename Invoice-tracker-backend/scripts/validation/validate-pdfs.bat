@echo off
setlocal EnableDelayedExpansion
echo ============================================================
echo PDF PARSING VALIDATION
echo ============================================================
echo.
echo This will validate PDF parsing by comparing extracted data
echo from actual PDFs against what's stored in the database.
echo.
echo NOTE: PostgreSQL database must be running!
echo.
echo ============================================================
echo VALIDATION OPTIONS:
echo ============================================================
echo.
echo 1. Quick Check (first 20 PDFs)
echo 2. Random Sample (20 PDFs)
echo 3. Random Sample (50 PDFs)
echo 4. Random Sample (100 PDFs)
echo 5. Custom Sample Size
echo 6. Validate ALL PDFs (WARNING: Takes several minutes!)
echo.
echo ============================================================
echo.
set /p choice="Enter your choice (1-6): "
echo.

if "%choice%"=="1" goto option1
if "%choice%"=="2" goto option2
if "%choice%"=="3" goto option3
if "%choice%"=="4" goto option4
if "%choice%"=="5" goto option5
if "%choice%"=="6" goto option6
goto invalid

:option1
echo Running quick check on first 20 PDFs...
echo.
node validate-pdf-parsing.js
goto end

:option2
echo Running validation on random 20 PDFs...
echo.
node validate-pdf-parsing.js --random
goto end

:option3
echo Running validation on random 50 PDFs...
echo.
node validate-pdf-parsing.js --random=50
goto end

:option4
echo Running validation on random 100 PDFs...
echo.
node validate-pdf-parsing.js --random=100
goto end

:option5
set /p sample_size="Enter sample size: "
echo Running validation on first !sample_size! PDFs...
echo.
node validate-pdf-parsing.js --sample=!sample_size!
goto end

:option6
echo.
echo WARNING: This will validate ALL PDFs and may take several minutes!
set /p confirm="Are you sure? (Y/N): "
if /i "!confirm!"=="Y" (
    echo.
    echo Running validation on ALL PDFs...
    echo.
    node validate-pdf-parsing.js --all
) else (
    echo Validation cancelled.
)
goto end

:invalid
echo Invalid choice. Running default validation (first 20 PDFs)...
echo.
node validate-pdf-parsing.js
goto end

:end

echo.
echo ============================================================
echo Validation complete!
echo Check pdf-validation-report.json for detailed results.
echo ============================================================
echo.
echo Press any key to exit...
pause > nul
