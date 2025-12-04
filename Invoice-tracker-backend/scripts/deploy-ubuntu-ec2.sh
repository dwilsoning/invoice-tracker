#!/bin/bash

###############################################################################
# Invoice Tracker Backend - Ubuntu EC2 Deployment Script
#
# This script automates the deployment of the Invoice Tracker backend on
# Ubuntu EC2 instances, including all Puppeteer dependencies.
#
# Usage:
#   chmod +x scripts/deploy-ubuntu-ec2.sh
#   sudo ./scripts/deploy-ubuntu-ec2.sh
#
# Or run directly:
#   curl -fsSL https://your-repo/scripts/deploy-ubuntu-ec2.sh | sudo bash
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="18"
APP_DIR="/home/ubuntu/Invoice-tracker-backend"
SERVICE_USER="ubuntu"
SERVICE_NAME="invoice-tracker"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

###############################################################################
# Main Installation Functions
###############################################################################

install_system_dependencies() {
    print_header "Installing System Dependencies"

    print_info "Updating package lists..."
    apt-get update -qq
    print_success "Package lists updated"

    print_info "Installing Puppeteer Chrome dependencies..."
    apt-get install -y -qq \
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
        libxkbcommon0 \
        curl \
        git > /dev/null

    print_success "All system dependencies installed"
}

install_nodejs() {
    print_header "Installing Node.js"

    # Check if Node.js is already installed
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            print_success "Node.js v$(node -v) already installed"
            return
        else
            print_warning "Node.js v$(node -v) found, upgrading to v${NODE_VERSION}.x"
        fi
    fi

    print_info "Installing Node.js ${NODE_VERSION}.x..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null
    apt-get install -y -qq nodejs > /dev/null
    print_success "Node.js v$(node -v) installed"
    print_success "npm v$(npm -v) installed"
}

install_chrome() {
    print_header "Installing Google Chrome"

    # Check if Chrome is already installed
    if command -v google-chrome &> /dev/null; then
        print_success "Google Chrome already installed"
        return
    fi

    print_info "Downloading and installing Google Chrome..."

    # Download Chrome
    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/google-chrome.deb

    # Install Chrome
    apt-get install -y -qq /tmp/google-chrome.deb 2>&1 | grep -v "^N: " || true

    # Clean up
    rm /tmp/google-chrome.deb

    # Verify installation
    if command -v google-chrome &> /dev/null; then
        print_success "Google Chrome installed successfully"
    else
        print_error "Failed to install Google Chrome"
        exit 1
    fi
}

setup_swap_space() {
    print_header "Configuring Swap Space"

    # Check if swap already exists
    if [ -f /swapfile ]; then
        print_success "Swap file already exists"
        return
    fi

    # Check instance memory
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')

    if [ "$TOTAL_MEM" -lt 2048 ]; then
        print_info "Low memory detected (${TOTAL_MEM}MB), creating 1GB swap file..."
        fallocate -l 1G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile > /dev/null
        swapon /swapfile

        # Make swap permanent
        if ! grep -q "/swapfile" /etc/fstab; then
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
        fi

        print_success "Swap space configured (1GB)"
    else
        print_info "Sufficient memory available (${TOTAL_MEM}MB), skipping swap"
    fi
}

install_application() {
    print_header "Installing Application"

    if [ ! -d "$APP_DIR" ]; then
        print_error "Application directory not found: $APP_DIR"
        print_info "Please clone your repository first:"
        print_info "  cd /home/ubuntu"
        print_info "  git clone <your-repo-url> Invoice-tracker-backend"
        exit 1
    fi

    cd "$APP_DIR"

    # Clean any existing node_modules
    print_info "Cleaning existing node_modules..."
    sudo -u $SERVICE_USER rm -rf node_modules package-lock.json
    print_success "Cleaned existing installation"

    print_info "Installing npm dependencies (this may take a few minutes)..."

    # Set Puppeteer environment variables for installation
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
    export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

    # Install with verbose output to catch any errors
    if sudo -u $SERVICE_USER npm install --verbose 2>&1 | tee /tmp/npm-install.log; then
        print_success "npm dependencies installed"
    else
        print_error "npm install failed. Check /tmp/npm-install.log for details"
        exit 1
    fi

    # Verify Puppeteer was installed
    print_info "Verifying Puppeteer installation..."
    if [ -d "$APP_DIR/node_modules/puppeteer" ]; then
        print_success "Puppeteer module found in node_modules"
    else
        print_error "Puppeteer not found in node_modules!"
        print_info "Attempting to install Puppeteer explicitly..."
        sudo -u $SERVICE_USER npm install puppeteer@^24.31.0 --save

        if [ -d "$APP_DIR/node_modules/puppeteer" ]; then
            print_success "Puppeteer installed successfully"
        else
            print_error "Failed to install Puppeteer. Manual intervention required."
            exit 1
        fi
    fi

    # Check if .env file exists
    if [ ! -f "$APP_DIR/.env" ]; then
        print_warning ".env file not found"
        print_info "Creating template .env file..."
        sudo -u $SERVICE_USER cat > "$APP_DIR/.env" << 'EOF'
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

# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
EOF
        print_warning "Please edit $APP_DIR/.env with your actual configuration"
    else
        print_success ".env file already exists"
    fi
}

