#!/bin/bash

###############################################################################
# Puppeteer Fix Script - Ubuntu EC2
#
# This script installs/fixes Puppeteer dependencies including:
#   - Chrome system dependencies
#   - Google Chrome browser
#   - Puppeteer npm package (reinstall if needed)
#
# Use this if you're getting "Cannot find module 'puppeteer'" errors.
#
# Usage:
#   chmod +x scripts/install-puppeteer-deps-only.sh
#   sudo ./scripts/install-puppeteer-deps-only.sh
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_ubuntu() {
    if [ ! -f /etc/lsb-release ]; then
        print_error "This script is designed for Ubuntu"
        exit 1
    fi

    source /etc/lsb-release
    print_info "Detected: $DISTRIB_DESCRIPTION"
}

install_chrome_dependencies() {
    print_header "Installing Chrome System Dependencies"

    print_info "Updating package lists..."
    apt-get update -qq

    print_info "Installing Chrome/Chromium system libraries..."
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
        libdrm2 \
        libxkbcommon0 \
        wget

    print_success "All Chrome system dependencies installed!"
}

install_chrome() {
    print_header "Installing Google Chrome"

    # Check if Chrome is already installed
    if command -v google-chrome &> /dev/null; then
        print_success "Google Chrome already installed"
        google-chrome --version
        return
    fi

    print_info "Downloading Google Chrome..."
    wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/google-chrome.deb

    print_info "Installing Google Chrome..."
    apt-get install -y -qq /tmp/google-chrome.deb 2>&1 | grep -v "^N: " || true

    # Clean up
    rm /tmp/google-chrome.deb

    # Verify installation
    if command -v google-chrome &> /dev/null; then
        print_success "Google Chrome installed successfully"
        google-chrome --version
    else
        print_error "Failed to install Google Chrome"
        exit 1
    fi
}

reinstall_puppeteer() {
    print_header "Reinstalling Puppeteer npm Package"

    # Find the app directory
    APP_DIR="/home/ubuntu/Invoice-tracker-backend"

    if [ ! -d "$APP_DIR" ]; then
        print_error "Application directory not found: $APP_DIR"
        print_info "Please update APP_DIR in this script or run from the correct location"
        return 1
    fi

    cd "$APP_DIR"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_info "node_modules not found, running npm install..."
        sudo -u ubuntu npm install
        print_success "npm install completed"
        return
    fi

    # Remove existing puppeteer packages
    print_info "Removing existing Puppeteer packages..."
    sudo -u ubuntu rm -rf node_modules/puppeteer node_modules/puppeteer-core

    # Reinstall puppeteer
    print_info "Reinstalling Puppeteer..."
    sudo -u ubuntu npm install puppeteer@^24.31.0 puppeteer-core@^24.31.0

    # Verify installation
    if [ -d "node_modules/puppeteer" ]; then
        print_success "Puppeteer reinstalled successfully"

        # Test that it can be required
        if sudo -u ubuntu node -e "require('puppeteer')" 2>/dev/null; then
            print_success "Puppeteer module can be loaded"
        else
            print_error "Puppeteer installed but cannot be loaded"
            return 1
        fi
    else
        print_error "Puppeteer installation failed"
        return 1
    fi
}

test_puppeteer() {
    print_header "Testing Puppeteer"

    APP_DIR="/home/ubuntu/Invoice-tracker-backend"

    if [ ! -d "$APP_DIR" ]; then
        print_error "Skipping test - application directory not found"
        return
    fi

    cd "$APP_DIR"

    print_info "Running quick Puppeteer test..."

    if timeout 30 sudo -u ubuntu node -e "
        const puppeteer = require('puppeteer');
        (async () => {
            console.log('Launching browser...');
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('✓ Browser launched successfully!');
            await browser.close();
            console.log('✓ Test completed successfully!');
        })();
    " 2>&1; then
        print_success "Puppeteer test passed!"
    else
        print_error "Puppeteer test failed"
        print_info "Check the error messages above for details"
        return 1
    fi
}

###############################################################################
# Main Installation
###############################################################################

main() {
    echo -e "\n${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║           Puppeteer Fix Script - Ubuntu EC2                  ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    check_root
    check_ubuntu

    # Run all installation steps
    install_chrome_dependencies
    install_chrome
    reinstall_puppeteer
    test_puppeteer

    echo ""
    print_header "Installation Complete"

    echo -e "${GREEN}✓ All Puppeteer components have been installed/reinstalled${NC}\n"

    echo "What was installed/updated:"
    echo "  • Chrome system dependencies (X11, GTK, audio, graphics libs)"
    echo "  • Google Chrome browser"
    echo "  • Puppeteer npm package (reinstalled)"
    echo ""

    echo "Next steps:"
    echo "  1. Restart your application service:"
    echo "     ${YELLOW}sudo systemctl restart invoice-tracker${NC}"
    echo ""
    echo "  2. Check service status:"
    echo "     ${YELLOW}sudo systemctl status invoice-tracker${NC}"
    echo ""
    echo "  3. Test the SA Health checker manually:"
    echo "     ${YELLOW}cd /home/ubuntu/Invoice-tracker-backend${NC}"
    echo "     ${YELLOW}node scripts/sa-health-status-checker.js 3000001140${NC}"
    echo ""

    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Puppeteer fix completed successfully! 🎉                    ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
}

# Run main function
main
