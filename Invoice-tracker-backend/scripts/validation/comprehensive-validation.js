const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');

const db = new sqlite3.Database('./invoices.db');

const discrepancies = [];
let totalChecked = 0;
let totalMatched = 0;

// Parse date from various formats
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle DD-MMM-YYYY format (e.g., 12-JUL-2024)
  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  const match1 = dateStr.match(/(\d{1,2})-([A-Z]{3})-(\d{4})/);
  if (match1) {
    const [, day, month, year] = match1;
    return `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY
  const match2 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match2) {
    let [, p1, p2, year] = match2;
    if (year.length === 2) year = '20' + year;
    // Assume DD/MM/YYYY for now
    return `${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
  }

  return dateStr;
}

// Compare dates with tolerance
function datesMatch(date1, date2, tolerance = 0) {
  if (!date1 || !date2) return true; // Skip if either is missing

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  if (isNaN(d1) || isNaN(d2)) return true; // Skip if parsing failed

  const diffDays = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  return diffDays <= tolerance;
}

// Compare amounts with tolerance
function amountsMatch(amount1, amount2, tolerance = 0.02) {
  if (!amount1 || !amount2) return true;
  const diff = Math.abs(amount1 - amount2);
  return diff <= tolerance;
}

// Normalize text
function normalize(text) {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Check if client names match (fuzzy)
function clientsMatch(client1, client2) {
  if (!client1 || !client2) return true;

  const c1 = normalize(client1);
  const c2 = normalize(client2);

  // Exact match
  if (c1 === c2) return true;

  // Check if one contains significant words from the other
  const words1 = c1.split(' ').filter(w => w.length > 3);
  const words2 = c2.split(' ').filter(w => w.length > 3);

  let matchedWords = 0;
  for (const word of words1) {
    if (c2.includes(word)) matchedWords++;
  }

  // Consider match if more than 50% of significant words match
  return matchedWords >= Math.min(words1.length, words2.length) * 0.5;
}

// Extract invoice data from PDF text
function extractInvoiceData(text) {
  const data = {};

  // Invoice Number - multiple patterns
  let match = text.match(/Invoice\s+Number\s*:?\s*([A-Z0-9\/-]+)/i) ||
              text.match(/INVOICE\s+NO\.\s*([A-Z0-9\/-]+)/i) ||
              text.match(/Credit\s+Memo#?\s*:?\s*(\d+)/i);
  data.invoiceNumber = match ? match[1].trim() : null;

  // Invoice Date
  match = text.match(/Invoice\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i) ||
          text.match(/DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
          text.match(/Credit\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4})/i);
  data.invoiceDate = match ? parseDate(match[1]) : null;

  // Due Date
  match = text.match(/Due\s+Date\s*:?\s*(\d{1,2}[-\/][A-Z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i) ||
          text.match(/DUE\s+DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  data.dueDate = match ? parseDate(match[1]) : null;

  // Amount Due - look for various patterns
  match = text.match(/Amount\s+Due\s*:?\s*\$?([\d,]+\.?\d*)/i) ||
          text.match(/Balance\s+Due\s*:?\s*(?:AUD|USD|EUR|GBP|SGD)?\s*\$?\s*([\d,]+\.?\d*)/i) ||
          text.match(/Invoice\s+Total\s*:?\s*\$?(-?[\d,]+\.?\d*)/i) ||
          text.match(/TOTAL\s+(-?[\d,]+\.?\d*)/i);
  data.amountDue = match ? Math.abs(parseFloat(match[1].replace(/,/g, ''))) : null;

  // Currency
  match = text.match(/Currency\s*\n\s*([A-Z]{3})/i) ||
          text.match(/BALANCE\s+DUE\s+([A-Z]{3})/i);
  data.currency = match ? match[1] : null;

  // Client
  match = text.match(/ATTN:\s*([^\n]+)\n([^\n]+(?:\n[^\n]+)*?)(?=\nRizal Dr|PO BOX|\d{4}\s*(?:PH|AU))/i);
  if (match) {
    data.client = match[2].trim().split('\n')[0];
  } else {
    match = text.match(/BILL\s+TO:\s*\n\s*(?:ATTN:[^\n]+\n)?\s*([^\n]+)/i);
    data.client = match ? match[1].trim() : null;
  }

  // Contract Number
  match = text.match(/Customer\s+Contract\s*#?\s*:?\s*([A-Z0-9-]+)/i) ||
          text.match(/Contract\s+(\d+)/i);
  data.contract = match ? match[1].trim() : null;

  // PO Number
  match = text.match(/PO\s+Number\s*:?\s*([A-Z0-9\s-]+?)(?:\n|Customer)/i) ||
          text.match(/P\.O\.\s+NUMBER\s*\n\s*(\d+)/i);
  data.poNumber = match ? match[1].trim() : null;

  return data;
}

// Get invoice number from filename
function getInvoiceNumberFromFilename(filename) {
  const patterns = [
    /Invoice[_\s]+(\d+)/i,
    /Inv[_\s]+([\d-]+)/i,
    /MDRX_AR_Project_Invoice_(\d+)/,
    /Credit\s+Memo\s+(\d+)/i,
    /(\d{10,})/  // 10+ digit number
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Validate a single invoice
async function validateInvoice(pdfPath) {
  const filename = path.basename(pdfPath);
  const invoiceNumber = getInvoiceNumberFromFilename(filename);

  if (!invoiceNumber) {
    console.log(`⚠️  Skipping ${filename} - cannot extract invoice number`);
    return;
  }

  // Skip remittance files
  if (filename.includes('REMITTANCE')) {
    console.log(`ℹ️  Skipping ${filename} - remittance file`);
    return;
  }

  return new Promise((resolve) => {
    db.get('SELECT * FROM invoices WHERE invoiceNumber = ?', [invoiceNumber], async (err, dbRow) => {
      totalChecked++;

      if (err) {
        console.error(`❌ Database error for ${invoiceNumber}:`, err.message);
        resolve();
        return;
      }

      if (!dbRow) {
        console.log(`⚠️  ${invoiceNumber} - NOT FOUND in database`);
        discrepancies.push({
          invoiceNumber,
          filename,
          issue: 'MISSING_IN_DATABASE',
          details: 'Invoice exists as PDF but not found in database'
        });
        resolve();
        return;
      }

      // Read and parse PDF
      try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdf(dataBuffer);
        const pdfInfo = extractInvoiceData(pdfData.text);

        const issues = [];

        // Compare invoice number
        if (pdfInfo.invoiceNumber &&
            normalize(pdfInfo.invoiceNumber) !== normalize(dbRow.invoiceNumber)) {
          issues.push({
            field: 'invoiceNumber',
            pdf: pdfInfo.invoiceNumber,
            db: dbRow.invoiceNumber
          });
        }

        // Compare invoice date
        if (pdfInfo.invoiceDate && !datesMatch(pdfInfo.invoiceDate, dbRow.invoiceDate, 1)) {
          issues.push({
            field: 'invoiceDate',
            pdf: pdfInfo.invoiceDate,
            db: dbRow.invoiceDate
          });
        }

        // Compare due date
        if (pdfInfo.dueDate && !datesMatch(pdfInfo.dueDate, dbRow.dueDate, 1)) {
          issues.push({
            field: 'dueDate',
            pdf: pdfInfo.dueDate,
            db: dbRow.dueDate
          });
        }

        // Compare amount
        if (pdfInfo.amountDue && !amountsMatch(pdfInfo.amountDue, Math.abs(dbRow.amountDue), 0.02)) {
          issues.push({
            field: 'amountDue',
            pdf: pdfInfo.amountDue,
            db: Math.abs(dbRow.amountDue),
            difference: Math.abs(pdfInfo.amountDue - Math.abs(dbRow.amountDue)).toFixed(2)
          });
        }

        // Compare client
        if (pdfInfo.client && !clientsMatch(pdfInfo.client, dbRow.client)) {
          issues.push({
            field: 'client',
            pdf: pdfInfo.client,
            db: dbRow.client
          });
        }

        // Compare currency
        if (pdfInfo.currency &&
            normalize(pdfInfo.currency) !== normalize(dbRow.currency)) {
          issues.push({
            field: 'currency',
            pdf: pdfInfo.currency,
            db: dbRow.currency
          });
        }

        // Compare contract
        if (pdfInfo.contract && dbRow.customerContract &&
            normalize(pdfInfo.contract) !== normalize(dbRow.customerContract)) {
          issues.push({
            field: 'customerContract',
            pdf: pdfInfo.contract,
            db: dbRow.customerContract
          });
        }

        if (issues.length > 0) {
          console.log(`❌ ${invoiceNumber} - ${issues.length} discrepancies found`);
          discrepancies.push({
            invoiceNumber,
            filename,
            dbId: dbRow.id,
            issue: 'DATA_MISMATCH',
            fields: issues
          });
        } else {
          totalMatched++;
          console.log(`✅ ${invoiceNumber} - All fields match`);
        }

      } catch (error) {
        console.error(`❌ ${invoiceNumber} - PDF parsing error:`, error.message);
        discrepancies.push({
          invoiceNumber,
          filename,
          issue: 'PDF_PARSING_ERROR',
          error: error.message
        });
      }

      resolve();
    });
  });
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('    COMPREHENSIVE INVOICE VALIDATION');
  console.log('═══════════════════════════════════════════════════════\n');

  const pdfDir = './invoice_pdfs';
  const pdfFiles = fs.readdirSync(pdfDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(pdfDir, f));

  console.log(`Found ${pdfFiles.length} PDF files\n`);
  console.log('Starting validation...\n');

  // Validate all PDFs
  for (const pdfPath of pdfFiles) {
    await validateInvoice(pdfPath);
  }

  // Generate report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`Total PDFs checked: ${totalChecked}`);
  console.log(`✅ Perfect matches: ${totalMatched}`);
  console.log(`❌ Discrepancies found: ${discrepancies.length}`);
  console.log(`📊 Accuracy rate: ${((totalMatched / totalChecked) * 100).toFixed(1)}%\n`);

  // Group discrepancies by type
  const missingInDB = discrepancies.filter(d => d.issue === 'MISSING_IN_DATABASE');
  const dataMismatches = discrepancies.filter(d => d.issue === 'DATA_MISMATCH');
  const parsingErrors = discrepancies.filter(d => d.issue === 'PDF_PARSING_ERROR');

  if (missingInDB.length > 0) {
    console.log(`\n📋 MISSING IN DATABASE (${missingInDB.length}):`);
    console.log('─'.repeat(55));
    missingInDB.forEach(item => {
      console.log(`  • ${item.invoiceNumber} (${item.filename})`);
    });
  }

  if (dataMismatches.length > 0) {
    console.log(`\n⚠️  DATA MISMATCHES (${dataMismatches.length}):`);
    console.log('─'.repeat(55));
    dataMismatches.forEach(item => {
      console.log(`\n  Invoice: ${item.invoiceNumber} (DB ID: ${item.dbId})`);
      item.fields.forEach(field => {
        console.log(`    ${field.field}:`);
        console.log(`      PDF: ${field.pdf}`);
        console.log(`      DB:  ${field.db}`);
        if (field.difference) console.log(`      Diff: $${field.difference}`);
      });
    });
  }

  if (parsingErrors.length > 0) {
    console.log(`\n🔧 PARSING ERRORS (${parsingErrors.length}):`);
    console.log('─'.repeat(55));
    parsingErrors.forEach(item => {
      console.log(`  • ${item.invoiceNumber}: ${item.error}`);
    });
  }

  // Save detailed report
  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      totalPDFs: pdfFiles.length,
      totalChecked,
      perfectMatches: totalMatched,
      totalDiscrepancies: discrepancies.length,
      accuracyRate: `${((totalMatched / totalChecked) * 100).toFixed(1)}%`
    },
    missingInDatabase: missingInDB,
    dataMismatches: dataMismatches,
    parsingErrors: parsingErrors
  };

  fs.writeFileSync('comprehensive-validation-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Detailed report saved to: comprehensive-validation-report.json');

  // Create CSV for corrections
  if (dataMismatches.length > 0) {
    let csv = 'Invoice Number,DB ID,Field,PDF Value,DB Value,Difference\n';
    dataMismatches.forEach(item => {
      item.fields.forEach(field => {
        csv += `"${item.invoiceNumber}","${item.dbId}","${field.field}","${field.pdf}","${field.db}","${field.difference || ''}"\n`;
      });
    });
    fs.writeFileSync('corrections-needed.csv', csv);
    console.log('✅ Corrections CSV saved to: corrections-needed.csv\n');
  }

  db.close();
}

main().catch(console.error);
