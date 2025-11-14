#!/bin/bash

###############################################################################
# Invoice Tracker - File Copy Script (Run ON EC2)
#
# Use this script if you're uploading files manually or already have them on EC2
# This script should be run DIRECTLY ON THE EC2 INSTANCE
#
# Usage:
#   1. Upload files to EC2 using scp, sftp, or FileZilla
#   2. SSH into EC2: ssh -i your-key.pem ec2-user@your-ec2-ip
#   3. Run this script: bash migrate-files-on-ec2.sh /path/to/uploaded/files
###############################################################################

SOURCE_DIR="${1:-/tmp/invoice-files}"
DEST_DIR="/home/ec2-user/Invoice-tracker-backend"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Invoice Tracker - File Setup on EC2                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}✗ Source directory not found: $SOURCE_DIR${NC}"
    echo ""
    echo "Usage: bash migrate-files-on-ec2.sh /path/to/uploaded/files"
    echo ""
    exit 1
fi

# Create destination directories
echo -e "${BLUE}⏳ Creating directories...${NC}"
mkdir -p "$DEST_DIR/invoices_pdf"
mkdir -p "$DEST_DIR/uploads"
echo -e "${GREEN}✓ Directories created${NC}\n"

# Copy invoices_pdf folder
if [ -d "$SOURCE_DIR/invoices_pdf" ]; then
    FILE_COUNT=$(find "$SOURCE_DIR/invoices_pdf" -type f | wc -l)
    echo -e "${BLUE}⏳ Copying invoices_pdf folder ($FILE_COUNT files)...${NC}"
    cp -r "$SOURCE_DIR/invoices_pdf"/* "$DEST_DIR/invoices_pdf/" 2>/dev/null
    echo -e "${GREEN}✓ Copied $FILE_COUNT invoice PDFs${NC}\n"
else
    echo -e "${YELLOW}ℹ  No invoices_pdf folder found in source${NC}\n"
fi

# Copy uploads folder
if [ -d "$SOURCE_DIR/uploads" ]; then
    FILE_COUNT=$(find "$SOURCE_DIR/uploads" -type f | wc -l)
    echo -e "${BLUE}⏳ Copying uploads folder ($FILE_COUNT files)...${NC}"
    cp -r "$SOURCE_DIR/uploads"/* "$DEST_DIR/uploads/" 2>/dev/null
    echo -e "${GREEN}✓ Copied $FILE_COUNT uploaded files${NC}\n"
else
    echo -e "${YELLOW}ℹ  No uploads folder found in source${NC}\n"
fi

# Set permissions
echo -e "${BLUE}⏳ Setting permissions...${NC}"
chmod -R 755 "$DEST_DIR/invoices_pdf"
chmod -R 755 "$DEST_DIR/uploads"
echo -e "${GREEN}✓ Permissions set${NC}\n"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                         COMPLETE                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ Files copied successfully!${NC}"
echo ""
echo "Directories created:"
echo "  - $DEST_DIR/invoices_pdf"
echo "  - $DEST_DIR/uploads"
echo ""
echo "Verify files:"
echo "  ls -la $DEST_DIR/invoices_pdf"
echo "  ls -la $DEST_DIR/uploads"
echo ""
