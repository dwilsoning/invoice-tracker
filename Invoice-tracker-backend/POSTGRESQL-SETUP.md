# PostgreSQL Setup Guide for Invoice Tracker

This guide will help you install PostgreSQL and migrate your Invoice Tracker from SQLite to PostgreSQL.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Install PostgreSQL](#install-postgresql)
3. [Create Database](#create-database)
4. [Configure Application](#configure-application)
5. [Install Dependencies](#install-dependencies)
6. [Run Initial Setup](#run-initial-setup)
7. [Migrate Existing Data](#migrate-existing-data)
8. [Start the Application](#start-the-application)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Administrator/root access for PostgreSQL installation

---

## Install PostgreSQL

### For Windows (Recommended for WSL users)

#### Option 1: Install PostgreSQL for Windows

1. **Download PostgreSQL**
   - Visit https://www.postgresql.org/download/windows/
   - Download the PostgreSQL installer for Windows (latest version recommended)
   - Or use the direct link: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Run the Installer**
   - Run the downloaded installer
   - Click "Next" through the setup wizard
   - Choose installation directory (default is fine)
   - Select components: PostgreSQL Server, pgAdmin 4, Command Line Tools
   - Choose data directory (default is fine)
   - **Set a password for the postgres superuser** (REMEMBER THIS PASSWORD!)
   - Port: Use default 5432
   - Locale: Default locale
   - Complete the installation

3. **Verify Installation**
   ```powershell
   # Open PowerShell or Command Prompt
   psql --version
   ```

#### Option 2: Install PostgreSQL in WSL

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo service postgresql start

# Check status
sudo service postgresql status
```

### For Linux (Native)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### For macOS

```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Or download from: https://postgresapp.com/
```

---

## Create Database

### For Windows PostgreSQL:

1. **Open pgAdmin 4** (installed with PostgreSQL)
   - Or use SQL Shell (psql) from Start Menu

2. **Using pgAdmin 4:**
   - Right-click "Databases" → "Create" → "Database"
   - Name: `invoice_tracker`
   - Owner: postgres
   - Click "Save"

3. **Create User (Optional but Recommended):**
   - Right-click "Login/Group Roles" → "Create" → "Login/Group Role"
   - General tab: Name: `invoice_tracker_user`
   - Definition tab: Password: (choose a secure password)
   - Privileges tab: Check "Can login?"
   - Click "Save"

   - Right-click `invoice_tracker` database → "Properties" → "Security"
   - Add `invoice_tracker_user` with ALL privileges

4. **Using SQL Shell (psql):**
   ```sql
   -- Connect as postgres user
   -- Password: (enter the password you set during installation)

   -- Create database
   CREATE DATABASE invoice_tracker;

   -- Create user
   CREATE USER invoice_tracker_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;

   -- Connect to the database
   \c invoice_tracker

   -- Grant schema privileges
   GRANT ALL ON SCHEMA public TO invoice_tracker_user;

   -- Quit
   \q
   ```

### For Linux/WSL PostgreSQL:

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE invoice_tracker;
CREATE USER invoice_tracker_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;

# Connect to the database
\c invoice_tracker

# Grant schema privileges
GRANT ALL ON SCHEMA public TO invoice_tracker_user;

# Exit
\q
```

---

## Configure Application

1. **Create Environment File**
   ```bash
   cd /path/to/Invoice-tracker-backend
   cp .env.example .env
   ```

2. **Edit .env File**

   Open `.env` in a text editor and update the values:

   ```env
   # PostgreSQL Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=invoice_tracker
   DB_USER=invoice_tracker_user
   DB_PASSWORD=your_secure_password_here

   # Application Configuration
   PORT=3001
   NODE_ENV=development
   ```

   **For Windows users:** If you installed PostgreSQL in Windows (not WSL), use:
   ```env
   DB_HOST=localhost
   # or DB_HOST=127.0.0.1
   ```

   **For WSL users connecting to Windows PostgreSQL:**
   ```env
   # Get Windows host IP from WSL
   # Run in WSL: cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
   DB_HOST=172.x.x.x  # (use the IP from the command above)
   ```

---

## Install Dependencies

```bash
cd /path/to/Invoice-tracker-backend

# Install Node.js dependencies
npm install

# Verify PostgreSQL packages are installed
npm list pg dotenv
```

---

## Run Initial Setup

1. **Create Database Schema**

   **Option A: Using psql command line**
   ```bash
   # For Windows PostgreSQL
   psql -U invoice_tracker_user -d invoice_tracker -f schema.sql
   # Password: (enter your password)

   # For Linux/WSL PostgreSQL
   sudo -u postgres psql -d invoice_tracker -f schema.sql
   ```

   **Option B: Using pgAdmin 4**
   - Open pgAdmin 4
   - Navigate to: Servers → PostgreSQL → Databases → invoice_tracker
   - Click Tools → Query Tool
   - Open `schema.sql` file
   - Click "Execute" (F5)

2. **Verify Schema Creation**
   ```bash
   psql -U invoice_tracker_user -d invoice_tracker -c "\dt"
   ```

   You should see three tables:
   - invoices
   - expected_invoices
   - contracts

---

## Migrate Existing Data

If you have existing data in SQLite that you want to migrate to PostgreSQL:

1. **Ensure SQLite database exists**
   ```bash
   ls -la invoices.db
   ```

2. **Run Migration Script**
   ```bash
   npm run migrate
   ```

   This will:
   - Read all data from your SQLite database (`invoices.db`)
   - Insert/update all records in PostgreSQL
   - Preserve all invoices, expected invoices, and contracts

3. **Verify Migration**
   ```bash
   # Check invoice count
   psql -U invoice_tracker_user -d invoice_tracker -c "SELECT COUNT(*) FROM invoices;"

   # Check a sample invoice
   psql -U invoice_tracker_user -d invoice_tracker -c "SELECT invoice_number, client, invoice_type FROM invoices LIMIT 5;"
   ```

---

## Start the Application

### Using PostgreSQL Version:

```bash
# Development mode (with auto-reload)
npm run dev:postgres

# Production mode
npm run start:postgres
```

The server will start on `http://localhost:3001`

### To Continue Using SQLite:

```bash
# Your existing commands still work
npm start
npm run dev
```

---

## Troubleshooting

### Connection Refused Error

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   # Windows
   # Check Services app or Task Manager for "postgresql" service

   # Linux/WSL
   sudo service postgresql status
   sudo service postgresql start
   ```

2. Check PostgreSQL is listening on port 5432:
   ```bash
   netstat -an | grep 5432
   ```

3. Check `postgresql.conf`:
   ```
   listen_addresses = 'localhost' # or '*' for all interfaces
   ```

### Authentication Failed Error

**Problem:** `password authentication failed for user "invoice_tracker_user"`

**Solutions:**
1. Verify password in `.env` file matches database password
2. Check `pg_hba.conf` file:
   ```
   # Find location
   psql -U postgres -c "SHOW hba_file;"

   # Add this line for local connections:
   host    invoice_tracker    invoice_tracker_user    127.0.0.1/32    md5
   ```

3. Reload PostgreSQL configuration:
   ```bash
   # Linux/WSL
   sudo service postgresql reload

   # Windows: Restart PostgreSQL service from Services app
   ```

### Permission Denied Errors

**Problem:** `permission denied for schema public`

**Solution:**
```sql
\c invoice_tracker
GRANT ALL ON SCHEMA public TO invoice_tracker_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_tracker_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_tracker_user;
```

### WSL Can't Connect to Windows PostgreSQL

**Problem:** Connection timeout when connecting from WSL to Windows PostgreSQL

**Solutions:**
1. **Allow Windows Firewall:**
   - Open Windows Defender Firewall
   - Advanced settings → Inbound Rules
   - New Rule → Port → TCP → 5432
   - Allow the connection
   - Name it "PostgreSQL"

2. **Configure PostgreSQL to Listen on All Interfaces:**
   - Edit `postgresql.conf`:
     ```
     listen_addresses = '*'
     ```
   - Edit `pg_hba.conf`, add:
     ```
     host    all    all    172.0.0.0/8    md5
     ```
   - Restart PostgreSQL service

3. **Get Windows Host IP from WSL:**
   ```bash
   cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
   # Use this IP in your .env file as DB_HOST
   ```

### Migration Script Fails

**Problem:** Migration script crashes or fails partway through

**Solutions:**
1. Check PostgreSQL connection first:
   ```bash
   node -e "const {Pool}=require('pg');const pool=new Pool({host:'localhost',database:'invoice_tracker',user:'invoice_tracker_user',password:'your_password'});pool.query('SELECT NOW()',(e,r)=>{console.log(e||r.rows);pool.end()});"
   ```

2. Check SQLite database exists and is readable:
   ```bash
   file invoices.db
   sqlite3 invoices.db "SELECT COUNT(*) FROM invoices;"
   ```

3. Run migration in verbose mode and check for specific errors

---

## Backup and Restore

### Backup PostgreSQL Database

```bash
# Full database backup
pg_dump -U invoice_tracker_user -d invoice_tracker -F c -f invoice_tracker_backup.dump

# Plain SQL backup
pg_dump -U invoice_tracker_user -d invoice_tracker > invoice_tracker_backup.sql
```

### Restore PostgreSQL Database

```bash
# From custom format
pg_restore -U invoice_tracker_user -d invoice_tracker invoice_tracker_backup.dump

# From SQL file
psql -U invoice_tracker_user -d invoice_tracker < invoice_tracker_backup.sql
```

---

## Performance Optimization (Optional)

For better performance with large datasets:

```sql
-- Connect to database
\c invoice_tracker

-- Create additional indexes
CREATE INDEX idx_invoices_upload_date ON invoices(upload_date);
CREATE INDEX idx_invoices_payment_date ON invoices(payment_date);
CREATE INDEX idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_frequency ON invoices(frequency);

-- Analyze tables
ANALYZE invoices;
ANALYZE expected_invoices;
ANALYZE contracts;
```

---

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)

---

## Support

If you encounter issues not covered in this guide:

1. Check PostgreSQL logs:
   ```bash
   # Windows: Check Event Viewer → Windows Logs → Application
   # Linux: tail -f /var/log/postgresql/postgresql-*.log
   ```

2. Check Node.js application logs in the terminal where you run the server

3. Verify all environment variables are correctly set in `.env`

4. Test database connection independently before running the full application
