# SA Health Status Checker - EC2 Deployment Guide

## Quick Deployment Checklist

This feature is already integrated into your codebase. Follow these steps to deploy to EC2:

### 1. Commit and Push Changes

```bash
# In the Invoice-tracker-backend directory
git add scripts/sa-health-status-checker.js
git add scripts/SA_HEALTH_STATUS_CHECKER_README.md
git add scripts/SA_HEALTH_EC2_DEPLOYMENT.md
git add server-postgres.js

# In the invoice-tracker-frontend directory
git add src/App.jsx

# Commit the changes
git commit -m "Add SA Health invoice status checker with automated daily checks"

# Push to your repository
git push origin main
```

### 2. Deploy to EC2

SSH into your EC2 instance and pull the changes:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-instance

# Navigate to backend directory
cd /path/to/Invoice-tracker-backend

# Pull latest changes
git pull origin main

# Restart the backend server
# If using PM2:
pm2 restart invoice-tracker-backend

# If using systemd:
sudo systemctl restart invoice-tracker-backend

# Check server logs to verify the scheduled task
pm2 logs invoice-tracker-backend | grep "SA Health"
# OR
journalctl -u invoice-tracker-backend -f | grep "SA Health"
```

### 3. Deploy Frontend

```bash
# Navigate to frontend directory
cd /path/to/invoice-tracker-frontend

# Pull latest changes
git pull origin main

# Build the frontend
npm run build

# If using PM2 to serve the frontend:
pm2 restart invoice-tracker-frontend

# If copying to a web server:
sudo cp -r dist/* /var/www/html/
```

### 4. Verify Installation

Check that the scheduled task is registered:

```bash
# You should see output like:
# 📅 Scheduled Tasks Summary (Australia/Sydney timezone):
#   • Duplicate invoice check: Midnight daily
#   • Expected invoice generation: 1 AM daily
#   • Exchange rate updates: 2 AM, 8 AM, 2 PM, 8 PM daily
#   • Cleanup old acknowledged invoices: 3 AM every Sunday
#   • Database backup: 4 AM daily
#   • SA Health invoice status check: 9 AM daily  <-- This is new!
```

### 5. Test Manual Checking

1. Open the invoice tracker in your browser
2. Find an SA Health invoice
3. Click "Edit"
4. Look for the "Check SA Health Status" button above the Notes field
5. Click it and verify the status updates

### 6. Test Command Line Script

```bash
# Test checking a single invoice
cd /path/to/Invoice-tracker-backend
node scripts/sa-health-status-checker.js 3000000060

# Test checking all SA Health invoices
node scripts/sa-health-status-checker.js
```

## Automated Daily Checks

The system will automatically:
- Run every day at 9 AM AEST/AEDT
- Check all unpaid SA Health invoices
- Update notes with current status
- Mark invoices as "Paid" when detected
- Log results to the server logs

## Monitoring

To monitor the automated checks:

```bash
# Watch logs in real-time
pm2 logs invoice-tracker-backend --lines 100

# Check for SA Health specific logs
pm2 logs invoice-tracker-backend | grep "SA Health"

# View logs from a specific date (if using journalctl)
journalctl -u invoice-tracker-backend --since "2025-12-02" | grep "SA Health"
```

## Troubleshooting EC2 Deployment

### Server Won't Start

If the server fails to start after deployment:

```bash
# Check for syntax errors
cd /path/to/Invoice-tracker-backend
node -c server-postgres.js

# Check server logs
pm2 logs invoice-tracker-backend --err
```

### Button Not Showing in UI

Make sure the frontend was rebuilt and deployed:

```bash
cd /path/to/invoice-tracker-frontend
npm run build
# Then copy dist/* to your web server
```

### Network Issues on EC2

If the SA Health website can't be reached from EC2:

```bash
# Test connectivity
curl -I https://iframe.sssa.sa.gov.au/myinvoice

# If blocked, you may need to:
# 1. Update EC2 security group outbound rules
# 2. Check VPC/subnet routing
# 3. Verify EC2 instance has internet access
```

### Database Connection Issues

Verify database credentials in your EC2 environment:

```bash
# Check environment variables
echo $DB_HOST
echo $DB_NAME
echo $DB_USER

# Test database connection
cd /path/to/Invoice-tracker-backend
node -e "const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ host: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD }); pool.query('SELECT NOW()').then(r => { console.log('DB OK:', r.rows[0]); pool.end(); }).catch(e => { console.error('DB Error:', e.message); pool.end(); });"
```

## Rollback Plan

If you need to rollback the changes:

```bash
# On EC2, revert to previous commit
git log --oneline  # Find the commit before SA Health changes
git checkout <previous-commit-hash>

# Restart servers
pm2 restart all
```

## Post-Deployment Checklist

- [ ] Backend server restarted successfully
- [ ] Frontend rebuilt and deployed
- [ ] Scheduled task appears in server logs
- [ ] Manual check button appears for SA Health invoices
- [ ] Manual check updates notes correctly
- [ ] Server logs show scheduled task registration
- [ ] No errors in server logs

## Support

If you encounter issues during deployment:
1. Check server logs first
2. Verify all files were pushed to git
3. Ensure EC2 instance can access external websites
4. Review the main README: `SA_HEALTH_STATUS_CHECKER_README.md`
