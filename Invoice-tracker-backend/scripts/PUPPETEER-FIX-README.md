# Puppeteer Installation Fix for EC2 Ubuntu

## Problem
After deploying to EC2 Ubuntu instance, you may encounter this error:
```
Error: Cannot find module 'puppeteer'
Require stack:
- /home/ubuntu/Invoice-tracker/Invoice-tracker-backend/server-postgres.js
```

## Root Cause
The deployment script was missing two critical components:
1. **Google Chrome installation** - Puppeteer requires Chrome/Chromium browser
2. **Puppeteer npm package verification** - The package may not install correctly during initial `npm install`

## Solution

### Option 1: Fix Existing Deployment (Quickest)
If you already have an EC2 instance running with this issue:

```bash
# SSH into your EC2 instance
ssh ubuntu@your-ec2-ip

# Download and run the fix script
cd ~/Invoice-tracker-backend
chmod +x scripts/install-puppeteer-deps-only.sh
sudo ./scripts/install-puppeteer-deps-only.sh

# Restart the service
sudo systemctl restart invoice-tracker

# Check status
sudo systemctl status invoice-tracker
```

This script will:
- Install all Chrome system dependencies
- Install Google Chrome browser
- Reinstall Puppeteer npm package
- Test that Puppeteer works
- Provide next steps

### Option 2: Fresh Deployment
For new deployments, use the updated deployment script:

```bash
# Clone your repository
cd /home/ubuntu
git clone <your-repo-url> Invoice-tracker-backend

# Run the updated deployment script
cd Invoice-tracker-backend
chmod +x scripts/deploy-ubuntu-ec2.sh
sudo ./scripts/deploy-ubuntu-ec2.sh
```

The updated deployment script now includes:
- Chrome system dependencies installation
- Google Chrome browser installation
- Enhanced npm installation with verbose logging
- Puppeteer installation verification
- Automatic retry if Puppeteer is missing

## Verification

After running either fix, verify Puppeteer is working:

```bash
# Test Puppeteer directly
cd ~/Invoice-tracker-backend
node -e "const p = require('puppeteer'); console.log('Puppeteer loaded:', !!p);"

# Test with SA Health checker
node scripts/sa-health-status-checker.js 3000001140

# Check application logs
sudo journalctl -u invoice-tracker -f
```

## Changes Made

### 1. Updated `deploy-ubuntu-ec2.sh`
- Added `install_chrome()` function to install Google Chrome
- Enhanced `install_application()` with:
  - Clean node_modules before install
  - Verbose npm install logging
  - Puppeteer installation verification
  - Explicit Puppeteer reinstall if missing
  - Puppeteer environment variables in .env template

### 2. Updated `install-puppeteer-deps-only.sh`
- Renamed to "Puppeteer Fix Script"
- Added Chrome installation
- Added Puppeteer npm package reinstallation
- Added comprehensive testing
- Better error messages and next steps

## Environment Variables

Add these to your `.env` file (automatically added by new scripts):

```env
# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## Troubleshooting

### If Chrome installation fails:
```bash
# Manual Chrome installation
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
google-chrome --version
```

### If Puppeteer still not found:
```bash
# Check if it's in node_modules
ls -la ~/Invoice-tracker-backend/node_modules | grep puppeteer

# Reinstall manually
cd ~/Invoice-tracker-backend
npm install puppeteer@^24.31.0 --save

# Verify
node -e "require('puppeteer')"
```

### If browser launch fails:
```bash
# Test with no-sandbox mode (should already be in code)
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('Success!');
  await browser.close();
})();
"
```

## Support

If you continue to have issues:
1. Check logs: `sudo journalctl -u invoice-tracker -n 100`
2. Check npm install log: `cat /tmp/npm-install.log`
3. Verify Node.js version: `node -v` (should be v18.x)
4. Check system memory: `free -h` (consider adding swap if < 1GB)

## Files Modified
- `scripts/deploy-ubuntu-ec2.sh` - Full deployment script
- `scripts/install-puppeteer-deps-only.sh` - Quick fix script
- `scripts/PUPPETEER-FIX-README.md` - This documentation
