# Invoice Tracker - Caddy Server Reverse Proxy Setup

This guide explains how to set up Caddy Server as a reverse proxy for the Invoice Tracker application. Caddy automatically handles HTTPS/SSL certificates via Let's Encrypt.

## Prerequisites

- AWS EC2 instance (Ubuntu 22.04) with Invoice Tracker already installed
- Domain name pointing to your EC2 instance IP address
- Security group allowing ports: 22, 80, 443
- Invoice Tracker backend and frontend running on ports 3001 and 5173

## Why Caddy Instead of Nginx?

- **Automatic HTTPS**: Caddy automatically obtains and renews SSL certificates from Let's Encrypt
- **Simpler Configuration**: More intuitive configuration syntax
- **Zero Downtime Reloads**: Configuration changes without service interruption
- **Built-in Security**: Secure defaults out of the box

---

## Step 1: Install Caddy Server

### Option A: Install from Official Repository (Recommended)

```bash
# Install dependencies
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# Add Caddy GPG key
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

# Add Caddy repository
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Update and install Caddy
sudo apt update
sudo apt install caddy
```

### Option B: Install Binary Directly

```bash
# Download latest Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Verify Installation

```bash
caddy version
```

You should see output like: `v2.7.6 h1:...`

---

## Step 2: Remove Nginx (If Installed)

If you previously set up Nginx, remove it to avoid port conflicts:

```bash
# Stop Nginx
sudo systemctl stop nginx

# Disable Nginx from starting on boot
sudo systemctl disable nginx

# Optional: Completely remove Nginx
sudo apt remove --purge nginx nginx-common nginx-full -y
sudo apt autoremove -y
```

---

## Step 3: Configure Caddy

### Option A: Using IP Address (No Domain)

If you don't have a domain name yet, use this configuration with your EC2 IP address:

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
# Invoice Tracker - IP-based configuration (HTTP only)

http://YOUR_EC2_IP {
    # Increase max upload size for PDF uploads
    request_body {
        max_size 20MB
    }

    # Frontend - serve from localhost:5173
    handle /* {
        reverse_proxy localhost:5173
    }

    # Backend API
    handle /api/* {
        reverse_proxy localhost:3001 {
            # Increase timeouts for large PDF processing
            transport http {
                read_timeout 600s
                write_timeout 600s
            }
        }
    }

    # PDF files
    handle /pdfs/* {
        reverse_proxy localhost:3001
    }

    # Attachments
    handle /attachments/* {
        reverse_proxy localhost:3001
    }

    # Logging
    log {
        output file /var/log/caddy/invoice-tracker.log {
            roll_size 10MB
            roll_keep 5
        }
    }
}
EOF
```

**Replace `YOUR_EC2_IP` with your actual EC2 instance IP address.**

### Option B: Using Domain Name (Automatic HTTPS)

If you have a domain name pointing to your EC2 instance, use this configuration:

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
# Invoice Tracker - Domain-based configuration with automatic HTTPS

