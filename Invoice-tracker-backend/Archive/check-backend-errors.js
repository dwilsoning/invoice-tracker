// This file documents the commands to check backend errors
// Run these commands on your EC2 instance:

console.log(`
Check Backend Errors
====================

Run these commands to diagnose the 500 errors:

# Check PM2 backend logs
pm2 logs invoice-tracker-backend --lines 100

# Check if backend is running
pm2 status

# Test database connection
cd ~/invoice-tracker/Invoice-tracker-backend
node -e "const { pool } = require('./db-postgres'); pool.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0])).catch(e => console.error('DB Error:', e.message)).finally(() => pool.end());"

# Check backend .env file
cat ~/invoice-tracker/Invoice-tracker-backend/.env

# Restart backend
pm2 restart invoice-tracker-backend

# Watch logs in real-time
pm2 logs invoice-tracker-backend --lines 0
`);
