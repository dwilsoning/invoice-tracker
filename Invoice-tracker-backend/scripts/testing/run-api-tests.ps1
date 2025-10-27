Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INVOICE TRACKER - API TESTS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Make sure the server is running on port 3001!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Running API endpoint tests..." -ForegroundColor Yellow
Write-Host "Results will be saved to: api-test-results.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Run API tests and save output
node .\node_modules\jest\bin\jest.js tests/api.test.js --forceExit 2>&1 | Tee-Object -FilePath "api-test-results.txt"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Tests complete!" -ForegroundColor Green
Write-Host "Results saved to: api-test-results.txt" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit (or check api-test-results.txt for details)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
