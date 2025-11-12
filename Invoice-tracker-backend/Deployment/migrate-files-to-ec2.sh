#!/bin/bash

###############################################################################
# Invoice Tracker - File Migration Script
#
# Migrates PDF files and attachments from local machine to EC2 instance
#
# Usage:
#   bash migrate-files-to-ec2.sh
#
# Prerequisites:
#   - SSH access to EC2 instance configured
#   - rsync installed on both local and EC2 (usually pre-installed)
#   - EC2_HOST, EC2_USER, and EC2_KEY_PATH set below
#   - invoices_pdf folder exists locally
###############################################################################

# CONFIGURATION - Update these values
EC2_HOST="your-ec2-ip-or-hostname"        # e.g., "ec2-54-123-45-67.compute-1.amazonaws.com"
EC2_USER="ec2-user"                        # or "ubuntu" depending on AMI
EC2_KEY_PATH="~/.ssh/your-key.pem"        # Path to your EC2 SSH key
REMOTE_APP_PATH="/home/ec2-user/Invoice-tracker-backend"  # Path to app on EC2

# Local paths
LOCAL_INVOICES_PDF="./invoices_pdf"
LOCAL_UPLOADS="./uploads"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Invoice Tracker - File Migration to EC2                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Validate SSH connection
echo -e "${BLUE}⏳ Testing SSH connection to EC2...${NC}"
if ssh -i "$EC2_KEY_PATH" -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH connection successful${NC}\n"
else
    echo -e "${RED}✗ Failed to connect to EC2 instance${NC}"
    echo "Please check:"
    echo "  - EC2_HOST is correct"
    echo "  - EC2_USER is correct"
    echo "  - EC2_KEY_PATH points to your SSH key"
    echo "  - EC2 security group allows SSH (port 22)"
    exit 1
fi

# Create directories on EC2 if they don't exist
echo -e "${BLUE}⏳ Creating directories on EC2...${NC}"
ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "mkdir -p $REMOTE_APP_PATH/invoices_pdf $REMOTE_APP_PATH/uploads"
echo -e "${GREEN}✓ Directories created${NC}\n"

# Count files to migrate
if [ -d "$LOCAL_INVOICES_PDF" ]; then
    INVOICE_COUNT=$(find "$LOCAL_INVOICES_PDF" -type f | wc -l)
else
    INVOICE_COUNT=0
fi

if [ -d "$LOCAL_UPLOADS" ]; then
    UPLOAD_COUNT=$(find "$LOCAL_UPLOADS" -type f | wc -l)
else
    UPLOAD_COUNT=0
fi

echo "Files to migrate:"
echo "  - invoices_pdf folder: $INVOICE_COUNT files"
echo "  - uploads folder: $UPLOAD_COUNT files"
echo ""

# Migrate invoices_pdf folder
if [ -d "$LOCAL_INVOICES_PDF" ] && [ "$INVOICE_COUNT" -gt 0 ]; then
    echo -e "${BLUE}⏳ Migrating invoices_pdf folder ($INVOICE_COUNT files)...${NC}"
    rsync -avz --progress \
        -e "ssh -i $EC2_KEY_PATH" \
        "$LOCAL_INVOICES_PDF/" \
        "$EC2_USER@$EC2_HOST:$REMOTE_APP_PATH/invoices_pdf/"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ invoices_pdf folder migrated successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to migrate invoices_pdf folder${NC}\n"
    fi
else
    echo -e "${YELLOW}ℹ  No files in invoices_pdf folder to migrate${NC}\n"
fi

# Migrate uploads folder
if [ -d "$LOCAL_UPLOADS" ] && [ "$UPLOAD_COUNT" -gt 0 ]; then
    echo -e "${BLUE}⏳ Migrating uploads folder ($UPLOAD_COUNT files)...${NC}"
    rsync -avz --progress \
        -e "ssh -i $EC2_KEY_PATH" \
        "$LOCAL_UPLOADS/" \
        "$EC2_USER@$EC2_HOST:$REMOTE_APP_PATH/uploads/"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ uploads folder migrated successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to migrate uploads folder${NC}\n"
    fi
else
    echo -e "${YELLOW}ℹ  No files in uploads folder to migrate${NC}\n"
fi

# Set correct permissions on EC2
echo -e "${BLUE}⏳ Setting file permissions on EC2...${NC}"
ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "chmod -R 755 $REMOTE_APP_PATH/invoices_pdf $REMOTE_APP_PATH/uploads"
echo -e "${GREEN}✓ Permissions set${NC}\n"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    MIGRATION SUMMARY                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ File migration complete!${NC}"
echo ""
echo "Files migrated:"
echo "  - invoices_pdf: $INVOICE_COUNT files"
echo "  - uploads: $UPLOAD_COUNT files"
echo ""
echo "Next steps:"
echo "  1. Verify files exist on EC2:"
echo "     ssh -i $EC2_KEY_PATH $EC2_USER@$EC2_HOST 'ls -la $REMOTE_APP_PATH/invoices_pdf'"
echo ""
echo "  2. Update file paths in .env if needed"
echo ""
echo "  3. Test file access from the application"
echo ""
