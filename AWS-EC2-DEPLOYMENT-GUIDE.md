# Invoice Tracker - AWS EC2 Deployment Guide

Complete step-by-step guide for deploying Invoice Tracker to AWS EC2 with full data migration.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [AWS Setup](#aws-setup)
3. [EC2 Instance Configuration](#ec2-instance-configuration)
4. [Install Dependencies](#install-dependencies)
5. [Database Setup](#database-setup)
6. [Data Migration](#data-migration)
7. [Application Deployment](#application-deployment)
8. [SSL/HTTPS Setup](#ssl-https-setup)
9. [Domain Configuration](#domain-configuration)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### On Your Local Machine
- AWS Account with billing enabled
- AWS CLI installed and configured
- SSH client (PuTTY for Windows, or native SSH)
- Your local PostgreSQL database running
- All invoice PDFs and uploaded files accessible

### AWS Services Required
- EC2 (Elastic Compute Cloud) - Server hosting
- RDS (Optional) - Managed PostgreSQL database
- S3 (Optional) - File storage
- Route 53 (Optional) - DNS management
- Certificate Manager (Optional) - SSL certificates

### Estimated Costs (Monthly)
- EC2 t3.small instance: ~$15-20/month
- RDS db.t3.micro: ~$15-20/month (optional)
- S3 storage: ~$0.50-5/month (depending on files)
- Data transfer: ~$5-10/month

---

## AWS Setup

### Step 1: Create AWS Account
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Follow the registration process
4. Add payment method
5. Verify identity

### Step 2: Install AWS CLI

**Windows:**
```powershell
# Download from: https://aws.amazon.com/cli/
# Run the installer
aws --version
```

**Linux/WSL:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

**macOS:**
```bash
brew install awscli
aws --version
```

### Step 3: Configure AWS CLI

```bash
aws configure
```

Provide:
- **AWS Access Key ID**: (from IAM user)
- **AWS Secret Access Key**: (from IAM user)
- **Default region**: us-east-1 (or your preferred region)
- **Default output format**: json

To create IAM credentials:
1. Go to AWS Console → IAM
2. Click "Users" → "Create User"
3. Attach policy: "AdministratorAccess" (or more restrictive)
4. Create access key → Save credentials

---

## EC2 Instance Configuration

### Step 1: Launch EC2 Instance

1. **Go to EC2 Dashboard**
   - AWS Console → EC2 → Launch Instance

2. **Configure Instance:**
   - **Name**: invoice-tracker-prod
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance Type**: t3.small (2 vCPU, 2 GB RAM)
     - t3.micro (1GB RAM) for testing only
   - **Key Pair**: Create new → Download `.pem` file (save securely!)
   - **Network Settings**:
     - Auto-assign public IP: Enable
     - Firewall (Security Group):
       - SSH (22): Your IP only
       - HTTP (80): 0.0.0.0/0
       - HTTPS (443): 0.0.0.0/0
       - PostgreSQL (5432): Your IP only (if not using RDS)
       - Custom TCP (3001): 0.0.0.0/0 (backend API)
       - Custom TCP (5173): 0.0.0.0/0 (frontend - temporary)

3. **Storage:**
   - Root volume: 30 GB gp3
   - Add volume (optional): 50 GB for files

4. **Launch Instance**

### Step 2: Connect to EC2 Instance

**Windows (Using PuTTY):**
1. Convert `.pem` to `.ppk` using PuTTYgen
2. Open PuTTY
3. Host: ubuntu@<EC2-PUBLIC-IP>
4. SSH → Auth → Private key: Select `.ppk` file
5. Connect

**Linux/macOS/WSL:**
```bash
# Make key private
chmod 400 your-key.pem

# Connect
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Replace `<EC2-PUBLIC-IP>` with your instance's public IP from AWS Console.

---

## Install Dependencies

### Step 1: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

### Step 3: Install PostgreSQL

```bash
# Install PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
```

### Step 4: Install Nginx (Web Server)

```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 5: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 6: Install Git

```bash
sudo apt install -y git
git --version
```

---

## Database Setup

### Step 1: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL console, run:
```

```sql
-- Create database
CREATE DATABASE invoice_tracker;

-- Create user
CREATE USER invoice_tracker_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD_HERE';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;

-- Connect to database
\c invoice_tracker

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO invoice_tracker_user;

-- Exit
\q
```

### Step 2: Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and change:
listen_addresses = 'localhost'  # Change to '*' for remote access

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add at the end:
host    invoice_tracker    invoice_tracker_user    0.0.0.0/0    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Step 3: Test Database Connection

```bash
psql -h localhost -U invoice_tracker_user -d invoice_tracker

# If successful, you'll see:
# invoice_tracker=>

# Exit with \q
```

---

## Data Migration

### Overview
We'll migrate:
1. Database schema and data
2. Uploaded PDF files
3. Environment configuration

### Step 1: Prepare Local Data for Export

**On your local machine:**

```bash
# Navigate to project directory
cd /path/to/Invoice\ Tracker/Invoice-tracker-backend

# Create export directory
mkdir -p migration-export

# Export database
pg_dump -U invoice_tracker_user -d invoice_tracker --clean --if-exists --no-owner --no-privileges -f migration-export/database-dump.sql

# Optional: Compress database dump
gzip migration-export/database-dump.sql

# Copy invoice PDFs
cp -r invoice_pdfs migration-export/

# Copy uploads
cp -r uploads migration-export/

# Copy backups (optional)
cp -r backups migration-export/

# Create a tarball
tar -czf invoice-tracker-data.tar.gz migration-export/

# Verify tarball
ls -lh invoice-tracker-data.tar.gz
```

### Step 2: Transfer Data to EC2

**Option A: Using SCP (Recommended):**

```bash
# From your local machine
scp -i your-key.pem invoice-tracker-data.tar.gz ubuntu@<EC2-PUBLIC-IP>:~/

# This may take time depending on file size and internet speed
```

**Option B: Using AWS S3 (For large files):**

```bash
# Upload to S3
aws s3 cp invoice-tracker-data.tar.gz s3://your-bucket-name/

# On EC2 instance
aws s3 cp s3://your-bucket-name/invoice-tracker-data.tar.gz ~/
```

### Step 3: Use Migration Script

**On EC2 instance:**

The migration script (created in next section) will:
- Extract the data
- Import database dump
- Set up file directories
- Verify migration

```bash
# Upload and run the migration script
node migrate-data.js
```

---

## Application Deployment

### Step 1: Clone Repository

```bash
# Clone from GitHub
cd ~
git clone https://github.com/your-username/invoice-tracker.git
cd invoice-tracker
```

### Step 2: Setup Backend

```bash
cd Invoice-tracker-backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

**Backend .env configuration:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# Server
PORT=3001
NODE_ENV=production

# Frontend URL (update with your domain)
FRONTEND_URL=https://yourdomain.com

# JWT Secret (generate a strong one)
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE

# AWS Configuration (optional, for S3 file storage)
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=your-bucket-name
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3: Run Database Migrations

```bash
# Run authentication migration
psql -h localhost -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql

# Create admin user
node scripts/create-admin.js admin@yourdomain.com YourSecurePassword123! Admin User
```

### Step 4: Import Migrated Data

```bash
# Run the migration script
cd ~
node migrate-data.js --database-file invoice-tracker-data.tar.gz
```

### Step 5: Setup Frontend

```bash
cd ~/invoice-tracker/invoice-tracker-frontend

# Install dependencies
npm install

# Update API URL in source code
nano src/contexts/AuthContext.jsx
# Change: const API_URL = 'http://localhost:3001/api';
# To: const API_URL = 'https://api.yourdomain.com/api';

# Also update in src/App.jsx
nano src/App.jsx
# Change: const API_URL = 'http://localhost:3001/api';
# To: const API_URL = 'https://api.yourdomain.com/api';

# Build for production
npm run build

# Copy build to web server directory
sudo mkdir -p /var/www/invoice-tracker
sudo cp -r dist/* /var/www/invoice-tracker/
```

### Step 6: Start Backend with PM2

```bash
cd ~/invoice-tracker/Invoice-tracker-backend

# Start with PM2
pm2 start server-postgres.js --name invoice-tracker-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs

# Check status
pm2 status

# View logs
pm2 logs invoice-tracker-api
```

### Step 7: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/invoice-tracker
```

**Nginx configuration:**
```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/invoice-tracker;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Serve uploaded PDFs
    location /pdfs/ {
        alias /home/ubuntu/invoice-tracker/Invoice-tracker-backend/invoice_pdfs/;
        autoindex off;
    }
}
```

**Enable site:**
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/invoice-tracker /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## SSL/HTTPS Setup

### Option 1: Using Let's Encrypt (Free, Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Test auto-renewal
sudo certbot renew --dry-run

# Certificates auto-renew via cron
```

### Option 2: Using AWS Certificate Manager

1. Go to AWS Certificate Manager
2. Request public certificate
3. Add domain names
4. Verify via DNS (add CNAME records)
5. Use with AWS Load Balancer or CloudFront

---

## Domain Configuration

### Step 1: Point Domain to EC2

**If using Route 53:**
1. Go to Route 53 → Hosted Zones
2. Create hosted zone for your domain
3. Create A records:
   - `yourdomain.com` → EC2 Public IP
   - `www.yourdomain.com` → EC2 Public IP
   - `api.yourdomain.com` → EC2 Public IP
4. Update nameservers at your domain registrar

**If using external DNS:**
1. Add A records at your domain registrar:
   - `@` (root) → EC2 Public IP
   - `www` → EC2 Public IP
   - `api` → EC2 Public IP

### Step 2: Wait for DNS Propagation
- Can take 5 minutes to 48 hours
- Check: `nslookup yourdomain.com`

---

## Monitoring & Maintenance

### Setup Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop

# Monitor processes
htop

# Monitor PM2
pm2 monit

# Check disk space
df -h

# Check memory
free -h

# Check logs
pm2 logs invoice-tracker-api
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Setup Automated Backups

```bash
# Create backup script
nano ~/backup-invoice-tracker.sh
```

```bash
#!/bin/bash
# Invoice Tracker Backup Script

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/invoice-tracker/Invoice-tracker-backend"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U invoice_tracker_user -d invoice_tracker | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup files
tar -czf "$BACKUP_DIR/files-$DATE.tar.gz" $APP_DIR/invoice_pdfs $APP_DIR/uploads

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Optional: Upload to S3
# aws s3 sync $BACKUP_DIR s3://your-backup-bucket/

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x ~/backup-invoice-tracker.sh

# Test backup
./backup-invoice-tracker.sh

# Schedule daily backups via cron
crontab -e

# Add line (runs daily at 2 AM):
0 2 * * * /home/ubuntu/backup-invoice-tracker.sh >> /home/ubuntu/backup.log 2>&1
```

### System Updates

```bash
# Create update script
nano ~/update-system.sh
```

```bash
#!/bin/bash
# System update script

echo "Updating system..."
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y

echo "Restarting services..."
pm2 restart all
sudo systemctl restart nginx

echo "Update completed"
```

```bash
# Make executable
chmod +x ~/update-system.sh

# Schedule monthly updates
crontab -e

# Add line (runs first day of month at 3 AM):
0 3 1 * * /home/ubuntu/update-system.sh >> /home/ubuntu/update.log 2>&1
```

### Application Updates

```bash
# Pull latest code
cd ~/invoice-tracker
git pull origin main

# Update backend
cd Invoice-tracker-backend
npm install --production
pm2 restart invoice-tracker-api

# Update frontend
cd ~/invoice-tracker/invoice-tracker-frontend
npm install
npm run build
sudo cp -r dist/* /var/www/invoice-tracker/
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall (UFW)
- [ ] Configure security groups properly
- [ ] Install fail2ban for SSH protection
- [ ] Enable automatic security updates
- [ ] Setup CloudWatch or monitoring
- [ ] Regular backups configured
- [ ] SSL/HTTPS enabled
- [ ] Database not exposed publicly
- [ ] Strong JWT_SECRET set
- [ ] Environment variables secured
- [ ] Log rotation configured

### Enable UFW Firewall

```bash
# Install UFW
sudo apt install -y ufw

# Configure rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw allow 3001/tcp  # Backend API

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Install Fail2Ban

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Copy default config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit config
sudo nano /etc/fail2ban/jail.local

# Enable SSH protection (ensure these are set):
# [sshd]
# enabled = true
# maxretry = 3
# bantime = 3600

# Start fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# Check status
sudo fail2ban-client status
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs invoice-tracker-api

# Check if port is in use
sudo lsof -i :3001

# Check environment variables
cd ~/invoice-tracker/Invoice-tracker-backend
cat .env

# Test database connection
psql -h localhost -U invoice_tracker_user -d invoice_tracker

# Restart backend
pm2 restart invoice-tracker-api
```

### Frontend Not Loading

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t

# Check file permissions
ls -la /var/www/invoice-tracker/

# Fix permissions if needed
sudo chown -R www-data:www-data /var/www/invoice-tracker/
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Check pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t

# Check ports
sudo netstat -tlnp | grep :443
```

---

## Cost Optimization

### Using Spot Instances
- Save up to 90% on EC2 costs
- Good for non-critical environments
- May be interrupted

### Using RDS Reserved Instances
- Save up to 40% on RDS costs
- Commit to 1 or 3 years

### S3 Lifecycle Policies
- Move old files to Glacier
- Automatically delete old backups

### CloudWatch Alarms
- Monitor costs
- Get alerts when exceeding budget

---

## Rollback Plan

If deployment fails:

1. **Stop new application:**
   ```bash
   pm2 stop invoice-tracker-api
   ```

2. **Restore database from backup:**
   ```bash
   gunzip -c backups/db-YYYY-MM-DD.sql.gz | psql -U invoice_tracker_user -d invoice_tracker
   ```

3. **Restore files:**
   ```bash
   tar -xzf backups/files-YYYY-MM-DD.tar.gz -C /home/ubuntu/invoice-tracker/Invoice-tracker-backend/
   ```

4. **Revert code:**
   ```bash
   cd ~/invoice-tracker
   git checkout <previous-commit-hash>
   ```

5. **Restart application:**
   ```bash
   pm2 restart invoice-tracker-api
   ```

---

## Next Steps After Deployment

1. **Test thoroughly:**
   - Login functionality
   - Upload invoices
   - Generate reports
   - User management

2. **Setup monitoring:**
   - CloudWatch
   - Uptime Robot
   - Error tracking (Sentry)

3. **Configure backups:**
   - Database backups
   - File backups
   - S3 sync

4. **Document for team:**
   - Access credentials
   - Deployment process
   - Troubleshooting steps

5. **Setup CI/CD (optional):**
   - GitHub Actions
   - Auto-deployment on push

---

## Support & Resources

### AWS Documentation
- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)
- [S3 User Guide](https://docs.aws.amazon.com/s3/)

### Tools
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Community
- AWS Free Tier: https://aws.amazon.com/free/
- AWS Support: https://aws.amazon.com/support/

---

## Estimated Deployment Time

- AWS Setup: 30 minutes
- EC2 Configuration: 30 minutes
- Dependencies Installation: 20 minutes
- Database Setup: 15 minutes
- Data Migration: 30-120 minutes (depending on data size)
- Application Deployment: 30 minutes
- SSL Setup: 15 minutes
- Testing: 30 minutes

**Total: 3-5 hours**

---

**Deployment Complete!** Your Invoice Tracker is now running on AWS EC2 with full production setup.
