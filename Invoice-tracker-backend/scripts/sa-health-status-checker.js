/**
 * South Australia Health Invoice Status Checker
 *
 * This script checks the status of SA Health invoices using their online tracking system
 * URL: https://www.sharedservices.sa.gov.au/iframe
 * ABN: 75142863410 (SA Health)
 */

const fs = require('fs');
const { db, pool } = require('../db-postgres');
require('dotenv').config();

// Detect environment and choose appropriate Puppeteer
const isWSL = fs.existsSync('/mnt/c/Windows');
const isWindows = process.platform === 'win32';

let puppeteer;
let browserConfig = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ]
};

if (isWindows) {
  // Windows environment - use puppeteer-core with Windows Chrome
  console.log('🪟 Windows detected - using Windows Chrome installation');
  puppeteer = require('puppeteer-core');

  // Try common Chrome installation paths on Windows
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let chromePath = null;
  for (const path of chromePaths) {
    if (fs.existsSync(path)) {
      chromePath = path;
      break;
    }
  }

  if (!chromePath) {
    console.error('❌ Chrome not found in standard locations!');
    console.error('Please install Chrome or set CHROME_PATH environment variable');
    throw new Error('Chrome executable not found');
  }

  browserConfig.executablePath = chromePath;
  console.log(`   Using Chrome at: ${chromePath}`);
} else if (isWSL) {
  // WSL environment - use bundled Puppeteer Chrome
  console.log('🐧 WSL detected - using Puppeteer bundled Chrome');
  puppeteer = require('puppeteer');
} else {
  // EC2 or other Linux environment - use regular puppeteer
  puppeteer = require('puppeteer');
  console.log('🐧 Linux environment detected - using Puppeteer bundled Chrome');
}

// SA Health configuration
const SA_HEALTH_CONFIG = {
  abn: '75142863410',
  baseUrl: 'https://iframe.sssa.sa.gov.au/myinvoice',
  clientNames: ['South Australia Health', 'SA Health', 'Department for Health and Wellbeing']
};

/**
 * Check if a client is SA Health
 */
