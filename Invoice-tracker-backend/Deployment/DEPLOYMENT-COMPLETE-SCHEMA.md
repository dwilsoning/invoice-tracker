# Invoice Tracker - Complete EC2 PostgreSQL Deployment Guide

**Last Updated:** November 12, 2025  
**Version:** 2.0 (Complete Schema with All Tables & Correct Casing)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Tables](#database-tables)
4. [Deployment Methods](#deployment-methods)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete instructions for deploying the Invoice Tracker PostgreSQL schema to an AWS EC2 instance (or any PostgreSQL server) with **all 7 required tables** and **correct column casing**.

### What's Included

✓ **7 Complete Tables** with all required columns  
✓ **Correct Column Casing** (snake_case as per PostgreSQL conventions)  
✓ **Primary Keys & Constraints** properly defined  
✓ **Foreign Key Relationships** for data integrity  
✓ **Indexes** for query performance  
✓ **Triggers** for automatic timestamp management  
✓ **Permissions** configured for invoice_tracker_user  

---

## Prerequisites

Before deployment, ensure you have:

### 1. PostgreSQL Instance Running
- **PostgreSQL 12+** installed on EC2
- Service running and accessible
- Default port 5432 (or custom port configured)

### 2. Database & User Already Created

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-instance

# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE invoice_tracker;

# Create user
CREATE USER invoice_tracker_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO invoice_tracker_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO invoice_tracker_user;

# Exit
\q
```

### 3. Node.js Environment (Local Machine)
```bash
node --version  # Should be 16.x or higher
npm --version   # Should be 8.x or higher
```

### 4. Environment Configuration

Create/update `.env` file in `Invoice-tracker-backend/`:

```env
# PostgreSQL Configuration for EC2
DB_HOST=your-ec2-ip-or-domain
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_secure_password
NODE_ENV=production
PORT=3001
```

---

## Database Tables

### 1. **users** (4 columns + timestamps)
```sql
id (varchar 50, PK)
email (varchar 255, UNIQUE)
password_hash (varchar 255)
first_name (varchar 100)
last_name (varchar 100)
role (varchar 50, DEFAULT: 'user')
is_active (boolean, DEFAULT: true)
last_login (timestamp)
created_at (timestamp)
updated_at (timestamp)
```
**Purpose:** User authentication and account management  
**Rows Expected:** 4 (admin + user accounts)

---

### 2. **contracts** (8 columns + timestamps)
```sql
id (varchar 50, PK)
contract_name (varchar 255, UNIQUE)
contract_value (numeric 15,2)
currency (varchar 10, DEFAULT: 'USD')
created_date (date)
updated_date (date)
created_at (timestamp)
updated_at (timestamp)
```
**Purpose:** Store contract information for invoice grouping  
**Rows Expected:** 352

---

### 3. **invoices** (24 columns + timestamps) - MAIN TABLE
```sql
id (varchar 50, PK)
invoice_number (varchar 100)
invoice_date (date)
client (varchar 255)
customer_contract (varchar 100)
oracle_contract (varchar 100)
po_number (varchar 100)
invoice_type (varchar 50)
amount_due (numeric 15,2)
currency (varchar 10, DEFAULT: 'USD')
due_date (date)
status (varchar 50, DEFAULT: 'Pending')
payment_date (date)
frequency (varchar 50, DEFAULT: 'adhoc')
upload_date (date)
services (text)
pdf_path (varchar 500)
pdf_original_name (varchar 255)
contract_value (numeric 15,2)
contract_currency (varchar 10, DEFAULT: 'USD')
notes (text)
created_at (timestamp)
updated_at (timestamp)
```
**Purpose:** Core invoice records  
**Rows Expected:** 1,765 (1,557 Paid + 208 Pending)

---

### 4. **invoice_attachments** (8 columns)
```sql
id (varchar 50, PK)
invoice_id (varchar 50, FK -> invoices)
file_name (varchar 255)
original_name (varchar 255)
file_path (varchar 500)
file_size (integer)
mime_type (varchar 100)
uploaded_at (timestamp)
```
**Purpose:** Store PDF and attachment metadata  
**Rows Expected:** 33  
**Constraint:** Cascading delete with invoices

---

### 5. **expected_invoices** (15 columns + timestamps)
```sql
id (varchar 50, PK)
client (varchar 255)
customer_contract (varchar 100)
invoice_type (varchar 50)
expected_amount (numeric 15,2)
currency (varchar 10, DEFAULT: 'USD')
expected_date (date)
frequency (varchar 50)
last_invoice_number (varchar 100)
last_invoice_date (date)
acknowledged (boolean, DEFAULT: false)
acknowledged_date (date)
created_date (date)
created_at (timestamp)
updated_at (timestamp)
```
**Purpose:** Forecast expected invoices for tracking  
**Rows Expected:** 7

---

### 6. **dismissed_expected_invoices** (8 columns)
```sql
id (integer, PK, AUTO INCREMENT)
client (varchar 255)
customer_contract (varchar 255)
invoice_type (varchar 100)
expected_date (date)
dismissed_date (date, DEFAULT: CURRENT_DATE)
dismissed_by (varchar 100)
created_at (timestamp)
```
**Purpose:** Track dismissed forecasted invoices  
**Rows Expected:** 81  
**Constraint:** Unique on (client, customer_contract, invoice_type, expected_date)

---

### 7. **password_reset_tokens** (6 columns)
```sql
id (varchar 50, PK)
user_id (varchar 50, FK -> users)
token (varchar 255, UNIQUE)
expires_at (timestamp)
used (boolean, DEFAULT: false)
created_at (timestamp)
```
**Purpose:** Password reset functionality  
**Rows Expected:** 0 (empty until used)  
**Constraint:** Cascading delete with users

---

## Deployment Methods

### **Method 1: Using Node.js Script (Recommended)**

#### Step 1: Run Deployment Script
```bash
cd Invoice-tracker-backend
node deploy-schema-to-ec2.js
```

**Output:**
```
╔════════════════════════════════════════════════════════════════╗
║   Invoice Tracker - Complete PostgreSQL Schema Deployment      ║
║   For AWS EC2 and Production Environments                      ║
╚════════════════════════════════════════════════════════════════╝

📊 Database Configuration:
   Host:     your-ec2-ip
   Port:     5432
   Database: invoice_tracker
   User:     invoice_tracker_user

✓ Database connection successful

⏳ Creating trigger function...
✓ Creating trigger function - SUCCESS

⏳ Creating USERS table...
✓ Creating USERS table - SUCCESS

[... continues for each table ...]

✓ Schema deployment COMPLETE! All tables created successfully.
```

---

### **Method 2: Using SQL File**

#### Step 1: Copy SQL file to EC2
```bash
scp -i your-key.pem deploy-complete-schema-ec2.sql \
    ec2-user@your-ec2-ip:/tmp/
```

#### Step 2: Execute on EC2
```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker \
     -f /tmp/deploy-complete-schema-ec2.sql
```

---

### **Method 3: Manual psql (Minimal)**

```bash
# Connect to database
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker

# Run commands from deploy-complete-schema-ec2.sql
# Copy and paste each section
```

---

## Verification

### Check Tables Were Created

```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\dt"
```

**Expected Output:**
```
                    List of relations
 Schema |              Name               | Type  |         Owner
--------+---------------------------------+-------+------------------------
 public | contracts                       | table | postgres
 public | dismissed_expected_invoices     | table | postgres
 public | expected_invoices               | table | postgres
 public | invoice_attachments             | table | postgres
 public | invoices                        | table | postgres
 public | password_reset_tokens           | table | postgres
 public | users                           | table | postgres
(7 rows)
```

### Verify Columns

```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\d invoices"
```

**Expected Output shows:**
- All 24 columns with correct types
- Primary key on `id`
- All indexes created
- Trigger configured

### Verify Indexes

```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker -c "\di"
```

**Expected:** Should show all index definitions for each table

### Test Insert

```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
VALUES 
  ('test_user_1', 'test@example.com', 'hashed_password_here', 'Test', 'User', 'user', true);

SELECT * FROM users;
```

---

## Troubleshooting

### Issue 1: Connection Refused

**Error:** `psql: could not connect to server`

**Solution:**
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check port is listening: `sudo netstat -tlnp | grep 5432`
3. Verify EC2 security group allows port 5432
4. Ensure correct host IP in `.env`

---

### Issue 2: Permission Denied

**Error:** `permission denied for schema public`

**Solution:**
```bash
# Run as postgres superuser
sudo -u postgres psql -d invoice_tracker

# Grant permissions
GRANT ALL ON SCHEMA public TO invoice_tracker_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO invoice_tracker_user;
```

---

### Issue 3: Table Already Exists

**Error:** `relation "invoices" already exists`

**Solution:**
The scripts include `DROP TABLE IF EXISTS` statements. If this fails:

```bash
# Drop all tables
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker

DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
DROP TABLE IF EXISTS public.dismissed_expected_invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_attachments CASCADE;
DROP TABLE IF EXISTS public.expected_invoices CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

---

### Issue 4: Wrong Column Type

**Error:** `column "amount_due" is of type numeric but expression is of type integer`

**Solution:**
This is a data type mismatch. Ensure you're inserting the correct types. All monetary columns are `numeric(15,2)`.

---

## Post-Deployment Steps

### 1. Create Admin User

```bash
node create-admin.js
```

This will prompt for admin email and password.

---

### 2. Start Backend Server

```bash
npm run start:postgres
```

Expected output:
```
✓ Connected to PostgreSQL database
✓ Server running on port 3001
```

---

### 3. Verify API Connectivity

```bash
curl -X GET http://your-ec2-ip:3001/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Column Case Reference

All columns use **snake_case** (PostgreSQL standard):

```
✓ correct:   invoice_number, amount_due, due_date
✗ incorrect: invoiceNumber, amountDue, dueDate
```

The application handles camelCase <-> snake_case conversion automatically via `db-postgres.js`.

---

## Backup & Recovery

### Create Backup

```bash
pg_dump -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker \
  > backup-$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup

```bash
psql -h your-ec2-ip -U invoice_tracker_user -d invoice_tracker \
  < backup-20251112_100000.sql
```

---

## Next Steps

1. ✅ Deploy schema (this document)
2. ✅ Create admin user
3. ✅ Start backend server
4. ✅ Start frontend
5. 📊 Migrate existing data (if applicable)
6. 🔒 Configure backups
7. 📈 Monitor performance

---

## Support

For issues or questions, refer to:
- `DEPLOYMENT-GUIDE.md` - General deployment info
- `DEPLOYMENT-GUIDE-AWS.md` - AWS-specific steps
- `README.md` - Project overview

---

**Created:** November 12, 2025  
**For:** Invoice Tracker v1.0 EC2 Deployment
