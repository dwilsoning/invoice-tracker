# Which Server File to Use?

## TL;DR - Use PostgreSQL Server!

**Run this command:**
```bash
node server-postgres.js
```

**Or double-click this file:**
```
START-POSTGRESQL-SERVER.bat
```

---

## Server Files Explained

### 1. `server-postgres.js` ✅ **USE THIS ONE**
- **Database:** PostgreSQL (production-ready)
- **Best for:** Cloud deployment, production use
- **Features:** Full async/await, scalable, cloud-ready
- **Start with:** `node server-postgres.js`

### 2. `server.js` ❌ **DON'T USE**
- **Database:** SQL.js (SQLite in JavaScript)
- **Best for:** Testing, development only
- **Issues:** Not suitable for production, file-based
- **Note:** This was the old version before PostgreSQL migration

---

## Starting the Server

### Method 1: Batch File (Easiest)
Double-click: `START-POSTGRESQL-SERVER.bat`

### Method 2: Command Line
```bash
cd "C:\Users\dwils\Claude-Projects\Invoice Tracker\Invoice-tracker-backend"
node server-postgres.js
```

### Method 3: npm script
```bash
npm run start:postgres
```

---

## Prerequisites

1. **PostgreSQL must be running:**
   ```bash
   # Check if PostgreSQL is running (Windows)
   Get-Service -Name postgresql*

   # Start PostgreSQL if needed
   Start-Service postgresql-x64-14
   ```

2. **Environment variables configured:**
   - Create `.env` file with your PostgreSQL credentials
   - See `.env.example` for template

3. **Database created and migrated:**
   ```bash
   # Run migration if needed
   node migrate-to-postgres.js
   ```

---

## Troubleshooting

### Error: "Can't connect to database"
- Check PostgreSQL is running
- Verify `.env` file has correct credentials
- Test connection: `node -e "require('dotenv').config(); console.log(process.env.DB_HOST)"`

### Error: "syntax error at or near"
- You're running the wrong server file!
- Stop `server.js` and run `server-postgres.js` instead

### Error: "relation does not exist"
- Database tables not created
- Run: `node migrate-to-postgres.js`

---

## Current Setup

✅ PostgreSQL database with 810 invoices
✅ Database: `invoice_tracker`
✅ Host: `172.27.144.1:5432`
✅ User: `invoice_tracker_user`

---

**Always use `server-postgres.js` for the Invoice Tracker application!**
