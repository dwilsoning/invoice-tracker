# Invoice Tracker - Complete Installation Guide

Step-by-step instructions to install and run the Invoice Tracker on any computer.

---

## ⚠️ Before You Begin

**Have you completed the prerequisites?**
Please read and complete **PREREQUISITES.md** first to ensure:
- ✅ Node.js 16+ is installed
- ✅ PostgreSQL 12+ is installed and running
- ✅ You have the project files
- ✅ You have administrator/sudo access if needed

---

## 📑 Table of Contents

1. [Database Setup](#1-database-setup)
2. [Backend Setup](#2-backend-setup)
3. [Frontend Setup](#3-frontend-setup)
4. [First-Time Configuration](#4-first-time-configuration)
5. [Starting the Application](#5-starting-the-application)
6. [Verification](#6-verification)
7. [Common Issues](#7-common-issues)

---

## 1. Database Setup

### Step 1.1: Start PostgreSQL

**Windows**:
```bash
# Open Services (services.msc) and start "postgresql-x64-14"
# Or use command line:
pg_ctl start -D "C:\Program Files\PostgreSQL\14\data"

# Or use the start menu shortcut
```

**macOS** (Homebrew):
```bash
brew services start postgresql@14
```

**Linux**:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Start on boot
```

**Verify PostgreSQL is running**:
```bash
# All platforms - check status
pg_isready

# Should output: "localhost:5432 - accepting connections"
```

---

### Step 1.2: Create Database User

**Windows** (using Command Prompt or PowerShell):
```bash
# Connect as postgres superuser
psql -U postgres

# You'll be prompted for the postgres password set during installation
```

**macOS/Linux**:
```bash
# Switch to postgres user
sudo -u postgres psql

# Or if you have default user access:
psql postgres
```

---

### Step 1.3: Run Database Setup Commands

Once connected to PostgreSQL, run these SQL commands:

```sql
-- Create application user
CREATE USER invoice_tracker_user WITH PASSWORD 'your_secure_password_here';

-- Create database
CREATE DATABASE invoice_tracker OWNER invoice_tracker_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;

-- Connect to the new database
\c invoice_tracker

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO invoice_tracker_user;

-- Exit psql
\q
```

**Important**: Replace `'your_secure_password_here'` with a strong password and remember it!

**Generate a secure password** (optional):
```bash
# On Linux/macOS
openssl rand -base64 32

# On Windows (PowerShell)
Add-Type -AssemblyName System.Web
[System.Web.Security.Membership]::GeneratePassword(16,4)
```

---

### Step 1.4: Test Database Connection

```bash
# Test connection with new user
psql -U invoice_tracker_user -d invoice_tracker -h localhost

# If successful, you'll see:
# invoice_tracker=>

# Exit
\q
```

If this works, your database is ready! ✅

---

## 2. Backend Setup

### Step 2.1: Navigate to Backend Folder

```bash
cd "Invoice Tracker/Invoice-tracker-backend"

# Or on Windows:
cd "C:\Path\To\Invoice Tracker\Invoice-tracker-backend"
```

---

### Step 2.2: Install Dependencies

```bash
npm install
```

This will install all required packages (may take 2-5 minutes).

**Expected output**:
```
added XXX packages in YYs
```

**If you see warnings**: Minor warnings are usually okay. Errors must be fixed.

---

### Step 2.3: Create Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# On Windows (if cp doesn't work):
copy .env.example .env
```

---

### Step 2.4: Edit .env File

Open `.env` in your text editor and update these values:

```env
# Database Configuration (REQUIRED)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_actual_password_from_step_1.3

# Application Configuration (REQUIRED)
PORT=3001
NODE_ENV=development

# Frontend URL (REQUIRED)
FRONTEND_URL=http://localhost:5173

# JWT Secret (REQUIRED for authentication)
# Generate a secure secret using the command below
JWT_SECRET=paste-generated-secret-here

# Email Configuration (OPTIONAL - can skip for now)
# Uncomment and configure if you want password reset emails
# EMAIL_SERVICE=gmail
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASSWORD=your-app-password
# EMAIL_FROM=your-email@gmail.com
```

**Generate JWT Secret**:
```bash
# Run this command and copy the output to JWT_SECRET in .env
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Step 2.5: Run Database Migrations

```bash
# Create invoice tables
node scripts/run-auth-migration.js
```

**Expected output**:
```
=== Running Authentication Migration ===
✓ Connected to PostgreSQL database
Executing migration...
✅ Migration completed successfully!

Created tables:
  - users
  - password_reset_tokens
```

**If you see "tables already exist"**: That's fine, migration already ran.

---

### Step 2.6: Create Initial Database Schema

Check if invoice tables exist:

```bash
psql -U invoice_tracker_user -d invoice_tracker -h localhost -c "\dt"
```

**If you see invoices, contracts, expected_invoices tables**: Skip to Step 2.7

**If tables are missing**, create them:

```bash
psql -U invoice_tracker_user -d invoice_tracker -h localhost -f scripts/migration/schema.sql
```

---

### Step 2.7: Create Admin User

```bash
node scripts/create-admin-user.js
```

**Follow the prompts**:
```
Email address: admin@yourdomain.com
First name (optional): Admin
Last name (optional): User
Password: [enter a strong password - min 8 chars, uppercase, lowercase, number]
Confirm password: [same password]
```

**Expected output**:
```
✅ Admin user created successfully!

User details:
  ID: user_1234567890_abc123
  Email: admin@yourdomain.com
  Name: Admin User
  Role: admin

You can now log in with these credentials.
```

**Remember these credentials!** You'll use them to log in.

---

### Step 2.8: Test Backend Setup

```bash
node scripts/test-auth-setup.js
```

**Expected output** (all ✅):
```
1. Testing database connection... ✅
2. Checking users table... ✅
3. Checking password_reset_tokens table... ✅
4. Testing password hashing... ✅
5. Testing JWT tokens... ✅
...
✅ All critical tests passed!
```

**Warnings about email** are okay if you haven't configured email yet.

---

## 3. Frontend Setup

### Step 3.1: Navigate to Frontend Folder

```bash
# From the backend folder
cd ../invoice-tracker-frontend

# Or from project root:
cd "Invoice Tracker/invoice-tracker-frontend"
```

---

### Step 3.2: Install Dependencies

```bash
npm install
```

This will install React, Vite, and other frontend dependencies (may take 2-5 minutes).

---

### Step 3.3: Verify Frontend Configuration

Check that the frontend is configured to connect to your backend:

```bash
# Check if there's a config file or .env
ls -la
```

**If there's a `.env` or `vite.config.js`**, verify it points to:
```
VITE_API_URL=http://localhost:3001
```

**Most likely**: The frontend uses hardcoded `http://localhost:3001` - this is fine for local development.

---

## 4. First-Time Configuration

### Step 4.1: Create Required Folders

```bash
# From backend folder
cd ../Invoice-tracker-backend

# Create folders for PDF storage
mkdir -p invoice_pdfs/deleted
mkdir -p uploads
mkdir -p backups
```

**Windows** (if mkdir -p doesn't work):
```batch
mkdir invoice_pdfs
mkdir invoice_pdfs\deleted
mkdir uploads
mkdir backups
```

---

### Step 4.2: Set Folder Permissions

**Linux/macOS**:
```bash
chmod 755 invoice_pdfs
chmod 755 uploads
chmod 755 backups
```

**Windows**: Usually not needed - default permissions are fine.

---

## 5. Starting the Application

### Option A: Using Two Terminal Windows (Recommended for Development)

**Terminal 1 - Backend**:
```bash
cd "Invoice Tracker/Invoice-tracker-backend"
npm run start:postgres
```

**Expected output**:
```
✓ Connected to PostgreSQL database
Invoice Tracker API running on http://localhost:3001
```

**Terminal 2 - Frontend**:
```bash
cd "Invoice Tracker/invoice-tracker-frontend"
npm run dev
```

**Expected output**:
```
VITE v7.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### Option B: Using Batch Files (Windows)

**From the backend folder**:

**Start Backend**:
Double-click: `START-POSTGRESQL-SERVER.bat`

**Start Frontend**:
```batch
cd ..\invoice-tracker-frontend
npm run dev
```

---

## 6. Verification

### Step 6.1: Test Backend API

Open a browser or use curl:

```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "ok",
  "database": "postgresql",
  "timestamp": "2025-11-03T..."
}
```

**In browser**: Visit http://localhost:3001/api/health

---

### Step 6.2: Test Frontend

**In browser**: Visit http://localhost:5173

You should see the Invoice Tracker login page or dashboard.

---

### Step 6.3: Test Login

1. Go to http://localhost:5173
2. Log in with the admin credentials you created in Step 2.7
3. You should be redirected to the dashboard

**If login fails**:
- Check backend is running (Terminal 1 should show activity)
- Check browser console for errors (F12)
- Verify credentials are correct

---

### Step 6.4: Test Database

```bash
# Check tables exist
psql -U invoice_tracker_user -d invoice_tracker -h localhost -c "\dt"

# Should list:
# - invoices
# - contracts
# - expected_invoices
# - users
# - password_reset_tokens

# Check admin user exists
psql -U invoice_tracker_user -d invoice_tracker -h localhost -c "SELECT email, role FROM users;"

# Should show your admin user
```

---

## 7. Common Issues

### Issue: "Cannot connect to database"

**Check**:
```bash
# Is PostgreSQL running?
pg_isready

# Can you connect manually?
psql -U invoice_tracker_user -d invoice_tracker -h localhost

# Check .env has correct credentials
cat .env | grep DB_
```

**Fix**:
- Start PostgreSQL service
- Verify DB_PASSWORD in .env matches the password from Step 1.3
- Check DB_USER, DB_NAME are correct

---

### Issue: "Port 3001 already in use"

**Check what's using the port**:
```bash
# Windows
netstat -ano | findstr :3001

# Linux/macOS
lsof -i :3001
```

**Fix**:
- Kill the process using the port
- Or change PORT in .env to a different number (e.g., 3002)

---

### Issue: "Module not found" errors

**Fix**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Windows:
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

### Issue: "Permission denied" when creating folders

**Linux/macOS**:
```bash
# Use sudo
sudo mkdir -p invoice_pdfs/deleted

# Then change ownership
sudo chown -R $USER:$USER invoice_pdfs
```

**Windows**:
- Run terminal as Administrator
- Or check folder properties and grant write permissions

---

### Issue: Frontend shows "Network Error"

**Check**:
1. Backend is running (Terminal 1 shows "running on http://localhost:3001")
2. Backend health check works: http://localhost:3001/api/health
3. CORS is enabled (should be by default)
4. Firewall allows connections

**Fix**:
- Restart backend server
- Check browser console (F12) for specific error
- Verify FRONTEND_URL in backend .env matches where frontend runs

---

### Issue: "JWT_SECRET not set" warning

**Fix**:
```bash
# Generate secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Add to .env
# JWT_SECRET=paste-output-here
```

---

### Issue: Email not sending (password reset)

**This is normal if you haven't configured email.**

**To enable** (optional):
1. Edit .env
2. Uncomment EMAIL_* variables
3. Configure with Gmail, SendGrid, or SMTP
4. See `docs/AUTHENTICATION-SETUP.md` for details

---

## 🎉 Installation Complete!

You should now have:
- ✅ Backend running on http://localhost:3001
- ✅ Frontend running on http://localhost:5173
- ✅ PostgreSQL database with tables
- ✅ Admin user created
- ✅ Authentication working

---

## 🚀 Next Steps

### 1. Configure Email (Optional)
See: `Invoice-tracker-backend/docs/AUTHENTICATION-SETUP.md`

### 2. Import Existing Data (If Migrating)
```bash
# Restore from backup
psql -U invoice_tracker_user -d invoice_tracker < backup.sql
```

### 3. Set Up Automated Backups
```bash
cd Invoice-tracker-backend
node scripts/backup/backup-postgres.js

# Schedule this to run daily
```

### 4. Production Deployment
- Use a process manager (PM2, systemd)
- Set up HTTPS/SSL
- Configure firewall
- Use production database
- Set strong passwords
- Enable monitoring

---

## 📖 Documentation

For more information, see:
- **PREREQUISITES.md** - System requirements
- **README.md** - Application overview
- **docs/AUTHENTICATION-SETUP.md** - Authentication configuration
- **docs/AUTHENTICATION-API.md** - API reference
- **docs/POSTGRESQL-SETUP.md** - Database details

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the logs:
   - Backend: Terminal 1 output
   - Frontend: Browser console (F12)
   - PostgreSQL: Check PostgreSQL logs

2. Verify all prerequisites are met

3. Try the test script:
   ```bash
   node scripts/test-auth-setup.js
   ```

4. Check existing documentation in `docs/` folder

---

## 📝 Installation Checklist

Use this to verify everything is set up:

### Prerequisites
- [ ] Node.js 16+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL 12+ installed (`psql --version`)
- [ ] Project files downloaded/cloned

### Database
- [ ] PostgreSQL service running (`pg_isready`)
- [ ] Database user created (`invoice_tracker_user`)
- [ ] Database created (`invoice_tracker`)
- [ ] Can connect to database
- [ ] Tables created (run migrations)

### Backend
- [ ] Dependencies installed (`npm install`)
- [ ] .env file created and configured
- [ ] JWT_SECRET generated and set
- [ ] Admin user created
- [ ] Test script passes
- [ ] Server starts on port 3001
- [ ] Health check responds

### Frontend
- [ ] Dependencies installed (`npm install`)
- [ ] Development server starts on port 5173
- [ ] Can access login page
- [ ] Can log in with admin credentials

### Verification
- [ ] Backend API responds: http://localhost:3001/api/health
- [ ] Frontend loads: http://localhost:5173
- [ ] Login works
- [ ] Can view dashboard

---

**All checked?** Your Invoice Tracker is fully installed and ready to use! 🎊
