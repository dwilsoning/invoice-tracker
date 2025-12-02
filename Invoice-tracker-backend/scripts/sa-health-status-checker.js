/**
 * South Australia Health Invoice Status Checker
 *
 * This script checks the status of SA Health invoices using their online tracking system
 * URL: https://www.sharedservices.sa.gov.au/iframe
 * ABN: 75142863410 (SA Health)
 */

const axios = require('axios');
const { db, pool } = require('../db-postgres');
require('dotenv').config();

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
 * Fetch invoice status from SA Health tracking system
 * Note: This is a simplified version. The actual implementation may require
 * more sophisticated scraping or API integration depending on the website's structure.
 */
async function fetchSAHealthInvoiceStatus(invoiceNumber) {
  try {
    // Construct the query URL
    const params = new URLSearchParams({
      invoice_number: invoiceNumber,
      payment_id: '',
      sort_by: 'invoice_number',
      sort_order: 'ASC',
      abn: SA_HEALTH_CONFIG.abn,
      op: 'Search'
    });

    const url = `${SA_HEALTH_CONFIG.baseUrl}?${params.toString()}`;

    console.log(`Checking status for invoice ${invoiceNumber}...`);

    // Attempt to fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    // Parse the response (this will need to be adjusted based on actual HTML structure)
    // For now, return a placeholder that indicates we need to parse the HTML
    const html = response.data;

    // This is a simplified parser - you may need to use cheerio or puppeteer for proper parsing
    let status = 'Unable to determine';
    let paymentInfo = '';

    // Look for common status indicators in the HTML
    if (html.includes('paid') || html.includes('Paid')) {
      status = 'Paid';
      // Try to extract payment date if available
      const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        paymentInfo = ` on ${dateMatch[1]}`;
      }
    } else if (html.includes('awaiting approval') || html.includes('Awaiting approval')) {
      status = 'Awaiting approval';
    } else if (html.includes('in progress') || html.includes('In progress')) {
      status = 'In progress';
    }

    return {
      invoiceNumber,
      status,
      paymentInfo,
      lastChecked: new Date().toISOString(),
      source: 'SA Health MyInvoice'
    };

  } catch (error) {
    console.error(`Error fetching status for invoice ${invoiceNumber}:`, error.message);
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

    // If status is "Paid", also update the invoice status
    if (statusInfo.status === 'Paid') {
      await db.run(
        'UPDATE invoices SET status = $1 WHERE id = $2 AND status != $1',
        'Paid',
        invoiceId
      );
      console.log(`✓ Invoice ${invoiceId} marked as Paid`);
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
