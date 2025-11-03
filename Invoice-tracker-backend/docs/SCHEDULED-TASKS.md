# Scheduled Tasks Documentation

This document describes all automated scheduled tasks in the Invoice Tracker system.

## Overview

The Invoice Tracker uses `node-cron` to schedule automated tasks that run at specific times in the **Australia/Sydney timezone** (AEST/AEDT). This ensures tasks run at predictable times regardless of server restarts or the server's local timezone.

## Why Timezone-Aware Scheduling Matters

Unlike `setInterval`, which runs tasks relative to server startup time, `node-cron` with timezone support ensures:

- ✅ Tasks run at **specific times** (e.g., 1 AM AEST) regardless of when the server started
- ✅ Automatic handling of **daylight saving time** transitions
- ✅ Predictable scheduling even after **server restarts**
- ✅ Tasks run at **low-usage times** for Australian users (middle of the night)

## Scheduled Tasks

### 1. Duplicate Invoice Check

**Schedule:** Every day at midnight (12:00 AM) AEST/AEDT
**Cron Expression:** `0 0 * * *`
**Function:** `checkForDuplicates()`
**Location:** server-postgres.js:1567-1616

**Purpose:**
- Scans all invoices in the database to detect duplicates
- Identifies invoices with the same invoice number, client, and invoice date
- Logs warnings about duplicate invoices for review
- Provides daily visibility into data quality issues

**Detection Logic:**
1. Queries all invoices from the database
2. Groups by combination of: invoice number + client + invoice date (case-insensitive)
3. Identifies groups with more than one invoice
4. Logs details of each duplicate group

**Output Example:**
```
🔍 Checking for duplicate invoices at 11/4/2025, 12:00:00 AM (AEST/AEDT)...
⚠️  Found 2 duplicate invoice groups:
   • Invoice 4600034040 for Client A (2025-01-15): 2 copies
   • Invoice 9000000514 for Client B (2025-02-20): 3 copies
```

**Timing Rationale:**
- **Midnight:** Start of new day, perfect for daily reporting
- Runs before expected invoice generation (1 AM)
- Ensures administrators see duplicate warnings first thing in the morning

**Note:** This is a reporting/monitoring task only. It does not automatically delete duplicates - manual review is required.

---

### 2. Exchange Rate Updates

**Schedule:** Every day at 2 AM, 8 AM, 2 PM, and 8 PM AEST/AEDT
**Cron Expression:** `0 2,8,14,20 * * *`
**Function:** `fetchExchangeRates()`
**Location:** server-postgres.js:52-80

**Purpose:**
- Fetches current exchange rates from `https://api.exchangerate-api.com/v4/latest/USD`
- Updates rates for: USD, AUD, EUR, GBP, SGD
- Ensures accurate currency conversions for invoices in different currencies

**Timing Rationale:**
- **2 AM:** Before Australian business hours start
- **8 AM:** Start of Australian business day
- **2 PM:** Mid-day update during Australian business hours
- **8 PM:** Evening update, captures end-of-day rates and overlap with international markets

**Fallback:**
- On server startup, rates are fetched immediately
- If API call fails, cached rates are used
- Default fallback rates are hardcoded in the application

**API Details:**
- Free API with no authentication required
- Rate limits: Adequate for 4 updates per day
- API source: exchangerate-api.com

---

### 3. Expected Invoice Generation

**Schedule:** Every day at 1 AM AEST/AEDT
**Cron Expression:** `0 1 * * *`
**Function:** `generateExpectedInvoices()`
**Location:** server-postgres.js:1321-1493

**Purpose:**
- Analyzes recurring invoices (monthly, quarterly, bi-annual, tri-annual, annual)
- Generates expected invoice records for upcoming due dates
- Helps track missing invoices from regular clients/contracts

**Process:**
1. Queries all non-adhoc invoices from the database
2. Groups by client, contract, and invoice type
3. Calculates next expected date based on frequency
4. Creates expected invoice if date is due and no recent invoice exists
5. Avoids duplicates by checking for existing expected invoices within ±1 day

**Timing Rationale:**
- **1 AM:** Middle of the night in Australia
- Minimal impact on system performance
- Ensures expected invoices are ready when users start work in the morning

**Also Runs:**
- On server startup to catch any missed expected invoices

---

### 4. Cleanup of Acknowledged Expected Invoices

**Schedule:** Every Sunday at 3 AM AEST/AEDT
**Cron Expression:** `0 3 * * 0`
**Function:** `cleanupAcknowledgedInvoices()`
**Location:** server-postgres.js:1539-1565

**Purpose:**
- Removes old acknowledged expected invoices from the database
- Keeps database clean and prevents unnecessary growth
- Only removes invoices that have been acknowledged for more than 7 days

**Process:**
1. Calculates cutoff date (7 days ago)
2. Deletes expected invoices where:
   - `acknowledged = true`
   - `acknowledged_date < cutoff_date`

**Timing Rationale:**
- **Sunday 3 AM:** Quietest time of the week
- After weekend, before Monday morning work starts
- Weekly frequency is sufficient for this maintenance task

---

## Monitoring Scheduled Tasks

### Logs to Watch For

All scheduled tasks produce logs when they run:

