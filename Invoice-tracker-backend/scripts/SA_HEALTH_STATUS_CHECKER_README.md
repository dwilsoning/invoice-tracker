# SA Health Invoice Status Checker

This feature automatically checks the payment status of South Australia Health invoices using their online tracking system and updates the invoice tracker accordingly.

## Overview

The SA Health invoice status checker:
- Queries the SA Health MyInvoice system (https://iframe.sssa.sa.gov.au/myinvoice)
- Updates invoice notes with current status information
- Automatically marks invoices as "Paid" when detected
- Runs automatically daily at 9 AM AEST/AEDT
- Can be triggered manually from the UI

## Features

### 1. Automatic Daily Checks
- Scheduled to run every day at 9 AM AEST/AEDT
- Only checks unpaid SA Health invoices
- Updates invoice notes with status and timestamp
- Automatically updates invoice status to "Paid" when applicable

### 2. Manual Status Check
- Available in the Edit Invoice modal for SA Health invoices
- Button appears automatically for clients containing:
  - "South Australia Health"
  - "SA Health"
  - "Department for Health and Wellbeing"
- Click "Check SA Health Status" to immediately check current status

### 3. No Database Changes Required
- Uses existing `notes` field to store status information
- No schema modifications needed
- Works on both local and EC2 deployments

## Installation

### Prerequisites
- Node.js installed
- PostgreSQL database running
- Existing invoice tracker backend

### Setup Steps

1. **No additional npm packages required** - the script uses existing dependencies (axios, pg)

2. **Files are already in place:**
   - `/scripts/sa-health-status-checker.js` - Main status checking script
   - Backend API endpoints added to `server-postgres.js`
   - Frontend button added to `App.jsx`

3. **Environment variables** (should already be configured):
   - `DB_HOST` - Database host
   - `DB_PORT` - Database port (default: 5432)
   - `DB_NAME` - Database name
   - `DB_USER` - Database user
   - `DB_PASSWORD` - Database password

## Usage

### Manual Command Line Usage

Check all unpaid SA Health invoices:
```bash
node scripts/sa-health-status-checker.js
```

Check a specific invoice by invoice number:
```bash
node scripts/sa-health-status-checker.js 4000005221
```

### Manual UI Usage

1. Open an invoice from SA Health in the invoice tracker
2. Click the "Edit" button
3. Look for the "Check SA Health Status" button above the Notes field
4. Click the button to check the current status
5. The status will be added to the Notes field automatically
6. Click "Save Changes" to persist the updated notes

### API Endpoints

Two new endpoints are available:

#### Check Single Invoice Status
```
POST /api/invoices/:id/check-sa-health-status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "statusInfo": {
    "invoiceNumber": "4000005221",
    "status": "Paid",
    "paymentInfo": " on 2024-10-15",
    "lastChecked": "2025-12-02T10:30:00.000Z",
    "source": "SA Health MyInvoice"
  },
  "invoice": { ... updated invoice object ... }
}
```

#### Check All SA Health Invoices (Admin Only)
```
POST /api/invoices/check-all-sa-health-status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "SA Health status check started. This may take a few minutes."
}
```

## How It Works

### Status Detection

The script fetches the SA Health MyInvoice page for each invoice and looks for status indicators:

- **Paid** - Invoice has been paid
- **Awaiting approval** - Invoice is pending approval
- **In progress** - Invoice is being processed
- **Unable to determine** - Status could not be detected

### Notes Format

Status information is appended to the invoice notes in this format:

```
SA Health Status (checked 12/2/2025): Paid on 2024-10-15
```

Previous SA Health status lines are automatically replaced with the most recent check.

### Automatic Status Updates

When an invoice status is detected as "Paid":
- The invoice `status` field is updated to "Paid"
- The notes are updated with the status information
- The invoice appears as paid in the tracker

## Important Notes

### Web Scraping Limitations

The SA Health MyInvoice system is a web-based form that may have:
- Rate limiting
- Anti-scraping measures
- HTML structure that changes over time
- CAPTCHA or authentication requirements

**Current Implementation:**
- The script includes a 2-second delay between requests to avoid overwhelming the server
- Basic HTML parsing to detect status keywords
- Error handling for network failures

**If the scraping stops working:**
1. The SA Health website may have changed their HTML structure
2. You may need to update the parsing logic in `sa-health-status-checker.js`
3. Consider using a headless browser (Puppeteer) for more reliable scraping
4. Contact SA Health to inquire about an official API

### Manual Fallback

If automated checking fails, you can:
1. Manually visit the SA Health website: https://www.sharedservices.sa.gov.au/iframe
2. Enter ABN: 75142863410
3. Enter the invoice number
4. Update the invoice notes manually in the tracker

## Troubleshooting

### Script Not Running Automatically

Check the cron job is scheduled:
```bash
grep "SA Health" server-postgres.js
```

You should see the cron schedule at 9 AM daily.

### Manual Script Errors

**Database Connection Error:**
```
Error: ECONNREFUSED
```
Solution: Check your database is running and environment variables are correct

**Invoice Not Found:**
```
Invoice 4000005221 not found in database
```
Solution: Verify the invoice number exists in your database

**Network Timeout:**
```
Error fetching status for invoice: timeout of 10000ms exceeded
```
Solution: SA Health website may be slow or down. Try again later.

### UI Button Not Showing

The button only appears for invoices where the client name includes:
- "South Australia Health"
- "SA Health"
- "Department for Health and Wellbeing"

Make sure the client name is set correctly in the invoice.

## For EC2 Deployment

The feature is designed to work automatically on EC2:

1. **No additional setup required** - the code is already integrated
2. **Cron runs automatically** when the server starts
3. **Timezone is Australia/Sydney** for proper scheduling
4. **Manual checks work** via the UI as long as the EC2 instance can access the SA Health website

### Verify Installation on EC2

SSH into your EC2 instance and check:

```bash
# Check if the script file exists
ls -la /path/to/Invoice-tracker-backend/scripts/sa-health-status-checker.js

# Check server logs for scheduled task
journalctl -u invoice-tracker -f | grep "SA Health"

# Or if using PM2
pm2 logs invoice-tracker | grep "SA Health"
```

You should see the scheduled task listed when the server starts:
```
📅 Scheduled Tasks Summary (Australia/Sydney timezone):
  ...
  • SA Health invoice status check: 9 AM daily
```

## Customization

### Change Schedule Time

Edit `server-postgres.js` line ~1921:

```javascript
// Change '0 9 * * *' to your preferred time
// Format: minute hour day month weekday
// Example: '0 14 * * *' for 2 PM daily
cron.schedule('0 9 * * *', async () => {
  // ... status check code
```

### Add More Client Names

Edit `scripts/sa-health-status-checker.js` line ~24:

```javascript
const SA_HEALTH_CONFIG = {
  abn: '75142863410',
  baseUrl: 'https://iframe.sssa.sa.gov.au/myinvoice',
  clientNames: [
    'South Australia Health',
    'SA Health',
    'Department for Health and Wellbeing',
    'Your New Client Name Here'  // Add more names
  ]
};
```

### Adjust Request Delay

Edit `scripts/sa-health-status-checker.js` line ~167:

```javascript
// Change 2000 (2 seconds) to your preferred delay in milliseconds
await new Promise(resolve => setTimeout(resolve, 2000));
```

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify the SA Health website is accessible
3. Test the manual script command first
4. Review this documentation for troubleshooting steps

## Future Enhancements

Potential improvements:
- [ ] Use Puppeteer for more reliable web scraping
- [ ] Add email notifications when invoices are marked as paid
- [ ] Store status history in a separate table
- [ ] Integrate with SA Health API if one becomes available
- [ ] Add dashboard widget showing recent status checks
