const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');

const db = new sqlite3.Database('./invoices.db');

// Store all discrepancies
const discrepancies = [];
const missingInDB = [];
const parsingErrors = [];

// Get all PDFs
const pdfDir = './invoice_pdfs';
const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

console.log(`Found ${pdfFiles.length} PDF files to validate\n`);

// Function to extract invoice number from filename
function getInvoiceNumberFromFilename(filename) {
  // Remove timestamp prefix and .pdf extension
  const cleaned = filename.replace(/^\d+-/, '').replace('.pdf', '');

  // Try to extract invoice number from various patterns
  const patterns = [
    /Invoice[_\s]+(\d+)/i,
    /Inv[_\s]+(\d+-\d+)/i,
    /MDRX_AR_Project_Invoice_(\d+)/,
    /Credit Memo (\d+)/i,
    /(\d{8,})/  // Fallback: any 8+ digit number
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Function to normalize text for comparison
function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Function to extract data from PDF text
function extractPDFData(text) {
  const data = {};

  // Extract invoice number
  const invMatch = text.match(/(?:invoice|inv\.?)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9-]+)/i);
  data.invoiceNumber = invMatch ? invMatch[1] : null;

  // Extract date
  const dateMatch = text.match(/(?:invoice|date)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  data.invoiceDate = dateMatch ? dateMatch[1] : null;

  // Extract due date
  const dueMatch = text.match(/(?:due|payment due)\s*(?:date)?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  data.dueDate = dueMatch ? dueMatch[1] : null;

  // Extract amount
  const amountMatch = text.match(/(?:total|amount due|balance)\s*:?\s*(?:AUD|USD|EUR|GBP|SGD)?\s*\$?\s*([\d,]+\.?\d*)/i);
  data.amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

  // Extract client/customer name
  const clientMatch = text.match(/(?:bill to|customer|client)\s*:?\s*([A-Za-z0-9\s&'.,-]+?)(?:\n|address|abn)/i);
  data.client = clientMatch ? clientMatch[1].trim() : null;

  // Extract PO number
  const poMatch = text.match(/(?:po|purchase order)\s*(?:number|no\.?)?\s*:?\s*([A-Z0-9-]+)/i);
  data.poNumber = poMatch ? poMatch[1] : null;

  return data;
}

// Process each PDF
async function validatePDF(filename) {
  const invoiceNumber = getInvoiceNumberFromFilename(filename);

  if (!invoiceNumber) {
    parsingErrors.push({
      file: filename,
      error: 'Could not extract invoice number from filename'
    });
    return;
  }

  // Check if invoice exists in database
  return new Promise((resolve) => {
    db.get(
      'SELECT * FROM invoices WHERE invoiceNumber = ?',
      [invoiceNumber],
      async (err, dbRow) => {
        if (err) {
          parsingErrors.push({
            file: filename,
            invoiceNumber,
            error: `Database error: ${err.message}`
          });
          resolve();
          return;
        }

        if (!dbRow) {
          missingInDB.push({
            file: filename,
            invoiceNumber,
            reason: 'Invoice not found in database'
          });
          resolve();
          return;
        }

        // Read PDF and extract data
        try {
          const pdfPath = path.join(pdfDir, filename);
          const dataBuffer = fs.readFileSync(pdfPath);
          const pdfData = await pdf(dataBuffer);
          const pdfText = pdfData.text;

          // Extract data from PDF
          const extractedData = extractPDFData(pdfText);

          // Compare with database
          const issues = [];

          // Compare invoice number
          if (extractedData.invoiceNumber &&
              normalizeText(extractedData.invoiceNumber) !== normalizeText(dbRow.invoiceNumber)) {
            issues.push({
              field: 'invoiceNumber',
              pdf: extractedData.invoiceNumber,
              db: dbRow.invoiceNumber
            });
          }

          // Compare amount (with tolerance for rounding)
          if (extractedData.amount && dbRow.amountDue) {
            const diff = Math.abs(extractedData.amount - dbRow.amountDue);
            if (diff > 0.01) {
              issues.push({
                field: 'amountDue',
                pdf: extractedData.amount,
                db: dbRow.amountDue,
                difference: diff.toFixed(2)
              });
            }
          }

          // Compare client name (fuzzy match - check if they contain similar text)
          if (extractedData.client && dbRow.client) {
            const pdfClient = normalizeText(extractedData.client);
            const dbClient = normalizeText(dbRow.client);

            // Check if neither contains the other (meaning they're significantly different)
            if (!pdfClient.includes(dbClient.split(' ')[0]) &&
                !dbClient.includes(pdfClient.split(' ')[0])) {
              issues.push({
                field: 'client',
                pdf: extractedData.client,
                db: dbRow.client
              });
            }
          }

          if (issues.length > 0) {
            discrepancies.push({
              file: filename,
              invoiceNumber: dbRow.invoiceNumber,
              dbId: dbRow.id,
              issues
            });
          }

        } catch (error) {
          parsingErrors.push({
            file: filename,
            invoiceNumber,
            error: `PDF parsing error: ${error.message}`
          });
        }

        resolve();
      }
    );
  });
}

// Main validation
async function main() {
  console.log('Starting validation...\n');

  // Sample validation - check first 50 PDFs for speed
  const samplesToCheck = pdfFiles.slice(0, 50);
  console.log(`Validating ${samplesToCheck.length} sample invoices...\n`);

  for (const file of samplesToCheck) {
    await validatePDF(file);
  }

  // Generate report
  console.log('\n========== VALIDATION REPORT ==========\n');

  console.log(`Total PDFs checked: ${samplesToCheck.length}`);
  console.log(`Discrepancies found: ${discrepancies.length}`);
  console.log(`Missing in DB: ${missingInDB.length}`);
  console.log(`Parsing errors: ${parsingErrors.length}\n`);

  if (discrepancies.length > 0) {
    console.log('=== DATA DISCREPANCIES ===\n');
    discrepancies.forEach(disc => {
      console.log(`File: ${disc.file}`);
      console.log(`Invoice: ${disc.invoiceNumber} (DB ID: ${disc.dbId})`);
      disc.issues.forEach(issue => {
        console.log(`  ${issue.field}:`);
        console.log(`    PDF value: ${issue.pdf}`);
        console.log(`    DB value:  ${issue.db}`);
        if (issue.difference) console.log(`    Difference: $${issue.difference}`);
      });
      console.log('');
    });
  }

  if (missingInDB.length > 0) {
    console.log('=== MISSING IN DATABASE ===\n');
    missingInDB.forEach(item => {
      console.log(`File: ${item.file}`);
      console.log(`Invoice: ${item.invoiceNumber}`);
      console.log(`Reason: ${item.reason}\n`);
    });
  }

  if (parsingErrors.length > 0) {
    console.log('=== PARSING ERRORS ===\n');
    parsingErrors.forEach(error => {
      console.log(`File: ${error.file}`);
      if (error.invoiceNumber) console.log(`Invoice: ${error.invoiceNumber}`);
      console.log(`Error: ${error.error}\n`);
    });
  }

  // Save detailed report to file
  const report = {
    summary: {
      totalPDFsChecked: samplesToCheck.length,
      discrepanciesFound: discrepancies.length,
      missingInDB: missingInDB.length,
      parsingErrors: parsingErrors.length
    },
    discrepancies,
    missingInDB,
    parsingErrors
  };

  fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
  console.log('\n✓ Detailed report saved to validation-report.json\n');

  db.close();
}

main().catch(console.error);
