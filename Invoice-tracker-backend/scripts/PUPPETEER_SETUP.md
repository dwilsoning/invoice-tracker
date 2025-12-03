# Puppeteer Setup for SA Health Status Checker

The SA Health status checker now uses Puppeteer to properly scrape JavaScript-loaded content from the SA Health MyInvoice website.

## Local Development (WSL)

If you're running on WSL (Windows Subsystem for Linux), Puppeteer requires Chrome dependencies that may not be installed by default.

### Option 1: Install Chrome Dependencies in WSL

```bash
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2
```

### Option 2: Skip Puppeteer on WSL (Manual Checks Only)

If you don't need automated checking on your local machine, you can:
1. Use the "Check SA Health Status" button which will show "Manual check required"
2. Manually visit https://www.sharedservices.sa.gov.au/iframe
3. Update the notes field manually

The automated daily checks will work on EC2 where dependencies are properly installed.

## EC2 Deployment

### Install Chrome Dependencies

SSH into your EC2 instance and run:

```bash
# For Amazon Linux 2 / Amazon Linux 2023
sudo yum install -y \
    nss \
    nspr \
    at-spi2-atk \
    cups-libs \
    libdrm \
    libXrandr \
    libXcomposite \
    libXdamage \
    libxkbcommon \
    mesa-libgbm \
    alsa-lib

# For Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2
```

### Test Puppeteer

After installing dependencies, test the scraper:

```bash
cd /path/to/Invoice-tracker-backend
node scripts/sa-health-status-checker.js 3000001140
```

You should see output like:
```
Checking status for invoice 3000001140...
Filling search form...
Submitting search...
Searching for invoice in results table...
Status detected: Awaiting approval
```

## How It Works

The updated status checker:

1. **Launches headless Chrome** using Puppeteer
2. **Navigates** to https://www.sharedservices.sa.gov.au/iframe
3. **Fills the search form** with ABN (75142863410) and invoice number
4. **Submits the form** and waits for results to load
5. **Waits for JavaScript** to render the results table
6. **Searches the table** for the invoice number
7. **Extracts the status** from the appropriate cell
8. **Normalizes the status** (e.g., "Awaiting approval", "Paid", etc.)
9. **Updates the invoice notes** with the status and timestamp
10. **Marks as "Paid"** only if SA Health shows it as paid

## Troubleshooting

### Error: Failed to launch browser

This means Chrome dependencies are missing. Follow the installation steps above for your platform.

### Error: Timeout waiting for selector

The SA Health website may have changed its HTML structure. Check:
- Is the website accessible?
- Have the form field IDs changed?
- Is there a CAPTCHA or authentication requirement?

### Status shows "Manual check required"

This means:
- The results table couldn't be found (may be loaded differently)
- The invoice number wasn't found in the table
- An error occurred during scraping

In this case, manually check the SA Health website and update the notes field.

## Performance Notes

- Each status check takes approximately **10-20 seconds** (browser launch + page load + scraping)
- For bulk checking (daily cron), there's a **2-second delay** between each invoice to avoid overwhelming the server
- Checking 50 invoices will take approximately **15-20 minutes**

## Security Considerations

- Puppeteer runs in **sandboxed mode** by default
- The scraper uses `--no-sandbox` flag for EC2 compatibility
- No authentication credentials are stored or transmitted
- Only public information is accessed (ABN + invoice number)

## Future Improvements

- Cache browser instance for faster repeated checks
- Implement retry logic for transient failures
- Add screenshot capture on errors for debugging
- Detect and handle CAPTCHA if implemented by SA Health