```
🔍 Checking for duplicate invoices at [time] (AEST/AEDT)...
✅ No duplicate invoices found
  (or)
⚠️  Found X duplicate invoice groups:
   • Invoice 1234 for Client A (2025-01-15): 2 copies

🔄 Running expected invoice generation at [time] (AEST/AEDT)...

🔄 Fetching exchange rates at [time] (AEST/AEDT)...
✅ Exchange rates updated: { USD: 1, AUD: 0.65, ... }

🧹 Running cleanup of old acknowledged invoices at [time] (AEST/AEDT)...
✅ Cleanup complete: Removed X old acknowledged invoices
```

### Startup Summary

When the server starts, it displays a summary of all scheduled tasks:

```
📅 Scheduled Tasks Summary (Australia/Sydney timezone):
  • Duplicate invoice check: Midnight daily
  • Expected invoice generation: 1 AM daily
  • Exchange rate updates: 2 AM, 8 AM, 2 PM, 8 PM daily
  • Cleanup old acknowledged invoices: 3 AM every Sunday
  • Server timezone: [system timezone]
  • Current time (AEST/AEDT): [current time]
```

### Verifying Tasks Are Running

To verify a task ran successfully, check the server logs:

```bash
# View recent logs (on AWS/Linux)
tail -f /var/log/syslog | grep "invoice-tracker"

# Or check PM2 logs if using PM2
pm2 logs invoice-tracker

# Or check application logs
tail -f server.log
```

---

## Technical Implementation

### Package Used
- **node-cron** v3.0.3 or later
- Lightweight, reliable cron scheduler for Node.js
- Supports timezone-aware scheduling

### Cron Expression Format

```
 ┌───────────── minute (0 - 59)
 │ ┌───────────── hour (0 - 23)
 │ │ ┌───────────── day of month (1 - 31)
 │ │ │ ┌───────────── month (1 - 12)
 │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
 │ │ │ │ │
 │ │ │ │ │
 * * * * *
```

### Examples
- `0 0 * * *` - Run at midnight every day
- `0 1 * * *` - Run at 1 AM every day
- `0 2,8,14,20 * * *` - Run at 2 AM, 8 AM, 2 PM, 8 PM every day
- `0 3 * * 0` - Run at 3 AM every Sunday

### Timezone Configuration

All tasks use `timezone: 'Australia/Sydney'` which:
- Automatically handles AEST (Australian Eastern Standard Time, UTC+10)
- Automatically handles AEDT (Australian Eastern Daylight Time, UTC+11)
- Transitions correctly during daylight saving changes (October/April)

---

## Deployment Considerations

### AWS Deployment

When deployed on AWS:

1. **EC2 Instance Timezone**: The system timezone doesn't matter because tasks use `timezone: 'Australia/Sydney'`
2. **Server Restarts**: Cron jobs are reinstantiated on server restart and will run at the next scheduled time
3. **PM2/Forever**: If using process managers, they will restart the server on crashes, and cron jobs will resume

### Testing New Schedule Times

To test a cron schedule without waiting:

```javascript
// Temporarily change to run every minute for testing
cron.schedule('* * * * *', fetchExchangeRates, {
  timezone: 'Australia/Sydney'
});
```

Then revert to production schedule after testing.

### Manual Triggering

All scheduled functions can be called manually if needed:

```javascript
// In Node.js REPL or temporary script
checkForDuplicates();           // Check for duplicates now
fetchExchangeRates();           // Update exchange rates now
generateExpectedInvoices();     // Generate expected invoices now
cleanupAcknowledgedInvoices();  // Run cleanup now
```

---

## Troubleshooting

### Exchange Rates Not Updating

**Symptoms:** Old exchange rates, conversions seem incorrect

**Checks:**
1. Verify server is running: `curl http://localhost:3001/api/health`
2. Check logs for exchange rate errors
3. Test API manually: `curl https://api.exchangerate-api.com/v4/latest/USD`
4. Check if API is down or rate-limited

**Manual Fix:**
```bash
# Restart server to force immediate fetch
pm2 restart invoice-tracker
```

### Expected Invoices Not Generating

**Symptoms:** Missing expected invoices for recurring contracts

**Checks:**
1. Verify there are recurring invoices in the database (frequency != 'adhoc')
2. Check logs at 1 AM AEST for generation messages
3. Verify server time is correct
4. Check database for existing expected invoices

**Manual Fix:**
```javascript
// Call manually via server console or temporary endpoint
generateExpectedInvoices();
```

### Tasks Running at Wrong Times

**Symptoms:** Tasks running at unexpected hours

**Checks:**
1. Verify server shows correct timezone info in startup logs
2. Check if server was recently restarted (might be running catch-up tasks)
3. Confirm `node-cron` package is installed
4. Check for conflicting timezone environment variables

**Fix:**
```bash
# Ensure TZ environment variable is not set or is correct
unset TZ  # or
export TZ="Australia/Sydney"

# Restart server
pm2 restart invoice-tracker
```

---

## Future Enhancements

Potential scheduled tasks to consider:

1. **Database Backups**: Daily backup at 4 AM
2. **Report Generation**: Weekly summary reports every Monday at 6 AM
3. **Overdue Invoice Notifications**: Daily check at 9 AM for overdue invoices
4. **Exchange Rate History**: Daily archival of exchange rate changes
5. **Performance Metrics**: Weekly system health report

---

## Related Documentation

- [Deployment Guide - AWS](../../DEPLOYMENT-GUIDE-AWS.md)
- [Deployment Guide - Azure](../../DEPLOYMENT-GUIDE-AZURE.md)
- [Database Schema](./DATABASE-SCHEMA.md)
- [API Documentation](./API-DOCUMENTATION.md)

---

*Last Updated: 2025-11-03*
*Author: Claude Code*
