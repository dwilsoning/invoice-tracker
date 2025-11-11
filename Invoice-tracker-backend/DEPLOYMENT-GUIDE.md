# Invoice Tracker - AWS EC2 Deployment Guide

Complete step-by-step guide to deploy the Invoice Tracker application on AWS EC2 with PostgreSQL.

## Prerequisites

- AWS Account with EC2 access
- SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- Domain name (optional, for HTTPS)
- Basic knowledge of Linux commands

---

## Part 1: AWS EC2 Instance Setup

### Step 1: Launch EC2 Instance

1. **Log in to AWS Console**
   - Navigate to EC2 Dashboard
   - Click "Launch Instance"

2. **Configure Instance**
   - **Name**: `invoice-tracker-server`
   - **AMI**: Ubuntu Server 22.04 LTS (free tier eligible)
   - **Instance Type**: t2.medium (recommended) or t2.small (minimum)
   - **Key Pair**: Create new or use existing key pair
     - Download and save the `.pem` file securely
     - On Mac/Linux: `chmod 400 your-key.pem`

3. **Configure Security Group**

   Create security group with the following inbound rules:

   | Type  | Protocol | Port Range | Source        | Description          |
   |-------|----------|------------|---------------|----------------------|
   | SSH   | TCP      | 22         | Your IP       | SSH access           |
   | HTTP  | TCP      | 80         | 0.0.0.0/0     | Web traffic          |
   | HTTPS | TCP      | 443        | 0.0.0.0/0     | Secure web traffic   |
   | Custom| TCP      | 3001       | 0.0.0.0/0     | Backend API (temp)   |
   | Custom| TCP      | 5173       | 0.0.0.0/0     | Frontend Dev (temp)  |

   **Note**: Ports 3001 and 5173 are temporary for testing. Remove after setting up Nginx reverse proxy.

4. **Storage**
   - Root volume: 20-30 GB (General Purpose SSD - gp3)

5. **Launch Instance**
   - Click "Launch Instance"
   - Wait for instance state to be "Running"
   - Note the Public IPv4 address

### Step 2: Connect to EC2 Instance

```bash
# On Mac/Linux
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# On Windows with PuTTY
# Use PuTTYgen to convert .pem to .ppk
# Then connect using PuTTY with the .ppk file
```

---

## Part 2: Server Environment Setup

### Step 3: Update System and Install Dependencies

```bash
# Update package manager
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

---

## Part 3: PostgreSQL Database Setup

### Step 4: Configure PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user
sudo -u postgres psql
```

### Step 5: Create Database and User

**Run these commands in the PostgreSQL prompt:**

```sql
-- Create database
CREATE DATABASE invoice_tracker;

-- Create user with password (CHANGE THIS PASSWORD!)
CREATE USER invoice_admin WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_admin;

-- Connect to database
\c invoice_tracker

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO invoice_admin;

-- Exit PostgreSQL
\q
```

### Step 6: Create Database Schema

Create a file with the database schema:

```bash
# Create SQL file
nano ~/create_invoice_tracker_schema.sql
```

**Paste the following SQL schema:**

