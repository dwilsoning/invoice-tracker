# How to Stop Invoice Tracker Servers

## Quick Stop - Universal Script

Use this script to stop **BOTH** server types (SQLite and PostgreSQL):

### Option 1: Batch File (Easiest)
```
Double-click: STOP-ALL-SERVERS.bat
```

### Option 2: PowerShell (More Reliable)
```powershell
Right-click: STOP-ALL-SERVERS.ps1
Select: "Run with PowerShell"
```

Or from PowerShell:
```powershell
cd "C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend"
.\STOP-ALL-SERVERS.ps1
```

---

## What Gets Stopped

The script stops:
- ✅ Any process running on port 3001
- ✅ Node.js running `server.js` (SQLite version)
- ✅ Node.js running `server-postgres.js` (PostgreSQL version)
- ✅ Any Invoice Tracker related Node processes

---

## Manual Stop Methods

### Method 1: Keyboard Shortcut
If the server is running in a visible terminal window:
```
Press: Ctrl + C
```

### Method 2: Task Manager
1. Open Task Manager (Ctrl + Shift + Esc)
2. Find "Node.js: Server-side JavaScript"
3. Right-click → End Task

### Method 3: Command Line (by Port)
```cmd
# Find process on port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### Method 4: PowerShell (by Port)
```powershell
Get-NetTCPConnection -LocalPort 3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## Troubleshooting

### "Port 3001 is still in use"

**Cause:** Process didn't stop cleanly

**Solutions:**
1. Run the stop script again
2. Restart your computer
3. Wait 30 seconds and try again
4. Check for multiple Node.js processes in Task Manager

### "Access Denied"

**Cause:** Insufficient permissions

**Solutions:**
1. Right-click the .ps1 file → Run as Administrator
2. Or run Command Prompt as Administrator and use the .bat file

### "Cannot run PowerShell scripts"

**Cause:** Execution policy restriction

**Solution:**
```powershell
# Open PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run the script
.\STOP-ALL-SERVERS.ps1
```

---

## Verification

After stopping, verify the port is free:

**Command Prompt:**
```cmd
netstat -ano | findstr :3001
```

**PowerShell:**
```powershell
Get-NetTCPConnection -LocalPort 3001
```

If nothing appears, the port is free! ✓

---

## Starting the Correct Server

After stopping, make sure to start the **PostgreSQL** version:

```cmd
node server-postgres.js
```

Or use your batch file in:
```
C:\Users\dwils\Desktop\Invoice Tracker
```

---

## Summary

| Task | Command |
|------|---------|
| **Stop All Servers** | `STOP-ALL-SERVERS.bat` |
| **Stop All (PowerShell)** | `.\STOP-ALL-SERVERS.ps1` |
| **Manual Stop** | `Ctrl + C` in terminal |
| **Check Port** | `netstat -ano \| findstr :3001` |
| **Start PostgreSQL** | `node server-postgres.js` |

---

**Always use the PostgreSQL server (`server-postgres.js`) for production!**
