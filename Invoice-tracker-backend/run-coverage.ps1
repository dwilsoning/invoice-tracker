Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "INVOICE TRACKER - TEST COVERAGE REPORT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running all tests with coverage analysis..." -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Run tests with coverage
node .\node_modules\jest\bin\jest.js --coverage --forceExit

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Coverage report generated!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening coverage report in browser..." -ForegroundColor Yellow

# Open coverage report in default browser
$coveragePath = Join-Path $PSScriptRoot "coverage\lcov-report\index.html"
if (Test-Path $coveragePath) {
    Start-Process $coveragePath
    Write-Host "Coverage report opened!" -ForegroundColor Green
} else {
    Write-Host "Coverage report not found at: $coveragePath" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
