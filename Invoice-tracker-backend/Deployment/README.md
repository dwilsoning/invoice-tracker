# 🚀 Deployment Folder - EC2 & Production Deployment

**Status**: ✅ Ready for Production Deployment  
**Date**: November 12, 2025

---

## 📋 Overview

This folder contains all necessary files for deploying the Invoice Tracker to AWS EC2 or any PostgreSQL instance.

**Everything you need is here** - no need to look elsewhere!

---

## 📦 Files in This Folder

### 1️⃣ **deploy-complete-schema-ec2.sql** (2.8 KB)
**What it does**: Creates the complete PostgreSQL database schema

**Contains**:
- All 7 database tables
- All 79 columns (24 in invoices table)
- All constraints (primary keys, foreign keys, unique)
- All 17+ performance indexes
- Automatic timestamp triggers
- Permission grants for invoice_tracker_user

**When to use**: 
- First deployment to new PostgreSQL instance
- Building schema from scratch

**How to use**:
```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -f deploy-complete-schema-ec2.sql
```

---

### 2️⃣ **deploy-schema-to-ec2.js** (6.5 KB)
**What it does**: Automated Node.js script that deploys the schema with validation and error handling

**Features**:
- Automatic connection testing to both databases
- Sequential table creation
- Individual error handling per table
- Detailed progress reporting with ✓/✗ indicators
- Summary statistics at end
- Color-coded output

**When to use**:
- Preferred method (safer than raw SQL)
- When you need detailed feedback
- When you want automatic error recovery

**How to use**:
```bash
# 1. Update .env with EC2 credentials:
#    DB_HOST=your-ec2-ip
#    DB_PORT=5432
#    DB_NAME=invoice_tracker
#    DB_USER=invoice_tracker_user
#    DB_PASSWORD=your_password

# 2. Run the script:
node deploy-schema-to-ec2.js

# 3. Watch the output for success confirmation
```

**Expected output**:
```
✓ Trigger function created
✓ users table created
✓ contracts table created
✓ invoices table created
✓ invoice_attachments table created
✓ expected_invoices table created
✓ dismissed_expected_invoices table created
✓ password_reset_tokens table created
✓ Permissions granted

Schema deployment COMPLETE! All tables created successfully.
```

---

### 3️⃣ **migrate-data-to-ec2.js** (5.2 KB)
**What it does**: Migrates all existing data from local PostgreSQL to EC2

**Features**:
- Connects to SOURCE_DB (local) and target DB (EC2)
- Migrates all 7 tables with data
- Preserves all timestamps and relationships
- Handles duplicates gracefully with ON CONFLICT
- Temporarily disables foreign key checks during migration
- Per-table migration progress reporting

**When to use**:
- After schema is deployed
- When you have existing invoices to transfer
- To maintain data from local development

**How to use**:
```bash
# 1. Update .env with both source and target credentials:
#    SOURCE_DB_HOST=localhost
#    SOURCE_DB_PORT=5432
#    SOURCE_DB_NAME=invoice_tracker_local
#    SOURCE_DB_USER=invoice_tracker_user
#    SOURCE_DB_PASSWORD=local_password
#    
#    DB_HOST=your-ec2-ip
#    DB_PORT=5432
#    DB_NAME=invoice_tracker
#    DB_USER=invoice_tracker_user
#    DB_PASSWORD=your_password

# 2. Run the migration:
node migrate-data-to-ec2.js

# 3. Check the output for row counts
```

**Expected output**:
```
Migrating data from local to EC2...

Migrating users table... 4 rows migrated
Migrating contracts table... 352 rows migrated
Migrating invoices table... 1765 rows migrated
Migrating invoice_attachments table... 33 rows migrated
Migrating expected_invoices table... 7 rows migrated
Migrating dismissed_expected_invoices table... 81 rows migrated
Migrating password_reset_tokens table... 0 rows migrated

✓ Data migration complete! 2242 total rows migrated.
```

---

### 4️⃣ **DEPLOYMENT-COMPLETE-SCHEMA.md** (8.5 KB)
**What it is**: Comprehensive deployment guide

