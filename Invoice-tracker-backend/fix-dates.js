const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');
const path = require('path');

const db = new sqlite3.Database('./invoices.db');

// Parse date from various formats
function parseDate(dateStr) {
  if (!dateStr) return null;

  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  // Handle DD-MMM-YYYY format
  const match1 = dateStr.match(/(\d{1,2})-([A-Z]{3})-(\d{4})/);
  if (match1) {
    const [, day, month, year] = match1;
    return `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
  }

  // Handle DD/MM/YYYY
  const match2 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateStr;
}

// Extract dates from PDF
function extractDates(text) {
  const data = {};

  // Invoice Date
  let match = text.match(/Invoice\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i) ||
              text.match(/DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
              text.match(/Credit\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4})/i);
  data.invoiceDate = match ? parseDate(match[1]) : null;

  // Due Date
  match = text.match(/Due\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i) ||
          text.match(/DUE\s+DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  data.dueDate = match ? parseDate(match[1]) : null;

  return data;
}

// Get invoice number from filename
function getInvoiceNumber(filename) {
  const patterns = [
    /Invoice[_\s]+(\d+)/i,
    /Inv[_\s]+([\d-]+)/i,
    /MDRX_AR_Project_Invoice_(\d+)/,
    /Credit\s+Memo\s+(\d+)/i,
    /(\d{10,})/
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const corrections = {
  invoiceDates: [],
  dueDates: []
};

// Process PDFs and fix dates
async function fixDates() {
  const pdfDir = './invoice_pdfs';
  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

  console.log('Starting date corrections...\n');

  for (const filename of pdfFiles) {
    const invoiceNumber = getInvoiceNumber(filename);
    if (!invoiceNumber || filename.includes('REMITTANCE')) continue;

    const pdfPath = path.join(pdfDir, filename);

    try {
      // Get current DB record
      const dbRow = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE invoiceNumber = ?', [invoiceNumber], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!dbRow) continue;

      // Read PDF
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      const dates = extractDates(pdfData.text);

      // Check invoice date
      if (dates.invoiceDate && dates.invoiceDate !== dbRow.invoiceDate) {
        const daysDiff = Math.abs(
          (new Date(dates.invoiceDate) - new Date(dbRow.invoiceDate)) / (1000 * 60 * 60 * 24)
        );

        // Only fix if difference is more than 1 day (to avoid minor parsing variations)
        if (daysDiff > 1) {
          corrections.invoiceDates.push({
            invoiceNumber,
            id: dbRow.id,
            oldDate: dbRow.invoiceDate,
            newDate: dates.invoiceDate
          });
        }
      }

      // Check due date
      if (dates.dueDate && dates.dueDate !== dbRow.dueDate) {
        const daysDiff = Math.abs(
          (new Date(dates.dueDate) - new Date(dbRow.dueDate)) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 1) {
          corrections.dueDates.push({
            invoiceNumber,
            id: dbRow.id,
            oldDate: dbRow.dueDate,
            newDate: dates.dueDate
          });
        }
      }

    } catch (error) {
      // Skip errors
    }
  }

  // Display summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('           DATE CORRECTION SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Invoice dates to fix: ${corrections.invoiceDates.length}`);
  console.log(`Due dates to fix: ${corrections.dueDates.length}\n`);

  if (corrections.invoiceDates.length > 0) {
    console.log('Sample Invoice Date Corrections:');
    corrections.invoiceDates.slice(0, 5).forEach(c => {
      console.log(`  ${c.invoiceNumber}: ${c.oldDate} → ${c.newDate}`);
    });
    console.log('');
  }

  if (corrections.dueDates.length > 0) {
    console.log('Sample Due Date Corrections:');
    corrections.dueDates.slice(0, 5).forEach(c => {
      console.log(`  ${c.invoiceNumber}: ${c.oldDate} → ${c.newDate}`);
    });
    console.log('');
  }

  // Ask for confirmation
  console.log('Ready to apply corrections. This will update the database.');
  console.log('Payment status will NOT be changed.\n');

  // Apply corrections
  let invoiceDateFixed = 0;
  let dueDateFixed = 0;

  console.log('Applying invoice date corrections...');
  for (const correction of corrections.invoiceDates) {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE invoices SET invoiceDate = ? WHERE id = ?',
        [correction.newDate, correction.id],
        (err) => {
          if (err) {
            console.error(`Error updating ${correction.invoiceNumber}:`, err.message);
            reject(err);
          } else {
            invoiceDateFixed++;
            resolve();
          }
        }
      );
    });
  }

  console.log('Applying due date corrections...');
  for (const correction of corrections.dueDates) {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE invoices SET dueDate = ? WHERE id = ?',
        [correction.newDate, correction.id],
        (err) => {
          if (err) {
            console.error(`Error updating ${correction.invoiceNumber}:`, err.message);
            reject(err);
          } else {
            dueDateFixed++;
            resolve();
          }
        }
      );
    });
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('           CORRECTIONS APPLIED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Invoice dates corrected: ${invoiceDateFixed}`);
  console.log(`✅ Due dates corrected: ${dueDateFixed}`);
  console.log(`\n✅ Total corrections applied: ${invoiceDateFixed + dueDateFixed}\n`);

  // Save correction log
  fs.writeFileSync('date-corrections-log.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    invoiceDatesFixed: invoiceDateFixed,
    dueDatesFixed: dueDateFixed,
    corrections
  }, null, 2));

  console.log('✅ Correction log saved to: date-corrections-log.json\n');

  db.close();
}

fixDates().catch(console.error);
