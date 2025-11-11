# Invoice Tracker - Quick Deployment Reference

Fast reference for deploying Invoice Tracker to AWS EC2. See DEPLOYMENT-GUIDE.md for detailed instructions.

## Prerequisites
- AWS EC2 instance (Ubuntu 22.04, t2.medium)
- Security group with ports: 22, 80, 443
- SSH key pair

## Quick Setup Commands

### 1. Initial Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install everything
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git
sudo npm install -g pm2 serve
```

### 2. PostgreSQL Setup
```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE invoice_tracker;
CREATE USER invoice_admin WITH PASSWORD 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_admin;
\c invoice_tracker
GRANT ALL ON SCHEMA public TO invoice_admin;
EOF

# Run schema (download from repo)
sudo -u postgres psql -d invoice_tracker -f ~/create_invoice_tracker_schema.sql
```

### 3. Clone and Setup Application
```bash
# Clone repo
cd ~
git clone https://github.com/dwilsoning/invoice-tracker.git
cd invoice-tracker

# Backend setup
cd Invoice-tracker-backend
npm install
cat > .env << EOF
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_admin
DB_PASSWORD=YOUR_PASSWORD
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CORS_ORIGIN=http://YOUR_IP:5173
EOF

mkdir -p invoice_pdfs/deleted attachments uploads

# Frontend setup
cd ../invoice-tracker-frontend
npm install
echo "VITE_API_URL=http://YOUR_IP:3001" > .env
npm run build
```

### 4. Start with PM2
```bash
# Backend
cd ~/invoice-tracker/Invoice-tracker-backend
pm2 start server-postgres.js --name invoice-tracker-backend

# Frontend
cd ~/invoice-tracker/invoice-tracker-frontend
pm2 start serve --name invoice-tracker-frontend -- dist -l 5173

# Save and enable startup
pm2 save
pm2 startup  # Run the output command
```

### 5. Configure Nginx
```bash
sudo tee /etc/nginx/sites-available/invoice-tracker > /dev/null << 'EOF'
server {
    listen 80;
    server_name YOUR_IP;
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    location /pdfs { proxy_pass http://localhost:3001; }
    location /attachments { proxy_pass http://localhost:3001; }
}
EOF

sudo ln -s /etc/nginx/sites-available/invoice-tracker /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Create Admin User
```bash
cd ~/invoice-tracker/Invoice-tracker-backend
node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', database: 'invoice_tracker',
  user: 'invoice_admin', password: 'YOUR_PASSWORD'
});
(async () => {
  const hash = await bcrypt.hash('ChangeMe123!', 10);
  const r = await pool.query(
    'INSERT INTO users (username, email, password_hash, role) VALUES (\$1, \$2, \$3, \$4) RETURNING *',
    ['admin', 'admin@example.com', hash, 'admin']
  );
  console.log('Admin created:', r.rows[0].username);
  await pool.end();
})();
"
```

### 7. Setup Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 8. Setup Backups
```bash
mkdir ~/backups
cat > ~/backup-invoice-tracker.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
export PGPASSWORD='YOUR_PASSWORD'
pg_dump -U invoice_admin invoice_tracker | gzip > ~/backups/db_$DATE.sql.gz
tar -czf ~/backups/files_$DATE.tar.gz -C ~/invoice-tracker/Invoice-tracker-backend invoice_pdfs attachments
find ~/backups -name "*.gz" -mtime +30 -delete
EOF

chmod +x ~/backup-invoice-tracker.sh
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-invoice-tracker.sh >> ~/backup.log 2>&1") | crontab -
```

## Access Application
- URL: `http://YOUR_EC2_IP`
- Login: `admin` / `ChangeMe123!`
- **Change password immediately!**

## Common Commands

```bash
# Check status
pm2 status
pm2 logs

# Restart services
pm2 restart all

# Update application
cd ~/invoice-tracker
git pull
cd Invoice-tracker-backend && npm install && pm2 restart invoice-tracker-backend
cd ../invoice-tracker-frontend && npm install && npm run build && pm2 restart invoice-tracker-frontend

# View logs
pm2 logs invoice-tracker-backend --lines 100
sudo tail -f /var/log/nginx/error.log

# Database backup
~/backup-invoice-tracker.sh

# Check disk space
df -h
```

## SSL Setup (Optional)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (requires domain)
sudo certbot --nginx -d yourdomain.com

# Update frontend .env
cd ~/invoice-tracker/invoice-tracker-frontend
echo "VITE_API_URL=https://yourdomain.com" > .env
npm run build
pm2 restart invoice-tracker-frontend
```

## Troubleshooting

**Backend won't start:**
```bash
pm2 logs invoice-tracker-backend
cd ~/invoice-tracker/Invoice-tracker-backend && node server-postgres.js
```

**Database connection error:**
```bash
psql -U invoice_admin -d invoice_tracker -h localhost
sudo systemctl status postgresql
```

**Port already in use:**
```bash
sudo lsof -i :3001
pm2 delete invoice-tracker-backend
pm2 start server-postgres.js --name invoice-tracker-backend
```

**Nginx error:**
```bash
sudo nginx -t
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log
```

## Security Checklist
- [ ] Changed admin password
- [ ] Removed ports 3001, 5173 from Security Group
- [ ] UFW firewall enabled
- [ ] SSL certificate installed
- [ ] Backups scheduled
- [ ] Strong database password

---

For detailed instructions, see **DEPLOYMENT-GUIDE.md**