create_systemd_service() {
    print_header "Creating Systemd Service"

    print_info "Creating service file at /etc/systemd/system/${SERVICE_NAME}.service"

    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Invoice Tracker Backend Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server-postgres.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Environment
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

    print_success "Service file created"

    print_info "Reloading systemd daemon..."
    systemctl daemon-reload
    print_success "Systemd daemon reloaded"

    print_info "Enabling service to start on boot..."
    systemctl enable ${SERVICE_NAME}
    print_success "Service enabled"
}

test_puppeteer() {
    print_header "Testing Puppeteer Installation"

    cd "$APP_DIR"

    print_info "Running Puppeteer test with SA Health status checker..."

    # Run a quick test (timeout after 30 seconds)
    if timeout 30 sudo -u $SERVICE_USER node -e "
        const puppeteer = require('puppeteer');
        (async () => {
            console.log('Launching browser...');
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('Browser launched successfully!');
            await browser.close();
            console.log('Test completed successfully!');
        })();
    " 2>&1; then
        print_success "Puppeteer is working correctly"
    else
        print_error "Puppeteer test failed"
        print_warning "This may be due to missing dependencies or insufficient memory"
        return 1
    fi
}

configure_firewall() {
    print_header "Firewall Configuration Reminder"

    print_info "Please ensure your EC2 Security Group allows:"
    echo "  • Inbound: Port 3000 (or your configured PORT) from your IP/Load Balancer"
    echo "  • Outbound: HTTPS (443) for SA Health website access"
    echo ""
    print_info "AWS Console → EC2 → Security Groups → Your Instance's Group"
}

show_summary() {
    print_header "Deployment Summary"

    echo -e "${GREEN}Installation Complete!${NC}\n"

    echo "Application Details:"
    echo "  • Directory: $APP_DIR"
    echo "  • Service: $SERVICE_NAME"
    echo "  • User: $SERVICE_USER"
    echo "  • Node.js: $(node -v)"
    echo "  • npm: $(npm -v)"
    echo ""

    echo "Next Steps:"
    echo ""
    echo "1. Configure your environment:"
    echo "   ${YELLOW}nano $APP_DIR/.env${NC}"
    echo ""
    echo "2. Start the service:"
    echo "   ${YELLOW}sudo systemctl start $SERVICE_NAME${NC}"
    echo ""
    echo "3. Check service status:"
    echo "   ${YELLOW}sudo systemctl status $SERVICE_NAME${NC}"
    echo ""
    echo "4. View logs:"
    echo "   ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}"
    echo ""
    echo "5. Test Puppeteer scraper:"
    echo "   ${YELLOW}cd $APP_DIR && node scripts/sa-health-status-checker.js 3000001140${NC}"
    echo ""

    print_info "Useful commands:"
    echo "  • Restart service: sudo systemctl restart $SERVICE_NAME"
    echo "  • Stop service: sudo systemctl stop $SERVICE_NAME"
    echo "  • Check service logs: sudo journalctl -u $SERVICE_NAME -n 100"
    echo "  • Follow logs: sudo journalctl -u $SERVICE_NAME -f"
    echo ""
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo -e "\n${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║        Invoice Tracker Backend - Ubuntu EC2 Deployment       ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    check_root

    print_info "Starting deployment process...\n"

    # Run installation steps
    install_system_dependencies
    install_nodejs
    install_chrome
    setup_swap_space
    install_application
    create_systemd_service
    test_puppeteer
    configure_firewall
    show_summary

    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Deployment completed successfully! 🎉                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
}

# Run main function
main
