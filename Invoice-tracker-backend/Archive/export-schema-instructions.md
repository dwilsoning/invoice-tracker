# Export Database Schema - PowerShell Instructions

## Step 1: Open PowerShell

Open PowerShell (not WSL) and navigate to the backend directory:

```powershell
cd "C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend"
```

## Step 2: Run the export script

```powershell
node export-complete-schema.js
```

## Step 3: Verify the file was created

```powershell
dir complete-schema-export.sql
```

## Step 4: Copy the file to EC2

Use SCP to copy the file to your EC2 instance:

```powershell
scp -i "C:\path\to\your-key.pem" complete-schema-export.sql ubuntu@YOUR_EC2_IP:~/invoice-tracker/Invoice-tracker-backend/
```

Replace:
- `C:\path\to\your-key.pem` with your actual SSH key path
- `YOUR_EC2_IP` with your EC2 instance IP address

## Step 5: On EC2, run the schema

SSH into your EC2 instance and run:

```bash
cd ~/invoice-tracker/Invoice-tracker-backend
sudo -u postgres psql -d invoice_tracker -f complete-schema-export.sql
pm2 restart invoice-tracker-backend
```

---

## Alternative: If you don't have your SSH key handy

1. Run the export script (Step 2 above)
2. Open the file in a text editor:
   ```powershell
   notepad complete-schema-export.sql
   ```
3. Copy the entire contents
4. SSH to EC2 and create the file:
   ```bash
   cd ~/invoice-tracker/Invoice-tracker-backend
   nano complete-schema-export.sql
   ```
5. Paste the contents and save (Ctrl+X, Y, Enter)
6. Run the schema:
   ```bash
   sudo -u postgres psql -d invoice_tracker -f complete-schema-export.sql
   pm2 restart invoice-tracker-backend
   ```