function isSAHealthClient(clientName) {
  return SA_HEALTH_CONFIG.clientNames.some(name =>
    clientName && clientName.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * Fetch invoice status from SA Health tracking system using Puppeteer
 * This uses a headless browser to wait for JavaScript-loaded content
 */
async function fetchSAHealthInvoiceStatus(invoiceNumber) {
  let browser = null;

  try {
    console.log(`Checking status for invoice ${invoiceNumber}...`);

    // Launch headless browser with environment-specific config
    browser = await puppeteer.launch(browserConfig);

    const page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the SA Health MyInvoice page with search parameters
    const baseUrl = 'https://www.sharedservices.sa.gov.au/iframe';
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Fill in the search form
    console.log('Filling search form...');

    // Wait for ABN field and fill it
    await page.waitForSelector('#edit-abn', { timeout: 10000 });
    await page.type('#edit-abn', SA_HEALTH_CONFIG.abn);

    // Fill in invoice number
    await page.waitForSelector('#edit-invoice-number', { timeout: 10000 });
    await page.type('#edit-invoice-number', invoiceNumber);

    // Click search button
    console.log('Submitting search...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('#edit-submit')
    ]);

    // Wait a bit for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if there are any results
    const pageContent = await page.content();
    const bodyText = await page.evaluate(() => document.body.textContent.toLowerCase());

    if (bodyText.includes('no results') || bodyText.includes('0 results')) {
      console.log(`No results found for invoice ${invoiceNumber}`);
      await browser.close();
      return {
        invoiceNumber,
        status: 'Not found in SA Health system',
        paymentInfo: '',
        lastChecked: new Date().toISOString(),
        source: 'SA Health MyInvoice'
      };
    }

    // Look for the invoice in the results table
    console.log('Searching for invoice in results table...');

    // Try to find table rows with invoice data
    const invoiceData = await page.evaluate((invNum) => {
      // Find all table rows
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        const rowText = row.textContent;

        // Check if this row contains our invoice number
        if (rowText.includes(invNum)) {
          // Extract data from cells
          const cellTexts = cells.map(cell => cell.textContent.trim());

          // Try to find status (usually in a specific cell)
          let status = 'Unable to determine';
          const statusCell = cells.find(cell => {
            const text = cell.textContent.toLowerCase();
            return text.includes('awaiting') ||
                   text.includes('paid') ||
                   text.includes('approved') ||
                   text.includes('progress') ||
                   text.includes('rejected');
          });

          if (statusCell) {
            status = statusCell.textContent.trim();
          }

          return {
            found: true,
            status: status,
            allCells: cellTexts
          };
        }
      }

      return { found: false };
    }, invoiceNumber);

    await browser.close();

    if (!invoiceData.found) {
      console.log(`Invoice ${invoiceNumber} not found in results table`);
      return {
        invoiceNumber,
        status: 'Not found in results table',
        paymentInfo: '',
        lastChecked: new Date().toISOString(),
        source: 'SA Health MyInvoice'
      };
    }

    // Parse and normalize the status
    let normalizedStatus = 'Unable to determine';
    let paymentInfo = '';
    const statusLower = invoiceData.status.toLowerCase();

    if (statusLower.includes('awaiting approval')) {
      normalizedStatus = 'Awaiting approval';
    } else if (statusLower.includes('in progress')) {
      normalizedStatus = 'In progress';
    } else if (statusLower.includes('approved') && !statusLower.includes('awaiting')) {
      normalizedStatus = 'Approved';
    } else if (statusLower.includes('paid')) {
      normalizedStatus = 'Paid';
      // Try to extract payment date
      const dateMatch = invoiceData.status.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        paymentInfo = ` on ${dateMatch[1]}`;
      }
    } else if (statusLower.includes('rejected')) {
      normalizedStatus = 'Rejected';
    } else if (statusLower.includes('cancelled')) {
      normalizedStatus = 'Cancelled';
    } else {
      // Use the raw status if we can't normalize it
      normalizedStatus = invoiceData.status;
    }

    console.log(`Status detected: ${normalizedStatus}`);
    console.log(`All cells: ${invoiceData.allCells.join(' | ')}`);

    return {
      invoiceNumber,
      status: normalizedStatus,
      paymentInfo,
      lastChecked: new Date().toISOString(),
      source: 'SA Health MyInvoice'
    };

  } catch (error) {
    console.error(`Error fetching status for invoice ${invoiceNumber}:`, error.message);

    if (browser) {
      await browser.close();
    }

    return {
      invoiceNumber,
      status: 'Error checking status',
      error: error.message,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Update invoice notes with SA Health status
 */
async function updateInvoiceWithSAHealthStatus(invoiceId, statusInfo) {
  const statusText = `SA Health Status (checked ${new Date().toLocaleDateString()}): ${statusInfo.status}${statusInfo.paymentInfo || ''}`;

  try {
    // Get existing notes
    const invoice = await db.get(
      'SELECT notes FROM invoices WHERE id = $1',
      invoiceId
    );

    if (!invoice) {
      console.log(`Invoice ${invoiceId} not found`);
      return false;
    }

    let existingNotes = invoice.notes || '';

    // Remove any previous SA Health status lines
    existingNotes = existingNotes
      .split('\n')
      .filter(line => !line.includes('SA Health Status'))
      .join('\n')
      .trim();

    // Add new status
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n${statusText}`
      : statusText;

    // Update the database
    await db.run(
      'UPDATE invoices SET notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      updatedNotes,
      invoiceId
    );

    // Only update invoice status to "Paid" if SA Health shows it as paid
    // Do NOT change status for other states (awaiting approval, not found, etc.)
    if (statusInfo.status === 'Paid') {
      await db.run(
        'UPDATE invoices SET status = $1, payment_date = CURRENT_DATE WHERE id = $2 AND status != $1',
        'Paid',
        invoiceId
      );
      console.log(`✓ Invoice ${invoiceId} marked as Paid`);
    } else {
      console.log(`Note: Invoice status is "${statusInfo.status}" - not changing invoice status in tracker`);
    }

    console.log(`✓ Updated notes for invoice ${invoiceId}`);
    return true;

  } catch (error) {
    console.error(`Error updating invoice ${invoiceId}:`, error.message);
    return false;
  }
}

/**
 * Check all SA Health invoices
 */
async function checkAllSAHealthInvoices() {
  try {
    console.log('Fetching SA Health invoices...\n');

    // Get all SA Health invoices that are not marked as Paid
    const clientPattern = SA_HEALTH_CONFIG.clientNames.map(name => `%${name}%`).join('|');

    const invoices = await db.all(`
      SELECT id, invoice_number, client, status, notes
      FROM invoices
      WHERE (
        client ILIKE '%South Australia Health%'
        OR client ILIKE '%SA Health%'
        OR client ILIKE '%Department for Health and Wellbeing%'
      )
      AND status != 'Paid'
      ORDER BY invoice_number
    `);

    console.log(`Found ${invoices.length} SA Health invoices to check\n`);

    if (invoices.length === 0) {
      console.log('No unpaid SA Health invoices found');
      return;
    }

    let updatedCount = 0;
    let paidCount = 0;

    for (const invoice of invoices) {
      console.log(`\nChecking invoice ${invoice.invoice_number} (${invoice.client})...`);

      // Fetch status from SA Health system
      const statusInfo = await fetchSAHealthInvoiceStatus(invoice.invoice_number);

      // Update the invoice
      const updated = await updateInvoiceWithSAHealthStatus(invoice.id, statusInfo);

      if (updated) {
        updatedCount++;
        if (statusInfo.status === 'Paid') {
          paidCount++;
        }
      }

      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Summary:`);
    console.log(`  Total invoices checked: ${invoices.length}`);
    console.log(`  Successfully updated: ${updatedCount}`);
    console.log(`  Marked as paid: ${paidCount}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error in checkAllSAHealthInvoices:', error);
  }
}

/**
 * Check a single invoice by invoice number
 */
async function checkSingleInvoice(invoiceNumber) {
  try {
    console.log('checkSingleInvoice called with invoice number:', invoiceNumber);

    // Get the invoice from database
    const invoice = await db.get(
      'SELECT id, invoice_number, client FROM invoices WHERE invoice_number = $1',
      invoiceNumber
    );

    console.log('Database query result:', invoice);

    if (!invoice) {
      console.log(`Invoice ${invoiceNumber} not found in database`);
      return null;
    }

    if (!isSAHealthClient(invoice.client)) {
      console.log(`Warning: Invoice ${invoiceNumber} is not for SA Health (client: ${invoice.client})`);
      console.log('Checking anyway...');
    }

    // Fetch status
    const statusInfo = await fetchSAHealthInvoiceStatus(invoiceNumber);

    // Update the invoice
    await updateInvoiceWithSAHealthStatus(invoice.id, statusInfo);

    return statusInfo;

  } catch (error) {
    console.error('Error in checkSingleInvoice:', error);
    return null;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments - check all SA Health invoices
    console.log('SA Health Invoice Status Checker');
    console.log('================================\n');
    checkAllSAHealthInvoices()
      .then(() => {
        console.log('\nDone!');
        process.exit(0);
      })
      .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
      });
  } else {
    // Check specific invoice number
    const invoiceNumber = args[0];
    console.log(`Checking single invoice: ${invoiceNumber}\n`);
    checkSingleInvoice(invoiceNumber)
      .then((statusInfo) => {
        if (statusInfo) {
          console.log('\nStatus:', statusInfo.status);
          if (statusInfo.paymentInfo) {
            console.log('Payment Info:', statusInfo.paymentInfo);
          }
        }
        process.exit(0);
      })
      .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
      });
  }
}

module.exports = {
  checkAllSAHealthInvoices,
  checkSingleInvoice,
  fetchSAHealthInvoiceStatus,
  updateInvoiceWithSAHealthStatus,
  isSAHealthClient
};
