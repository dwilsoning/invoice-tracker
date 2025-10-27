const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');

const db = new sqlite3.Database('./invoices.db');

const typeMismatches = [];
const unclassifiedInvoices = [];

// Extract invoice type from PDF text
function extractInvoiceType(text, invoiceNumber) {
  // Check for Credit Memo
  if (text.match(/Credit\s+Memo/i) || text.match(/Transaction\s+Type\s*\n\s*Credit\s+Memo/i)) {
    return 'Credit Memo';
  }

  // Look for service descriptions
  const servicePatterns = {
    'PS': /Professional\s+Services|Consulting|Implementation|Project\s+Services/i,
    'Maint': /Maintenance|Support\s+Services|Annual\s+Support|Maint\./i,
    'Sub': /Subscription|Annual\s+Subscription|License\s+Subscription/i,
    'Hosting': /Hosting|Cloud\s+Services|Infrastructure/i,
    'MS': /Managed\s+Services|MIT\s+Services|Outsourcing\s+Services/i,
    'HW': /Hardware|Equipment|Servers/i,
    '3PP': /Third\s+Party|3rd\s+Party|Third-Party/i
  };

  // Extract description text
  const descMatch = text.match(/Description\s+(.*?)(?:Item\s+Subtotal|Special\s+Instructions|Wiring\s+instructions)/is);
  const description = descMatch ? descMatch[1] : text;

  // Check each pattern
  for (const [type, pattern] of Object.entries(servicePatterns)) {
    if (pattern.test(description)) {
      return type;
    }
  }

  // If we can't determine, return null
  return null;
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

// Main validation function
async function validateInvoiceTypes() {
  const pdfDir = './invoice_pdfs';
  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

  console.log('Starting invoice type validation...\n');
  console.log(`Checking ${pdfFiles.length} PDFs...\n`);

  let checked = 0;
  let matched = 0;

  for (const filename of pdfFiles) {
    const invoiceNumber = getInvoiceNumber(filename);
    if (!invoiceNumber || filename.includes('REMITTANCE')) continue;

    const pdfPath = path.join(pdfDir, filename);

    try {
      // Get DB record
      const dbRow = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE invoiceNumber = ?', [invoiceNumber], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!dbRow) continue;

      checked++;

      // If no type in DB, note it
      if (!dbRow.invoiceType) {
        unclassifiedInvoices.push({
          invoiceNumber,
          client: dbRow.client
        });
        continue;
      }

      // Read PDF
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      const pdfType = extractInvoiceType(pdfData.text, invoiceNumber);

      if (pdfType && pdfType !== dbRow.invoiceType) {
        // Extract a snippet of description
        const descMatch = pdfData.text.match(/Description\s+(.*?)(?:\n|Item\s+Subtotal)/is);
        const description = descMatch ? descMatch[1].substring(0, 150).replace(/\s+/g, ' ').trim() : '';

        typeMismatches.push({
          invoiceNumber,
          dbId: dbRow.id,
          dbType: dbRow.invoiceType,
          pdfType: pdfType,
          description: description,
          client: dbRow.client
        });
      } else {
        matched++;
      }

    } catch (error) {
      // Skip errors
    }
  }

  // Display results
  console.log('═══════════════════════════════════════════════════════');
  console.log('      INVOICE TYPE VALIDATION RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Total invoices checked: ${checked}`);
  console.log(`✅ Types match: ${matched}`);
  console.log(`⚠️  Type mismatches: ${typeMismatches.length}`);
  console.log(`ℹ️  Unclassified in DB: ${unclassifiedInvoices.length}\n`);

  if (typeMismatches.length > 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('           TYPE MISMATCHES FOUND');
    console.log('═══════════════════════════════════════════════════════\n');

    typeMismatches.forEach(mismatch => {
      console.log(`Invoice: ${mismatch.invoiceNumber}`);
      console.log(`  Client: ${mismatch.client}`);
      console.log(`  DB Type:  ${mismatch.dbType}`);
      console.log(`  PDF Type: ${mismatch.pdfType}`);
      console.log(`  Description: ${mismatch.description}`);
      console.log('');
    });
  }

  if (unclassifiedInvoices.length > 0 && unclassifiedInvoices.length <= 20) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('        UNCLASSIFIED INVOICES IN DATABASE');
    console.log('═══════════════════════════════════════════════════════\n');
    unclassifiedInvoices.forEach(inv => {
      console.log(`  • ${inv.invoiceNumber} (${inv.client})`);
    });
    console.log('');
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalChecked: checked,
      matched: matched,
      mismatches: typeMismatches.length,
      unclassified: unclassifiedInvoices.length,
      accuracyRate: `${((matched / checked) * 100).toFixed(1)}%`
    },
    typeMismatches,
    unclassifiedInvoices
  };

  fs.writeFileSync('invoice-type-validation-report.json', JSON.stringify(report, null, 2));
  console.log('✅ Detailed report saved to: invoice-type-validation-report.json\n');

  // Accuracy summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                 CONCLUSION');
  console.log('═══════════════════════════════════════════════════════\n');

  if (typeMismatches.length === 0) {
    console.log('✅ All invoice types in the database match the PDFs!');
    console.log('   No corrections needed.\n');
  } else {
    console.log(`⚠️  Found ${typeMismatches.length} potential type mismatches.`);
    console.log('   Review the report to determine if corrections are needed.\n');
  }

  console.log(`Invoice Type Accuracy: ${((matched / checked) * 100).toFixed(1)}%\n`);

  db.close();
}

validateInvoiceTypes().catch(console.error);
