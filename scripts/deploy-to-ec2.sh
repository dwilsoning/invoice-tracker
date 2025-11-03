#!/bin/bash

#############################################
# Invoice Tracker - EC2 Deployment Script
#############################################
#
# This script automates the deployment process
# on a fresh EC2 instance
#
# Usage: bash deploy-to-ec2.sh
#
#############################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

log_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please do not run as root. Run as ubuntu user."
    exit 1
fi

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Invoice Tracker - EC2 Deployment     ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Update System
log_info "Step 1: Updating system packages..."
sudo apt update
sudo apt upgrade -y
log_success "System updated"

# Step 2: Install Node.js
log_info "Step 2: Installing Node.js 18.x..."
if command -v node &> /dev/null; then
    log_warning "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    log_success "Node.js installed: $(node --version)"
fi

# Step 3: Install PostgreSQL
log_info "Step 3: Installing PostgreSQL..."
if command -v psql &> /dev/null; then
    log_warning "PostgreSQL already installed"
else
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    log_success "PostgreSQL installed"
fi

# Step 4: Install Nginx
log_info "Step 4: Installing Nginx..."
if command -v nginx &> /dev/null; then
    log_warning "Nginx already installed"
else
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    log_success "Nginx installed"
fi

# Step 5: Install PM2
log_info "Step 5: Installing PM2..."
if command -v pm2 &> /dev/null; then
    log_warning "PM2 already installed"
else
    sudo npm install -g pm2
    log_success "PM2 installed"
fi

# Step 6: Install additional tools
log_info "Step 6: Installing additional tools..."
sudo apt install -y git htop ufw fail2ban
log_success "Additional tools installed"

# Step 7: Configure PostgreSQL
log_info "Step 7: Configuring PostgreSQL..."
read -p "Enter PostgreSQL password for invoice_tracker_user: " -s DB_PASSWORD
echo

sudo -u postgres psql << EOF
-- Create database if not exists
SELECT 'CREATE DATABASE invoice_tracker'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'invoice_tracker')\gexec

-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'invoice_tracker_user') THEN
        CREATE USER invoice_tracker_user WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;

\c invoice_tracker

GRANT ALL ON SCHEMA public TO invoice_tracker_user;
EOF

log_success "PostgreSQL configured"

# Step 8: Clone repository
log_info "Step 8: Cloning repository..."
read -p "Enter GitHub repository URL: " REPO_URL

if [ -d "$HOME/invoice-tracker" ]; then
    log_warning "Repository already exists. Updating..."
    cd "$HOME/invoice-tracker"
    git pull
else
    git clone "$REPO_URL" "$HOME/invoice-tracker"
    log_success "Repository cloned"
fi

# Step 9: Setup Backend
log_info "Step 9: Setting up backend..."
cd "$HOME/invoice-tracker/Invoice-tracker-backend"

# Install dependencies
npm install --production

# Create .env file
log_info "Creating .env file..."
cat > .env << EOF
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=${DB_PASSWORD}

# Server
PORT=3001
NODE_ENV=production

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# JWT Secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
EOF

log_success "Backend environment configured"

# Step 10: Run database migrations
log_info "Step 10: Running database migrations..."
export PGPASSWORD="${DB_PASSWORD}"
psql -h localhost -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql
log_success "Database migrations completed"

# Step 11: Create admin user
log_info "Step 11: Creating admin user..."
read -p "Enter admin email: " ADMIN_EMAIL
read -p "Enter admin password: " -s ADMIN_PASSWORD
echo

node scripts/create-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "Admin" "User"
log_success "Admin user created"

# Step 12: Setup Frontend
log_info "Step 12: Setting up frontend..."
cd "$HOME/invoice-tracker/invoice-tracker-frontend"

# Install dependencies
npm install

# Update API URL
log_info "Updating API URL in frontend..."
read -p "Enter your API domain (e.g., api.yourdomain.com): " API_DOMAIN

# Update AuthContext.jsx
sed -i "s|http://localhost:3001/api|https://${API_DOMAIN}/api|g" src/contexts/AuthContext.jsx

