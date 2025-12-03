#!/bin/bash

###############################################################################
# Puppeteer Dependencies Only - Ubuntu EC2
#
# This script ONLY installs system dependencies required for Puppeteer/Chrome.
# It does NOT install Node.js, npm packages, or modify your application setup.
#
# Use this if you already have everything else working and just need the
# Chrome/Chromium dependencies for Puppeteer to function.
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

###############################################################################
# Main Installation
###############################################################################

main() {
    echo -e "\n${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║        Puppeteer Chrome Dependencies Installer (Ubuntu)      ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    check_root
    check_ubuntu

    print_header "Installing Puppeteer Chrome Dependencies"

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
        libxkbcommon0

    print_success "All Puppeteer dependencies installed successfully!"

    echo ""
    print_header "Installation Complete"

    echo -e "${GREEN}✓ Chrome/Chromium system dependencies are now installed${NC}\n"

    echo "What was installed:"
    echo "  • X11 libraries (libx11, libxcb, etc.)"
    echo "  • GTK/ATK accessibility libraries"
    echo "  • Audio libraries (libasound2)"
    echo "  • Graphics libraries (libgbm1, libdrm2)"
    echo "  • Font rendering libraries"
    echo "  • SSL certificates"
    echo ""

    echo "What was NOT modified:"
    echo "  • Node.js installation (unchanged)"
    echo "  • npm packages (unchanged)"
    echo "  • Application code (unchanged)"
    echo "  • System services (unchanged)"
    echo "  • Environment variables (unchanged)"
    echo ""

    echo "Next steps:"
    echo "  1. Test Puppeteer with your existing setup:"
    echo "     ${YELLOW}node scripts/sa-health-status-checker.js 3000001140${NC}"
    echo ""
    echo "  2. If you see 'Failed to launch browser', check logs:"
    echo "     ${YELLOW}node scripts/sa-health-status-checker.js 3000001140 2>&1 | grep -i error${NC}"
    echo ""

    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Puppeteer dependencies installed successfully! 🎉           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
}

# Run main function
main