yourdomain.com {
    # Increase max upload size for PDF uploads
    request_body {
        max_size 20MB
    }

    # Frontend - serve from localhost:5173
    handle /* {
        reverse_proxy localhost:5173
    }

    # Backend API
    handle /api/* {
        reverse_proxy localhost:3001 {
            # Increase timeouts for large PDF processing
            transport http {
                read_timeout 600s
                write_timeout 600s
            }
        }
    }

    # PDF files
    handle /pdfs/* {
        reverse_proxy localhost:3001
    }

    # Attachments
    handle /attachments/* {
        reverse_proxy localhost:3001
    }

    # Logging
    log {
        output file /var/log/caddy/invoice-tracker.log {
            roll_size 10MB
            roll_keep 5
        }
    }

    # Optional: Add security headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS protection
        X-XSS-Protection "1; mode=block"
    }
}

# Optional: Redirect www to non-www
www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
EOF
```

**Replace `yourdomain.com` with your actual domain name.**

---

## Step 4: Update Backend Environment Variables

Update your backend `.env` file to set the correct CORS origin:

### For IP Address Setup:

```bash
cd ~/invoice-tracker/Invoice-tracker-backend
nano .env
```

Update the `CORS_ORIGIN` line:
```
CORS_ORIGIN=http://YOUR_EC2_IP
```

### For Domain Setup:

```
CORS_ORIGIN=https://yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter).

---

## Step 5: Update Frontend Environment Variables

Update your frontend `.env` file:

### For IP Address Setup:

```bash
cd ~/invoice-tracker/invoice-tracker-frontend
nano .env
```

Content:
```
VITE_API_URL=http://YOUR_EC2_IP
```

### For Domain Setup:

```
VITE_API_URL=https://yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter).

### Rebuild Frontend

After changing the frontend `.env`, rebuild:

```bash
npm run build
pm2 restart invoice-tracker-frontend
```

---

## Step 6: Create Log Directory

```bash
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
```

---

## Step 7: Validate and Start Caddy

### Validate Configuration

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

You should see: `Valid configuration`

### Start Caddy

```bash
# Start Caddy
sudo systemctl start caddy

# Enable Caddy to start on boot
sudo systemctl enable caddy

# Check status
sudo systemctl status caddy
```

You should see: `Active: active (running)`

---

## Step 8: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Remove direct access to backend/frontend ports (optional security measure)
# Only do this if Caddy is working properly!
# sudo ufw deny 3001/tcp
# sudo ufw deny 5173/tcp

# Reload firewall
sudo ufw reload

# Check status
sudo ufw status
```

**Note:** Keep ports 3001 and 5173 open initially until you confirm Caddy is working.

---

## Step 9: Update AWS Security Group

In your AWS EC2 Security Group:

1. **Keep these rules:**
   - Type: SSH, Port: 22, Source: Your IP (or 0.0.0.0/0)
   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0

2. **Remove these rules (after confirming Caddy works):**
   - Port 3001 (backend)
   - Port 5173 (frontend)

---

## Step 10: Restart Backend

Restart the backend to apply the CORS_ORIGIN change:

```bash
pm2 restart invoice-tracker-backend
```

---

## Step 11: Test the Application

### For IP Address Setup:
- Open browser: `http://YOUR_EC2_IP`
- Try logging in
- Upload a test PDF

### For Domain Setup:
- Open browser: `https://yourdomain.com`
- Caddy will automatically obtain an SSL certificate (may take 30 seconds)
- Try logging in
- Upload a test PDF

---

## Step 12: Verify HTTPS Certificate (Domain Setup Only)

If using a domain, check the SSL certificate:

```bash
# Check certificate status
sudo caddy list-modules | grep tls

# View certificates
sudo ls -la /var/lib/caddy/.local/share/caddy/certificates/
```

Caddy automatically renews certificates before they expire!

---

## Common Caddy Commands

```bash
# Check status
sudo systemctl status caddy

# Restart Caddy
sudo systemctl restart caddy

# Reload configuration without downtime
sudo systemctl reload caddy

# View logs
sudo journalctl -u caddy -f

# View access logs
sudo tail -f /var/log/caddy/invoice-tracker.log

# Validate configuration
sudo caddy validate --config /etc/caddy/Caddyfile

# Format Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile

# Test configuration
sudo caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```

---

## Troubleshooting

### Issue: "bind: address already in use"

**Cause:** Nginx or another service is using port 80 or 443.

**Solution:**
```bash
# Check what's using port 80
sudo lsof -i :80

# Stop the conflicting service
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### Issue: "Failed to load resource: net::ERR_CONNECTION_REFUSED"

**Cause:** Backend or frontend not running.

**Solution:**
```bash
# Check PM2 status
pm2 status

# Restart services
pm2 restart all

# Check logs
pm2 logs
```

### Issue: SSL certificate not obtained (domain setup)

**Cause:** Domain not pointing to EC2 IP, or ports 80/443 blocked.

**Solution:**
```bash
# Verify domain DNS
nslookup yourdomain.com

# Check if ports are open
sudo netstat -tlnp | grep ':80\|:443'

# Check Caddy logs
sudo journalctl -u caddy -n 50
```

### Issue: "CORS policy" error

**Cause:** CORS_ORIGIN mismatch in backend .env.

**Solution:**
```bash
cd ~/invoice-tracker/Invoice-tracker-backend
nano .env

# For domain: CORS_ORIGIN=https://yourdomain.com
# For IP: CORS_ORIGIN=http://YOUR_EC2_IP

pm2 restart invoice-tracker-backend
```

### Issue: Large PDF upload fails

**Cause:** Timeout or size limit.

**Solution:** Already configured in Caddyfile with:
- `max_size 20MB`
- `read_timeout 600s`
- `write_timeout 600s`

If still failing, check backend logs:
```bash
pm2 logs invoice-tracker-backend
```

---

## Advanced Configuration

### Add Basic Authentication

Protect the application with username/password:

```bash
sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'EOF'

yourdomain.com {
    # Add basic auth
    basicauth /* {
        admin $2a$14$Zkx19XLiW6VYouLHR5NmfOFU0z2GTNmpkT/5qqR7hx4IjWJPDhjvO
    }

    # ... rest of configuration
}
EOF
```

Generate password hash:
```bash
caddy hash-password
```

### Rate Limiting

Limit API requests to prevent abuse:

```bash
handle /api/* {
    rate_limit {
        zone api 10r/s
    }
    reverse_proxy localhost:3001
}
```

### Add Multiple Domains

```bash
yourdomain.com, www.yourdomain.com, app.yourdomain.com {
    # Configuration
}
```

---

## Migrating from Nginx to Caddy

If you're currently using Nginx:

1. **Backup Nginx config:**
```bash
sudo cp /etc/nginx/sites-available/invoice-tracker ~/nginx-backup.conf
```

2. **Stop Nginx:**
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

3. **Follow steps above to install and configure Caddy**

4. **Start Caddy:**
```bash
sudo systemctl start caddy
sudo systemctl enable caddy
```

5. **Test thoroughly before removing Nginx:**
```bash
# Only after confirming everything works:
sudo apt remove --purge nginx nginx-common nginx-full -y
```

---

## Comparison: Nginx vs Caddy

| Feature | Nginx | Caddy |
|---------|-------|-------|
| SSL Certificates | Manual (Certbot) | Automatic |
| Configuration | Complex | Simple |
| HTTPS Renewal | Cron job | Automatic |
| Default Security | Manual setup | Secure by default |
| Reloading | `systemctl reload` | Zero-downtime |
| HTTP/2 | Manual enable | Automatic |

---

## Security Best Practices

1. **Use a domain with HTTPS** (not just IP address)
2. **Keep Caddy updated:**
   ```bash
   sudo apt update && sudo apt upgrade caddy
   ```
3. **Monitor logs regularly:**
   ```bash
   sudo journalctl -u caddy --since today
   ```
4. **Block direct access to backend/frontend ports** via AWS Security Group
5. **Enable automatic security updates:**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

---

## Backup and Restore

### Backup Caddy Configuration

```bash
sudo cp /etc/caddy/Caddyfile ~/caddy-backup-$(date +%Y%m%d).conf
```

### Restore Configuration

```bash
sudo cp ~/caddy-backup-YYYYMMDD.conf /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Support and Resources

- **Caddy Documentation:** https://caddyserver.com/docs/
- **Caddy Community Forum:** https://caddy.community/
- **Invoice Tracker Issues:** https://github.com/dwilsoning/invoice-tracker/issues

---

## Summary Checklist

- [ ] Caddy installed and running
- [ ] Caddyfile configured (IP or domain)
- [ ] Backend CORS_ORIGIN updated
- [ ] Frontend VITE_API_URL updated and rebuilt
- [ ] Firewall rules configured
- [ ] AWS Security Group updated
- [ ] Application accessible via Caddy
- [ ] Login and file upload working
- [ ] HTTPS certificate obtained (domain setup)
- [ ] Nginx disabled/removed (if previously installed)

---

For detailed deployment instructions for the Invoice Tracker application itself, see **DEPLOYMENT-GUIDE.md**.