# Update App.jsx
sed -i "s|http://localhost:3001/api|https://${API_DOMAIN}/api|g" src/App.jsx

# Build frontend
npm run build

# Copy to web server directory
sudo mkdir -p /var/www/invoice-tracker
sudo cp -r dist/* /var/www/invoice-tracker/
sudo chown -R www-data:www-data /var/www/invoice-tracker/

log_success "Frontend built and deployed"

# Step 13: Start backend with PM2
log_info "Step 13: Starting backend with PM2..."
cd "$HOME/invoice-tracker/Invoice-tracker-backend"
pm2 start server-postgres.js --name invoice-tracker-api
pm2 save
pm2 startup | tail -n 1 | bash
log_success "Backend started with PM2"

# Step 14: Configure Nginx
log_info "Step 14: Configuring Nginx..."
read -p "Enter your main domain (e.g., yourdomain.com): " MAIN_DOMAIN

sudo tee /etc/nginx/sites-available/invoice-tracker > /dev/null << EOF
# Frontend
server {
    listen 80;
    server_name ${MAIN_DOMAIN} www.${MAIN_DOMAIN};

    root /var/www/invoice-tracker;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 80;
    server_name ${API_DOMAIN};

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout settings
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Serve PDFs
    location /pdfs/ {
        alias /home/ubuntu/invoice-tracker/Invoice-tracker-backend/invoice_pdfs/;
        autoindex off;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/invoice-tracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

log_success "Nginx configured"

# Step 15: Setup SSL with Let's Encrypt
log_info "Step 15: Setting up SSL certificates..."
read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " SETUP_SSL

if [ "$SETUP_SSL" = "y" ]; then
    sudo apt install -y certbot python3-certbot-nginx
    read -p "Enter your email for Let's Encrypt: " CERT_EMAIL
    sudo certbot --nginx -d ${MAIN_DOMAIN} -d www.${MAIN_DOMAIN} -d ${API_DOMAIN} --email ${CERT_EMAIL} --agree-tos --no-eff-email --redirect
    log_success "SSL certificates installed"
else
    log_warning "Skipping SSL setup. You can run: sudo certbot --nginx later"
fi

# Step 16: Configure Firewall
log_info "Step 16: Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
echo "y" | sudo ufw enable
log_success "Firewall configured"

# Step 17: Setup backup cron job
log_info "Step 17: Setting up automated backups..."
mkdir -p "$HOME/backups"

cat > "$HOME/backup-invoice-tracker.sh" << 'BACKUP_SCRIPT'
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/home/ubuntu/backups"
APP_DIR="/home/ubuntu/invoice-tracker/Invoice-tracker-backend"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U invoice_tracker_user -d invoice_tracker | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Backup files
tar -czf "$BACKUP_DIR/files-$DATE.tar.gz" $APP_DIR/invoice_pdfs $APP_DIR/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
BACKUP_SCRIPT

chmod +x "$HOME/backup-invoice-tracker.sh"

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/backup-invoice-tracker.sh >> $HOME/backup.log 2>&1") | crontab -

log_success "Automated backups configured (daily at 2 AM)"

# Summary
echo
echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║     Deployment Completed! 🎉          ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"
echo
echo "Your Invoice Tracker is now deployed!"
echo
echo -e "${BLUE}Access Points:${NC}"
echo "  Frontend: http://${MAIN_DOMAIN}"
echo "  Backend API: http://${API_DOMAIN}"
echo
echo -e "${BLUE}Admin Credentials:${NC}"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: (the one you entered)"
echo
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Update DNS records to point to this server"
echo "  2. Test the application thoroughly"
echo "  3. Import your data: node scripts/migrate-to-aws.js --import --file <your-data-file>"
echo "  4. Monitor logs: pm2 logs invoice-tracker-api"
echo "  5. Check status: pm2 status"
echo
echo -e "${YELLOW}Important Commands:${NC}"
echo "  Check backend: pm2 logs invoice-tracker-api"
echo "  Restart backend: pm2 restart invoice-tracker-api"
echo "  Check Nginx: sudo systemctl status nginx"
echo "  View backups: ls -lh ~/backups"
echo
log_success "Deployment script completed!"
