#!/bin/bash

UPLOAD_DIR="/mnt/c/Users/dwils/Altera Digital Health/APAC Leadership Team - Confidential - Documents/Downloads/DLD/2/to upload"
API_URL="http://localhost:3001/api/upload-pdfs"

echo "============================================================"
echo "BULK INVOICE UPLOAD"
echo "============================================================"
echo ""
echo "Uploading PDFs from: $UPLOAD_DIR"
echo "To API: $API_URL"
echo ""

# Count total PDFs
total=$(ls -1 "$UPLOAD_DIR"/*.pdf 2>/dev/null | wc -l)
echo "Total PDFs found: $total"
echo ""
echo "Checking server status..."

# Wait for server to be fully ready
sleep 3
curl -s http://localhost:3001/api/invoices > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Server is ready"
else
    echo "✗ Server is not responding. Please start the server first."
    exit 1
fi

echo ""
echo "============================================================"
echo ""

# Upload in batches of 10
count=0
batch=1
batch_files=""

cd "$UPLOAD_DIR"

for pdf in *.pdf; do
    if [ -f "$pdf" ]; then
        batch_files="$batch_files -F pdfs=@\"$pdf\""
        count=$((count + 1))

        # Upload every 10 files or at the end
        if [ $((count % 10)) -eq 0 ] || [ $count -eq $total ]; then
            echo "[$count/$total] Uploading batch $batch..."

            eval curl -s -X POST "$API_URL" $batch_files > /tmp/upload_result.json

            # Check if successful
            if grep -q '"success":true' /tmp/upload_result.json; then
                success=$(grep -o '"invoices":\[' /tmp/upload_result.json | wc -l)
                duplicates=$(grep -o '"duplicates":\[' /tmp/upload_result.json)
                echo "  ✓ Batch $batch uploaded successfully"
            else
                error=$(cat /tmp/upload_result.json)
                echo "  ✗ Batch $batch failed: $error"
            fi

            batch_files=""
            batch=$((batch + 1))
            sleep 1
        fi
    fi
done

echo ""
echo "============================================================"
echo "Upload complete! Check the Invoice Tracker app for results."
echo "============================================================"
