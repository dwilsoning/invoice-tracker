Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INVOICE TRACKER - INTEGRATION TESTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Make sure the server is running on port 3001!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Running integration tests (complete workflows)..." -ForegroundColor Yellow
Write-Host "Results will be saved to: integration-test-results.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Run integration tests and save output
node .\node_modules\jest\bin\jest.js tests/integration --forceExit 2>&1 | Tee-Object -FilePath "integration-test-results.txt"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Tests complete!" -ForegroundColor Green
Write-Host "Results saved to: integration-test-results.txt" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit (or check integration-test-results.txt for details)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
