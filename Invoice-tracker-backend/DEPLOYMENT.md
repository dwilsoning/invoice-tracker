# Ubuntu EC2 Deployment Guide

Complete guide for deploying the Invoice Tracker backend on Ubuntu EC2 with full Puppeteer support.

## Quick Start

### Automated Deployment (Recommended)

1. **SSH into your Ubuntu EC2 instance:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Clone the repository:**
   ```bash
   cd /home/ubuntu
   git clone <your-repo-url> Invoice-tracker-backend
   cd Invoice-tracker-backend
   ```

3. **Run the deployment script:**
   ```bash
   chmod +x scripts/deploy-ubuntu-ec2.sh
   sudo ./scripts/deploy-ubuntu-ec2.sh
   ```

4. **Configure your environment:**
   ```bash
   nano .env
   # Update with your database credentials and settings
   ```

5. **Start the service:**
   ```bash
   sudo systemctl start invoice-tracker
   sudo systemctl status invoice-tracker
   ```

That's it! The script handles all dependencies, Puppeteer setup, and systemd service configuration.

---

## Manual Deployment

If you prefer to deploy manually or need to customize the process:

### 1. System Requirements

- **OS**: Ubuntu 20.04 LTS or later
- **Instance Type**: t2.small or larger (t2.micro works with swap)
- **Memory**: 1GB+ RAM (512MB minimum with swap)
- **Storage**: 10GB+ (Chromium requires ~300MB)
- **Node.js**: 18.x or later

### 2. Install Dependencies

```bash
# Update system
sudo apt-get update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Puppeteer Chrome dependencies
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    libdrm2 \
    libxkbcommon0
```

### 3. Setup Swap (for t2.micro instances)

```bash
# Create 1GB swap file
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. Install Application

```bash
# Clone repository
cd /home/ubuntu
git clone <your-repo-url> Invoice-tracker-backend
cd Invoice-tracker-backend

# Install npm dependencies (includes Puppeteer + Chromium)
npm install
```

### 5. Configure Environment

```bash
# Create .env file
nano .env
```

Add your configuration:
```env
# Database Configuration
DB_USER=your_db_user
DB_HOST=your_db_host
DB_NAME=invoice_tracker
DB_PASSWORD=your_db_password
DB_PORT=5432

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_change_this

# SA Health Configuration
SA_HEALTH_ABN=75142863410
```

### 6. Create Systemd Service

```bash
sudo nano /etc/systemd/system/invoice-tracker.service
```

Add this configuration:
```ini
[Unit]
Description=Invoice Tracker Backend Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Invoice-tracker-backend
ExecStart=/usr/bin/node server-postgres.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=invoice-tracker

# Environment
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/ubuntu/Invoice-tracker-backend

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable invoice-tracker
sudo systemctl start invoice-tracker
sudo systemctl status invoice-tracker
```

---

## Testing

### Test Puppeteer

```bash
cd /home/ubuntu/Invoice-tracker-backend
node scripts/sa-health-status-checker.js 3000001140
```

Expected output:
```
🐧 Linux environment detected - using Puppeteer bundled Chrome
Checking status for invoice 3000001140...
Status detected: [status from website]
```

### Test Web Server

```bash
curl http://localhost:3000/api/health
```

### View Logs

```bash
# View recent logs
sudo journalctl -u invoice-tracker -n 100

# Follow logs in real-time
sudo journalctl -u invoice-tracker -f

# View logs with timestamps
sudo journalctl -u invoice-tracker -o short-iso
```

---

## AWS Configuration

### Security Group Settings

Configure your EC2 instance's security group:

**Inbound Rules:**
- Type: Custom TCP
- Port: 3000 (or your configured PORT)
- Source: Your IP or Load Balancer security group

**Outbound Rules:**
- Type: HTTPS
- Port: 443
- Destination: 0.0.0.0/0
- Purpose: Allow access to SA Health website

### IAM Permissions (if using RDS)

Ensure your EC2 instance role has permissions to connect to RDS:
- `rds-db:connect`

---

## Maintenance

### Service Management

```bash
# Start service
sudo systemctl start invoice-tracker

# Stop service
sudo systemctl stop invoice-tracker

# Restart service
sudo systemctl restart invoice-tracker

