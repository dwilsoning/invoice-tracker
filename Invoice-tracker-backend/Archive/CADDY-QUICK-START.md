# Caddy Server - Quick Start Guide

Fast reference for setting up Caddy as a reverse proxy for Invoice Tracker.

## Quick Install (Ubuntu 22.04)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

## Option 1: IP Address (HTTP Only)

### 1. Configure Caddy
```bash
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
http://YOUR_EC2_IP {
    request_body {
        max_size 20MB
    }

    handle /* {
        reverse_proxy localhost:5173
    }

    handle /api/* {
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 600s
                write_timeout 600s
            }
        }
    }

    handle /pdfs/* {
        reverse_proxy localhost:3001
    }

    handle /attachments/* {
        reverse_proxy localhost:3001
    }

    log {
        output file /var/log/caddy/invoice-tracker.log
    }
}
EOF
```

Replace `YOUR_EC2_IP` with your EC2 IP address.

### 2. Update Backend
```bash
cd ~/invoice-tracker/Invoice-tracker-backend
echo "CORS_ORIGIN=http://YOUR_EC2_IP" >> .env
pm2 restart invoice-tracker-backend
```

### 3. Update Frontend
```bash
cd ~/invoice-tracker/invoice-tracker-frontend
echo "VITE_API_URL=http://YOUR_EC2_IP" > .env
npm run build
pm2 restart invoice-tracker-frontend
```

### 4. Start Caddy
```bash
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo systemctl start caddy
sudo systemctl enable caddy
```

### 5. Access Application
- URL: `http://YOUR_EC2_IP`

---

## Option 2: Domain Name (Automatic HTTPS)

### 1. Point Domain to EC2
Make sure your domain's A record points to your EC2 IP address.

### 2. Configure Caddy
```bash
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
yourdomain.com {
    request_body {
        max_size 20MB
    }

    handle /* {
        reverse_proxy localhost:5173
    }

    handle /api/* {
        reverse_proxy localhost:3001 {
            transport http {
                read_timeout 600s
                write_timeout 600s
            }
        }
    }

    handle /pdfs/* {
        reverse_proxy localhost:3001
    }

    handle /attachments/* {
        reverse_proxy localhost:3001
    }

    log {
        output file /var/log/caddy/invoice-tracker.log
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}

www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
EOF
```

Replace `yourdomain.com` with your actual domain.

### 3. Update Backend
```bash
cd ~/invoice-tracker/Invoice-tracker-backend
nano .env
```
Change:
```
CORS_ORIGIN=https://yourdomain.com
```
Save and exit, then:
```bash
pm2 restart invoice-tracker-backend
```

### 4. Update Frontend
```bash
cd ~/invoice-tracker/invoice-tracker-frontend
nano .env
```
Change to:
```
VITE_API_URL=https://yourdomain.com
```
Save and exit, then:
```bash
npm run build
pm2 restart invoice-tracker-frontend
```

### 5. Start Caddy
```bash
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
sudo systemctl start caddy
sudo systemctl enable caddy
```

### 6. Access Application
- URL: `https://yourdomain.com`
- SSL certificate will be automatically obtained in ~30 seconds

---

## Remove Nginx (if installed)

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo apt remove --purge nginx nginx-common nginx-full -y
```

---

## Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

**AWS Security Group:** Ensure ports 80 and 443 are open.

---

## Common Commands

```bash
# Check status
sudo systemctl status caddy

# Restart
sudo systemctl restart caddy

# Reload config (zero downtime)
sudo systemctl reload caddy

# View logs
sudo journalctl -u caddy -f
sudo tail -f /var/log/caddy/invoice-tracker.log

# Validate config
sudo caddy validate --config /etc/caddy/Caddyfile
```

---

## Troubleshooting

**Port already in use:**
```bash
sudo lsof -i :80
sudo systemctl stop nginx
```

**Backend not responding:**
```bash
pm2 status
pm2 restart all
pm2 logs invoice-tracker-backend
```

**CORS error:**
```bash
cd ~/invoice-tracker/Invoice-tracker-backend
nano .env
# Update CORS_ORIGIN to match your URL
pm2 restart invoice-tracker-backend
```

**SSL not working (domain setup):**
```bash
# Check domain DNS
nslookup yourdomain.com

# Check Caddy logs
sudo journalctl -u caddy -n 50

# Verify ports are open
sudo netstat -tlnp | grep ':80\|:443'
```

---

## Update Application Code

```bash
cd ~/invoice-tracker
git pull

# Update backend
cd Invoice-tracker-backend
npm install
pm2 restart invoice-tracker-backend

# Update frontend
cd ../invoice-tracker-frontend
npm install
npm run build
pm2 restart invoice-tracker-frontend
```

---

For detailed instructions, see **CADDY-SETUP.md**