**Contains**:
- Prerequisites checklist
- Detailed setup instructions
- Complete table specifications (all 7 tables)
- Column definitions for all 79 columns
- 3 different deployment methods
- Post-deployment verification steps
- Troubleshooting section
- Backup & recovery procedures

**When to read**: 
- Before deploying (understand what's happening)
- When you need detailed explanations
- If something goes wrong

**Read time**: 10-15 minutes

---

### 5️⃣ **DEPLOYMENT-QUICK-REFERENCE.md** (6.2 KB)
**What it is**: Quick lookup reference card

**Contains**:
- 5-minute quick start procedure
- Table summary (7 tables at a glance)
- Column casing reference (database vs API)
- Alternative deployment methods
- Post-deployment checklist
- Quick troubleshooting table

**When to use**:
- Quick lookup while deploying
- Reference for column names
- Fast troubleshooting

**Read time**: 2-3 minutes

---

## 🚀 QUICK START (5 Minutes)

### Prerequisites
- [ ] PostgreSQL 12+ installed on EC2
- [ ] Database created: `invoice_tracker`
- [ ] User created: `invoice_tracker_user`
- [ ] Node.js 16+ installed locally
- [ ] `.env` file configured

### Step 1: Update .env (1 min)
```bash
# In Invoice-tracker-backend/.env
DB_HOST=your-ec2-ip
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_password
```

### Step 2: Deploy Schema (2 min)
```bash
cd Invoice-tracker-backend/Deployment
node deploy-schema-to-ec2.js
```

### Step 3: Verify (1 min)
```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\dt"
```

You should see all 7 tables listed.

### Step 4: Migrate Data (Optional, 1 min)
```bash
node migrate-data-to-ec2.js
```

---

## 📊 What Gets Created

### 7 Tables

| Table | Rows | Purpose |
|-------|------|---------|
| **users** | ~4 | User accounts & authentication |
| **contracts** | ~350 | Contract information |
| **invoices** | ~1,765 | Invoice records (main table) |
| **invoice_attachments** | ~30 | PDF attachments |
| **expected_invoices** | ~7 | Forecasted invoices |
| **dismissed_expected_invoices** | ~80 | Dismissed forecasts |
| **password_reset_tokens** | ~0 | Password reset tokens |

### All Columns
- 79 total columns
- 24 in invoices table (all correct)
- Snake_case naming (PostgreSQL standard)
- Correct data types (varchar, numeric, date, boolean, timestamp)

### Constraints & Indexes
- ✅ Primary keys on all tables
- ✅ Foreign key relationships (cascade delete)
- ✅ Unique constraints (email, contract_name, token)
- ✅ 17+ performance indexes
- ✅ Automatic timestamp triggers

---

## 🔧 DEPLOYMENT METHODS

### Method 1: Node.js Script (RECOMMENDED) ⭐
```bash
node deploy-schema-to-ec2.js
```
**Pros**: Error handling, progress reporting, easy rollback  
**Cons**: Requires Node.js  
**Time**: 2-3 minutes

### Method 2: SQL File (DIRECT)
```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -f deploy-complete-schema-ec2.sql
```
**Pros**: Simple, no Node.js needed  
**Cons**: Less feedback on errors  
**Time**: 2-3 minutes

### Method 3: Manual psql (ADVANCED)
```bash
# Connect to database
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker

# Then copy/paste SQL from deploy-complete-schema-ec2.sql
```
**Pros**: Full control, can debug  
**Cons**: Manual, error-prone  
**Time**: 5-10 minutes

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify with:

```bash
# 1. List all tables
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\dt"

# Expected: 7 tables (contracts, dismissed_expected_invoices, expected_invoices, 
#           invoice_attachments, invoices, password_reset_tokens, users)

# 2. Check invoices table structure
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\d invoices"

# Expected: 24 columns all present

# 3. Check indexes
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\di"

# Expected: 17+ indexes listed

# 4. Test connection from Node.js
node -e "const pg = require('pg'); const pool = new pg.Pool({...}); pool.query('SELECT 1', (err, res) => { console.log(err ? 'FAIL' : 'OK'); process.exit(0); });"
```

---

## 🆘 TROUBLESHOOTING

### Connection Failed
```
Error: connect ECONNREFUSED
```
**Solution**:
- Check EC2 security group allows port 5432
- Verify DB_HOST is correct
- Verify PostgreSQL is running: `psql --version`

### Permission Denied
```
Error: permission denied for schema public
```
**Solution**:
- Ensure invoice_tracker_user has permissions
- Run: `GRANT ALL ON SCHEMA public TO invoice_tracker_user;`

### Table Already Exists
```
Error: relation "invoices" already exists
```
**Solution**:
- Script has `DROP TABLE IF EXISTS` - just re-run
- Or manually: `DROP TABLE invoices CASCADE;`

### Missing Columns
```
Column "invoice_number" does not exist
```
**Solution**:
- Re-run deploy-schema-to-ec2.js
- All 24 columns created automatically

---

## 📋 WHAT EACH FILE DOES

| File | Language | Size | Purpose | Time |
|------|----------|------|---------|------|
| **deploy-complete-schema-ec2.sql** | SQL | 2.8 KB | Create schema | 2 min |
| **deploy-schema-to-ec2.js** | Node.js | 6.5 KB | Deploy with validation | 2-3 min |
| **migrate-data-to-ec2.js** | Node.js | 5.2 KB | Migrate data | 1-2 min |
| **DEPLOYMENT-COMPLETE-SCHEMA.md** | Markdown | 8.5 KB | Full guide | 10 min |
| **DEPLOYMENT-QUICK-REFERENCE.md** | Markdown | 6.2 KB | Quick ref | 2 min |

---

## 🎯 RECOMMENDED WORKFLOW

```
1. Read DEPLOYMENT-QUICK-REFERENCE.md (2 min)
   ↓
2. Verify prerequisites met (3 min)
   ↓
3. Update .env with EC2 credentials (2 min)
   ↓
4. Run: node deploy-schema-to-ec2.js (2 min)
   ↓
5. Verify with psql commands (2 min)
   ↓
6. Run: node migrate-data-to-ec2.js (2 min) [Optional]
   ↓
7. Verify data migrated (1 min)
   ↓
✅ DONE! Ready to run application
```

**Total Time**: 14-16 minutes

---

## 🔑 KEY POINTS

✅ **Complete**: All 7 tables, all 79 columns, all constraints  
✅ **Correct**: Snake_case naming, proper data types  
✅ **Safe**: Error handling, cascade rules, backups  
✅ **Documented**: Guides included, troubleshooting steps  
✅ **Automated**: Node.js scripts with validation  
✅ **Flexible**: 3 deployment methods to choose from  

---

## 📞 SUPPORT

**Need help?**

1. **Quick question?** → Read DEPLOYMENT-QUICK-REFERENCE.md
2. **Detailed info?** → Read DEPLOYMENT-COMPLETE-SCHEMA.md
3. **Something broken?** → See Troubleshooting section above
4. **Not sure what to do?** → Follow the Quick Start section

---

## 🎓 ABOUT THE FILES

### Tables Created
All files create the same 7 tables:
1. **users** - User authentication
2. **contracts** - Contract data
3. **invoices** - Main invoice records (24 columns)
4. **invoice_attachments** - PDF files
5. **expected_invoices** - Forecasts
6. **dismissed_expected_invoices** - Forecast dismissals
7. **password_reset_tokens** - Password reset

### Why Multiple Files?

| File | Why It Exists |
|------|---------------|
| **deploy-complete-schema-ec2.sql** | Language-independent, version control friendly |
| **deploy-schema-to-ec2.js** | Automation, error handling, progress tracking |
| **migrate-data-to-ec2.js** | Safe data transfer with conflict handling |

You only need ONE to deploy. Use the Node.js script (recommended).

---

## ✨ QUALITY ASSURANCE

All files tested and verified:
- ✅ All column names correct (snake_case)
- ✅ All data types validated
- ✅ All constraints enforced
- ✅ All indexes optimized
- ✅ All triggers configured
- ✅ Foreign key relationships verified
- ✅ Cascade delete rules tested

---

## 🚀 YOU'RE READY!

Everything in this folder is production-ready.

**Next step**: Follow the Quick Start section above or read DEPLOYMENT-QUICK-REFERENCE.md

---

**Status**: ✅ Production Ready  
**Date**: November 12, 2025  
**Version**: 2.0 - Complete EC2 Deployment Suite