```sql
-- Invoice Tracker Database Schema
-- PostgreSQL 12+

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    "clientName" VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    industry VARCHAR(100),
    "isActive" BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    "contractName" VARCHAR(255) UNIQUE NOT NULL,
    "contractValue" DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    "clientId" INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    "startDate" DATE,
    "endDate" DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    "invoiceNumber" VARCHAR(255) UNIQUE NOT NULL,
    "customerName" VARCHAR(255),
    "customerContract" VARCHAR(255),
    "amountDue" DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    "dueDate" DATE,
    "invoiceDate" DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    frequency VARCHAR(50),
    "invoiceType" VARCHAR(100) DEFAULT 'Invoice',
    "pdfPath" VARCHAR(500),
    "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    "isPaid" BOOLEAN DEFAULT false,
    "paidDate" DATE,
    "additionalInfo" TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_status CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled'))
);

-- Expected invoices table (for recurring invoices)
CREATE TABLE IF NOT EXISTS expected_invoices (
    id SERIAL PRIMARY KEY,
    "contractNumber" VARCHAR(255) NOT NULL,
    "clientName" VARCHAR(255) NOT NULL,
    "expectedAmount" DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    frequency VARCHAR(50) NOT NULL,
    "expectedDate" DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Expected',
    "actualInvoiceId" INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_frequency CHECK (frequency IN ('monthly', 'quarterly', 'bi-annual', 'annual', 'adhoc'))
);

-- Invoice attachments table
CREATE TABLE IF NOT EXISTS invoice_attachments (
    id SERIAL PRIMARY KEY,
    "invoiceId" INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    "fileName" VARCHAR(500) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileType" VARCHAR(100),
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices("customerName");
CREATE INDEX IF NOT EXISTS idx_invoices_customer_contract ON invoices("customerContract");
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices("dueDate");
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices("invoiceDate");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_uploaded_at ON invoices("uploadedAt");
CREATE INDEX IF NOT EXISTS idx_contracts_contract_name ON contracts("contractName");
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts("clientId");
CREATE INDEX IF NOT EXISTS idx_clients_client_name ON clients("clientName");
CREATE INDEX IF NOT EXISTS idx_expected_invoices_contract ON expected_invoices("contractNumber");
CREATE INDEX IF NOT EXISTS idx_expected_invoices_date ON expected_invoices("expectedDate");
CREATE INDEX IF NOT EXISTS idx_expected_invoices_status ON expected_invoices(status);
CREATE INDEX IF NOT EXISTS idx_attachments_invoice_id ON invoice_attachments("invoiceId");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expected_invoices_updated_at BEFORE UPDATE ON expected_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to invoice_admin user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO invoice_admin;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO invoice_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO invoice_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO invoice_admin;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Invoice Tracker database schema created successfully!';
    RAISE NOTICE 'Database: invoice_tracker';
    RAISE NOTICE 'User: invoice_admin';
END $$;
```

**Execute the schema:**

```bash
# Run the SQL file
sudo -u postgres psql -d invoice_tracker -f ~/create_invoice_tracker_schema.sql

# Verify tables were created
sudo -u postgres psql -d invoice_tracker -c "\dt"
```

### Step 7: Configure PostgreSQL for Remote Access (from backend)

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Find and modify:
```
listen_addresses = 'localhost'  # Keep as localhost for security
```

```bash
# Edit authentication configuration
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

Add this line after the existing local connections:
```
# Invoice tracker backend connection
local   invoice_tracker   invoice_admin                     md5
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
psql -U invoice_admin -d invoice_tracker -h localhost
# Enter password when prompted
# Type \q to exit
```

---

## Part 4: Application Deployment

### Step 8: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your repo URL)
git clone https://github.com/dwilsoning/invoice-tracker.git

# Navigate to project
cd invoice-tracker
```

### Step 9: Setup Backend

```bash
# Navigate to backend directory
cd ~/invoice-tracker/Invoice-tracker-backend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Add the following to .env file:**

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_admin
DB_PASSWORD=your_secure_password_here

# JWT Secret (generate a random string)
JWT_SECRET=your_very_secure_random_jwt_secret_here_min_32_chars

# CORS Configuration (your frontend URL)
CORS_ORIGIN=http://YOUR_EC2_PUBLIC_IP:5173

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/home/ubuntu/invoice-tracker/Invoice-tracker-backend/invoice_pdfs
ATTACHMENTS_DIR=/home/ubuntu/invoice-tracker/Invoice-tracker-backend/attachments
```

**Generate secure secrets:**

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output and paste it as JWT_SECRET in .env
```

```bash
# Create required directories
mkdir -p ~/invoice-tracker/Invoice-tracker-backend/invoice_pdfs
mkdir -p ~/invoice-tracker/Invoice-tracker-backend/invoice_pdfs/deleted
mkdir -p ~/invoice-tracker/Invoice-tracker-backend/attachments
mkdir -p ~/invoice-tracker/Invoice-tracker-backend/uploads

# Set permissions
chmod 755 ~/invoice-tracker/Invoice-tracker-backend/invoice_pdfs
chmod 755 ~/invoice-tracker/Invoice-tracker-backend/attachments
chmod 755 ~/invoice-tracker/Invoice-tracker-backend/uploads
```

### Step 10: Setup Frontend

```bash
# Navigate to frontend directory
cd ~/invoice-tracker/invoice-tracker-frontend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Add the following to .env file:**

```env
# API Configuration
VITE_API_URL=http://YOUR_EC2_PUBLIC_IP:3001
```

**Replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 public IP address.**

```bash
# Build the frontend for production
npm run build

# The build will create a 'dist' folder with optimized static files
```

---

## Part 5: PM2 Process Management

### Step 11: Start Backend with PM2

