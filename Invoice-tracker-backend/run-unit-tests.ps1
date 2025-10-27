Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INVOICE TRACKER - UNIT TESTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running unit tests (no server required)..." -ForegroundColor Yellow
Write-Host "Results will be saved to: unit-test-results.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Run tests and save output
node .\node_modules\jest\bin\jest.js tests/unit 2>&1 | Tee-Object -FilePath "unit-test-results.txt"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Tests complete!" -ForegroundColor Green
Write-Host "Results saved to: unit-test-results.txt" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit (or check unit-test-results.txt for details)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