# Check status
sudo systemctl status invoice-tracker

# Enable auto-start on boot
sudo systemctl enable invoice-tracker

# Disable auto-start
sudo systemctl disable invoice-tracker
```

### Update Deployment

```bash
# Stop service
sudo systemctl stop invoice-tracker

# Pull latest changes
cd /home/ubuntu/Invoice-tracker-backend
git pull

# Install any new dependencies
npm install

# Start service
sudo systemctl start invoice-tracker
```

### Database Migrations

```bash
# Run migrations (if applicable)
cd /home/ubuntu/Invoice-tracker-backend
node scripts/migrate.js  # Adjust to your migration script
```

---

## Troubleshooting

### Puppeteer Issues

**Error: Failed to launch browser**
```bash
# Check if dependencies are installed
dpkg -l | grep -E 'libnss3|libgbm1|libatk-bridge'

# Reinstall dependencies
sudo apt-get install -y --reinstall libnss3 libgbm1 libatk-bridge2.0-0

# Test Puppeteer directly
node -e "
  const puppeteer = require('puppeteer');
  (async () => {
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
    console.log('Success!');
    await browser.close();
  })();
"
```

**Error: Cannot find Chrome binary**
```bash
# Check Chromium installation
ls -la node_modules/puppeteer/.local-chromium/

# Reinstall Puppeteer
rm -rf node_modules/puppeteer
npm install puppeteer
```

### Memory Issues

**Out of Memory errors**
```bash
# Check memory usage
free -h

# Check swap
swapon --show

# Add more swap
sudo fallocate -l 2G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

### Service Won't Start

```bash
# Check detailed error logs
sudo journalctl -u invoice-tracker -xe

# Check if port is already in use
sudo lsof -i :3000

# Check file permissions
ls -la /home/ubuntu/Invoice-tracker-backend

# Test manually
cd /home/ubuntu/Invoice-tracker-backend
node server-postgres.js
```

### Database Connection Issues

```bash
# Test database connection
psql -h your-db-host -U your-db-user -d invoice_tracker

# Check .env file
cat .env | grep DB_

# Check network connectivity
ping your-db-host
telnet your-db-host 5432
```

---

## Performance Optimization

### Nginx Reverse Proxy (Optional)

Install Nginx as a reverse proxy:

```bash
sudo apt-get install -y nginx

sudo nano /etc/nginx/sites-available/invoice-tracker
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/invoice-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Process Management with PM2 (Alternative)

If you prefer PM2 over systemd:

```bash
# Install PM2
sudo npm install -g pm2

# Start application
cd /home/ubuntu/Invoice-tracker-backend
pm2 start server-postgres.js --name invoice-tracker

# Enable startup script
pm2 startup systemd
pm2 save

# Monitor
pm2 monit
pm2 logs invoice-tracker
```

---

## Monitoring

### Setup CloudWatch Logs (Optional)

Install CloudWatch agent:
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

Configure log forwarding:
```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### Basic Health Check Endpoint

The application includes a health check endpoint:
```bash
curl http://localhost:3000/api/health
```

---

## Security Best Practices

1. **Keep system updated:**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

2. **Use environment variables:**
   - Never commit `.env` to version control
   - Use AWS Secrets Manager for production secrets

3. **Firewall configuration:**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP (if using Nginx)
   sudo ufw allow 443/tcp  # HTTPS (if using Nginx)
   sudo ufw enable
   ```

4. **Regular backups:**
   - Backup database regularly
   - Use EBS snapshots for EC2 volumes

---

## Support

- **Deployment Issues**: Check the troubleshooting section above
- **Puppeteer Documentation**: scripts/PUPPETEER_SETUP.md
- **Application Logs**: `sudo journalctl -u invoice-tracker -f`

---

## What Gets Deployed

After successful deployment, your instance will have:

✅ Ubuntu system dependencies for Puppeteer
✅ Node.js 18.x
✅ Puppeteer with bundled Chromium
✅ Application dependencies via npm
✅ Systemd service for auto-start
✅ Swap space (if needed)
✅ Environment configuration

**Features Enabled:**
- Web scraping of SA Health invoice statuses
- Automated daily status checks via cron
- PDF invoice parsing
- REST API endpoints
- JWT authentication
- PostgreSQL database integration