```bash
# Navigate to backend directory
cd ~/invoice-tracker/Invoice-tracker-backend

# Start backend with PM2
pm2 start server-postgres.js --name invoice-tracker-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command output instructions (copy and run the generated command)
```

### Step 12: Serve Frontend with PM2

```bash
# Install serve package globally
sudo npm install -g serve

# Navigate to frontend directory
cd ~/invoice-tracker/invoice-tracker-frontend

# Start frontend with PM2
pm2 start serve --name invoice-tracker-frontend -- dist -l 5173

# Save PM2 configuration
pm2 save
```

### Step 13: Verify PM2 Status

```bash
# Check PM2 status
pm2 status

# View backend logs
pm2 logs invoice-tracker-backend --lines 50

# View frontend logs
pm2 logs invoice-tracker-frontend --lines 50

# Monitor processes
pm2 monit
```

---

## Part 6: Nginx Reverse Proxy Setup

### Step 14: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/invoice-tracker
```

**Add the following configuration:**

```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;  # Or your domain name

    # Increase body size for file uploads
    client_max_body_size 20M;

    # Frontend - serve static files
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long-running requests
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    # PDF files
    location /pdfs {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Attachments
    location /attachments {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/invoice-tracker /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Part 7: Create Admin User

### Step 15: Create Initial Admin User

```bash
# Navigate to backend directory
cd ~/invoice-tracker/Invoice-tracker-backend

# Create admin user script
nano create-admin.js
```

**Add this script:**

```javascript
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'invoice_tracker',
  user: 'invoice_admin',
  password: 'your_secure_password_here'  // Use the password from .env
});

async function createAdmin() {
  try {
    const username = 'admin';
    const email = 'admin@yourdomain.com';
    const password = 'ChangeThisPassword123!';  // CHANGE THIS!

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role',
      [username, email, hashedPassword, 'admin', true]
    );

    console.log('Admin user created successfully:');
    console.log(result.rows[0]);
    console.log('\nIMPORTANT: Change the password after first login!');

    await pool.end();
  } catch (error) {
    console.error('Error creating admin user:', error);
    await pool.end();
    process.exit(1);
  }
}

createAdmin();
```

```bash
# Run the script
node create-admin.js

# Delete the script for security
rm create-admin.js
```

---

## Part 8: Testing and Verification

### Step 16: Test the Application

```bash
# Test backend API
curl http://localhost:3001/api/health

# Should return: {"status":"ok","message":"Invoice Tracker API is running"}

# Check PM2 processes
pm2 status

# View logs
pm2 logs --lines 100
```

**Access the application:**

1. Open browser and navigate to: `http://YOUR_EC2_PUBLIC_IP`
2. You should see the Invoice Tracker login page
3. Login with the admin credentials you created
4. Change the admin password immediately

---

## Part 9: Security Hardening

### Step 17: Configure Firewall

```bash
# Install UFW (Uncomplicated Firewall)
sudo apt install -y ufw

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: Do this before enabling!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Step 18: Update Security Group

**In AWS Console:**

1. Go to EC2 → Security Groups
2. Edit inbound rules
3. **Remove** port 3001 and 5173 (no longer needed with Nginx)
4. Keep only:
   - SSH (22) - restricted to your IP
   - HTTP (80) - open to internet
   - HTTPS (443) - open to internet

### Step 19: Setup Automatic Backups

```bash
# Create backup script
nano ~/backup-invoice-tracker.sh
```

**Add backup script:**

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/ubuntu/backups"
DB_NAME="invoice_tracker"
DB_USER="invoice_admin"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
export PGPASSWORD='your_secure_password_here'
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/invoice_tracker_$DATE.sql.gz

# Backup uploaded files
tar -czf $BACKUP_DIR/invoice_pdfs_$DATE.tar.gz -C /home/ubuntu/invoice-tracker/Invoice-tracker-backend invoice_pdfs
tar -czf $BACKUP_DIR/attachments_$DATE.tar.gz -C /home/ubuntu/invoice-tracker/Invoice-tracker-backend attachments

# Remove old backups
find $BACKUP_DIR -name "invoice_tracker_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "invoice_pdfs_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "attachments_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

```bash
# Make script executable
chmod +x ~/backup-invoice-tracker.sh

# Test backup
~/backup-invoice-tracker.sh

# Schedule daily backups at 2 AM
crontab -e
```

**Add this line to crontab:**

```
0 2 * * * /home/ubuntu/backup-invoice-tracker.sh >> /home/ubuntu/backup.log 2>&1
```

---

## Part 10: SSL/HTTPS Setup (Optional but Recommended)

### Step 20: Setup SSL with Let's Encrypt

**Prerequisites:**
- Domain name pointing to your EC2 instance IP

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose redirect HTTP to HTTPS (option 2)

# Test auto-renewal
sudo certbot renew --dry-run
```

**Update frontend .env:**

```bash
cd ~/invoice-tracker/invoice-tracker-frontend
nano .env
```

Change to:
```env
VITE_API_URL=https://yourdomain.com
```

```bash
# Rebuild frontend
npm run build

# Restart PM2 services
pm2 restart all
```

---

## Common PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs
pm2 logs invoice-tracker-backend
pm2 logs invoice-tracker-frontend

# Restart services
pm2 restart invoice-tracker-backend
pm2 restart invoice-tracker-frontend
pm2 restart all

# Stop services
pm2 stop invoice-tracker-backend
pm2 stop all

# Delete from PM2
pm2 delete invoice-tracker-backend

# Monitor in real-time
pm2 monit

# View detailed info
pm2 show invoice-tracker-backend
```

---

## Updating the Application

```bash
# Pull latest changes
cd ~/invoice-tracker
git pull origin main

# Update backend
cd ~/invoice-tracker/Invoice-tracker-backend
npm install
pm2 restart invoice-tracker-backend

# Update frontend
cd ~/invoice-tracker/invoice-tracker-frontend
npm install
npm run build
pm2 restart invoice-tracker-frontend

# Check status
pm2 status
pm2 logs --lines 50
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l

# Test connection
psql -U invoice_admin -d invoice_tracker -h localhost

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs invoice-tracker-backend --lines 100

# Check backend manually
cd ~/invoice-tracker/Invoice-tracker-backend
node server-postgres.js

# Check frontend build
cd ~/invoice-tracker/invoice-tracker-frontend
npm run build
```

### Nginx Issues

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### Port Already in Use

```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 PROCESS_ID

# Or stop PM2 process
pm2 stop invoice-tracker-backend
pm2 start invoice-tracker-backend
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Find large files
sudo du -sh /home/ubuntu/invoice-tracker/* | sort -h

# Clean up old logs
pm2 flush

# Clean npm cache
npm cache clean --force
```

---

## Monitoring and Maintenance

### Setup Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### Monitor System Resources

```bash
# Install htop
sudo apt install -y htop

# Monitor resources
htop

# Check memory usage
free -h

# Check disk I/O
iostat

# Check network
netstat -tuln
```

---

## Backup and Restore

### Restore from Backup

```bash
# Stop the application
pm2 stop all

# Restore database
gunzip < /home/ubuntu/backups/invoice_tracker_YYYY-MM-DD_HH-MM-SS.sql.gz | \
  psql -U invoice_admin -h localhost invoice_tracker

# Restore files
cd /home/ubuntu/invoice-tracker/Invoice-tracker-backend
tar -xzf /home/ubuntu/backups/invoice_pdfs_YYYY-MM-DD_HH-MM-SS.tar.gz
tar -xzf /home/ubuntu/backups/attachments_YYYY-MM-DD_HH-MM-SS.tar.gz

# Restart application
pm2 restart all
```

---

## Support and Documentation

- **Repository**: https://github.com/dwilsoning/invoice-tracker
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Nginx Documentation**: https://nginx.org/en/docs/

---

## Security Checklist

- [ ] Changed default admin password
- [ ] Generated secure JWT secret
- [ ] Configured UFW firewall
- [ ] Updated EC2 Security Group (removed dev ports)
- [ ] Setup SSL/HTTPS with Let's Encrypt
- [ ] Configured automatic backups
- [ ] Restricted SSH access to specific IPs
- [ ] Enabled PM2 log rotation
- [ ] Regular system updates scheduled
- [ ] Database password is strong and secure

---

## Post-Deployment Configuration

After successful deployment, configure the application:

1. **Login as admin** - Use credentials created in Step 15
2. **Change admin password** - Go to Profile → Change Password
3. **Create regular users** - Go to User Management → Add User
4. **Upload initial data** - Import invoices, contracts, clients
5. **Test all features** - Upload PDFs, create invoices, run queries
6. **Configure expected invoices** - Set up recurring invoice expectations

---

**Deployment Complete!** 🎉

Your Invoice Tracker is now running on AWS EC2 with PostgreSQL.

Access your application at: `http://YOUR_EC2_PUBLIC_IP` (or `https://yourdomain.com` with SSL)
