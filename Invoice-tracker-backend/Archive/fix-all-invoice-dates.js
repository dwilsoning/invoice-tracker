#!/usr/bin/env node

/**
 * Fix all invoice dates that may have been affected by timezone conversion bug
 * This script re-parses all PDFs and updates the invoice_date and due_date fields
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { db } = require('./db-postgres');

// Month name mapping
const monthMap = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12
};

function parseDate(dateStr, currency, invoice_number) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try to match DD-MMM-YYYY or DD-MMMM-YYYY format (e.g., 12-MAR-2025, 11-APR-2025)
  const namedMonthMatch = cleaned.match(/(\d{1,2})[-\/\s]([a-z]+)[-\/\s](\d{2,4})/i);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1]);
    const monthStr = namedMonthMatch[2].toLowerCase();
    let year = parseInt(namedMonthMatch[3]);

    const month = monthMap[monthStr];

    if (month) {
      if (year < 100) year += 2000;

      // Create date using UTC to avoid timezone issues
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Handle numeric formats (MM-DD-YYYY or DD-MM-YYYY)
  const parts = cleaned.split(/[-\/]/);

  if (parts.length !== 3) return null;

  let day, month, year;

  // Try to determine format intelligently
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  const third = parseInt(parts[2]);

  if (isNaN(first) || isNaN(second) || isNaN(third)) return null;

  year = third;
  if (year < 100) year += 2000;

  // If first number > 12, it must be DD-MM-YYYY
  if (first > 12) {
    day = first;
    month = second;
  }
  // If second number > 12, it must be MM-DD-YYYY
  else if (second > 12) {
    month = first;
    day = second;
  }
  // Otherwise, use invoice number pattern to determine format
  else {
    const invoiceStr = invoice_number?.toString() || '';

    // US format invoice series (MM-DD-YYYY)
    const usFormatPrefixes = ['46', '47', '48', '49'];
    // International format invoice series (DD-MM-YYYY)
    const intlFormatPrefixes = ['40', '41', '42', '43', '44', '45', '60', '61', '11', '12', '86'];

    const isUSFormat = usFormatPrefixes.some(prefix => invoiceStr.startsWith(prefix));

    if (isUSFormat) {
      // US format: MM-DD-YYYY
      month = first;
      day = second;
    } else {
      // International format: DD-MM-YYYY
      day = first;
      month = second;
    }
  }

  // Validate date components
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Create date using UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day));

  // Check if date is valid
  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
}

async function extractDatesFromPDF(pdfPath, invoiceNumber) {
  try {
    if (!fs.existsSync(pdfPath)) {
      return { error: 'PDF not found' };
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // Extract dates using same logic as server
    const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                         text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                         text.match(/DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
                         text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                         text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);

    const dueDateMatch = text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                         text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                         text.match(/DUE\s+DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
                         text.match(/Payment\s+Due[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);

    const invoiceDateStr = invDateMatch ? invDateMatch[1].trim() : null;
    const dueDateStr = dueDateMatch ? dueDateMatch[1].trim() : null;

    const invoiceDate = invoiceDateStr ? parseDate(invoiceDateStr, 'USD', invoiceNumber) : null;
    const dueDate = dueDateStr ? parseDate(dueDateStr, 'USD', invoiceNumber) : null;

    return {
      invoiceDate,
      dueDate,
      rawInvoiceDate: invoiceDateStr,
      rawDueDate: dueDateStr
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function fixAllInvoiceDates() {
  let fixed = 0;
  let unchanged = 0;
  let errors = 0;
  let noPDF = 0;

  try {
    console.log('Fetching all invoices...');
    const invoices = await db.all('SELECT id, invoice_number, invoice_date, due_date, pdf_path FROM invoices ORDER BY invoice_number');

    console.log(`Found ${invoices.length} invoices\n`);

    for (const invoice of invoices) {
      const invoiceNumber = invoice.invoiceNumber || invoice.invoice_number;
      const currentInvoiceDate = invoice.invoiceDate || invoice.invoice_date;
      const currentDueDate = invoice.dueDate || invoice.due_date;
      const pdfPath = invoice.pdfPath || invoice.pdf_path;

      if (!pdfPath) {
        console.log(`⚠ ${invoiceNumber}: No PDF path`);
        noPDF++;
        continue;
      }

      const fullPath = path.join(__dirname, pdfPath.replace(/^\/pdfs\//, 'invoice_pdfs/'));
      const dates = await extractDatesFromPDF(fullPath, invoiceNumber);

      if (dates.error) {
        console.log(`✗ ${invoiceNumber}: ${dates.error}`);
        errors++;
        continue;
      }

      if (!dates.invoiceDate || !dates.dueDate) {
        console.log(`⚠ ${invoiceNumber}: Could not extract dates from PDF (raw: ${dates.rawInvoiceDate} / ${dates.rawDueDate})`);
        errors++;
        continue;
      }

      // Check if dates need updating
      const needsUpdate = dates.invoiceDate !== currentInvoiceDate || dates.dueDate !== currentDueDate;

      if (needsUpdate) {
        console.log(`📝 ${invoiceNumber}: Updating dates`);
        console.log(`   Invoice Date: ${currentInvoiceDate} → ${dates.invoiceDate}`);
        console.log(`   Due Date:     ${currentDueDate} → ${dates.dueDate}`);

        await db.run(
          'UPDATE invoices SET invoice_date = $1, due_date = $2 WHERE id = $3',
          dates.invoiceDate,
          dates.dueDate,
          invoice.id
        );

        fixed++;
      } else {
        unchanged++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  ✓ Fixed: ${fixed}`);
    console.log(`  - Unchanged: ${unchanged}`);
    console.log(`  ✗ Errors: ${errors}`);
    console.log(`  ⚠ No PDF: ${noPDF}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await db.close();
  }
}

// Run the fix
fixAllInvoiceDates();
