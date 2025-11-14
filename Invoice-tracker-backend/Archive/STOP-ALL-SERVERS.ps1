# Invoice Tracker - Stop All Servers (PowerShell)
# Stops both SQLite (server.js) and PostgreSQL (server-postgres.js) servers

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Invoice Tracker - Stop All Servers" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$stopped = $false

# Method 1: Kill by port 3001
Write-Host "[1/3] Checking for processes on port 3001..." -ForegroundColor Yellow

try {
    $connections = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue

    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Found: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor White
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Write-Host "  ✓ Stopped process $($process.Id)" -ForegroundColor Green
                $stopped = $true
            }
        }
    } else {
        Write-Host "  No processes found on port 3001" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not check port 3001 (may require admin rights)" -ForegroundColor Yellow
}

# Method 2: Kill by process name and command line
Write-Host ""
Write-Host "[2/3] Checking for Node.js server processes..." -ForegroundColor Yellow

try {
    $nodeProcesses = Get-WmiObject Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue

    if ($nodeProcesses) {
        foreach ($proc in $nodeProcesses) {
            $cmdLine = $proc.CommandLine

            if ($cmdLine -match "server\.js|server-postgres\.js") {
                Write-Host "  Found: PID $($proc.ProcessId) - $cmdLine" -ForegroundColor White
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "  ✓ Stopped process $($proc.ProcessId)" -ForegroundColor Green
                $stopped = $true
            }
        }
    } else {
        Write-Host "  No Node.js server processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not enumerate Node.js processes" -ForegroundColor Yellow
}

# Method 3: Fallback - kill all node.exe that might be servers
Write-Host ""
Write-Host "[3/3] Checking for any remaining server processes..." -ForegroundColor Yellow

try {
    # Get all node processes in the Invoice-tracker-backend directory
    $allNodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue

    if ($allNodeProcs) {
        $count = 0
        foreach ($proc in $allNodeProcs) {
            try {
                $procPath = $proc.Path
                if ($procPath -and $procPath -match "Invoice.*Tracker") {
                    Write-Host "  Found Invoice Tracker Node process: PID $($proc.Id)" -ForegroundColor White
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    Write-Host "  ✓ Stopped process $($proc.Id)" -ForegroundColor Green
                    $stopped = $true
                    $count++
                }
            } catch {
                # Process may have already exited
            }
        }

        if ($count -eq 0) {
            Write-Host "  No Invoice Tracker processes found" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No Node.js processes running" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not enumerate Node.js processes" -ForegroundColor Yellow
}

# Verify port is free
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan

if ($stopped) {
    Write-Host " Servers stopped successfully!" -ForegroundColor Green
} else {
    Write-Host " No running servers found" -ForegroundColor Yellow
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Final verification
try {
    $stillListening = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue

    if ($stillListening) {
        Write-Host "⚠️  Warning: Port 3001 is still in use!" -ForegroundColor Red
        Write-Host "   You may need to manually kill the process or restart your computer" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Port 3001 is now free" -ForegroundColor Green
    }
} catch {
    Write-Host "✓ Port check complete" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
