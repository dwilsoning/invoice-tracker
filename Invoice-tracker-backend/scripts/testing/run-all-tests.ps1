Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INVOICE TRACKER - ALL TESTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Make sure the server is running on port 3001!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Running all tests (API + Unit + Integration)..." -ForegroundColor Yellow
Write-Host "Results will be saved to: test-results.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Run all tests and save output
node .\node_modules\jest\bin\jest.js --forceExit 2>&1 | Tee-Object -FilePath "test-results.txt"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Tests complete!" -ForegroundColor Green
Write-Host "Results saved to: test-results.txt" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit (or check test-results.txt for details)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
