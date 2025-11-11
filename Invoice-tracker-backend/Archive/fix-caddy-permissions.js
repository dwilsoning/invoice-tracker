// This file documents the commands to fix Caddy permissions
// Run these commands on your EC2 instance:

console.log(`
Fix Caddy Log Directory Permissions
====================================

Run these commands:

# Create log directory with correct permissions
sudo mkdir -p /var/log/caddy
sudo chown -R caddy:caddy /var/log/caddy
sudo chmod 755 /var/log/caddy

# Verify permissions
ls -la /var/log/caddy

# Start Caddy
sudo systemctl start caddy
sudo systemctl status caddy

# If still having issues, check the Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
`);
