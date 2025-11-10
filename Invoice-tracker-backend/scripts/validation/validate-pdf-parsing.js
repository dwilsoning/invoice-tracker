const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// INDEPENDENT PDF parsing functions
// These use DIFFERENT logic than the server to provide third-party validation

/**
 * Independent date parsing - uses different strategy than server
 * Looks for dates in multiple formats but with different fallback logic
 */
function parseDate(dateStr, currency, invoiceNumber) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = cleaned.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Try named month format (e.g., "28 Dec 2020" or "Dec 28, 2020")
  const monthNames = {
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

  // Pattern: DD Month YYYY or Month DD YYYY
  const namedMatch = cleaned.match(/(\d{1,2})\s+([a-z]+)\s+(\d{2,4})|([a-z]+)\s+(\d{1,2})[,\s]+(\d{2,4})/i);
  if (namedMatch) {
    let day, month, year;
    if (namedMatch[1]) {
      // DD Month YYYY
      day = parseInt(namedMatch[1]);
      const monthStr = namedMatch[2].toLowerCase();
      year = parseInt(namedMatch[3]);
      month = monthNames[monthStr] || monthNames[monthStr.substring(0, 3)];
    } else {
      // Month DD YYYY
      const monthStr = namedMatch[4].toLowerCase();
      day = parseInt(namedMatch[5]);
      year = parseInt(namedMatch[6]);
      month = monthNames[monthStr] || monthNames[monthStr.substring(0, 3)];
    }

    if (month && year) {
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format
  const numericMatch = cleaned.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (numericMatch) {
    const first = parseInt(numericMatch[1]);
    const second = parseInt(numericMatch[2]);
    let year = parseInt(numericMatch[3]);

    if (year < 100) year += 2000;

    let day, month;

    // Different logic from server: Check currency to determine format
    // AUD/NZD typically use DD/MM/YYYY
    // USD typically uses MM/DD/YYYY
    if (currency && (currency === 'AUD' || currency === 'NZD' || currency === 'GBP' || currency === 'EUR')) {
      // Assume DD/MM/YYYY for these currencies
      day = first;
      month = second;
    } else if (first > 12) {
      // Must be DD/MM/YYYY
      day = first;
      month = second;
    } else if (second > 12) {
      // Must be MM/DD/YYYY
      month = first;
      day = second;
    } else {
      // Ambiguous - default to MM/DD/YYYY for USD
      if (currency === 'USD') {
        month = first;
        day = second;
      } else {
        // Default to DD/MM/YYYY for others
        day = first;
        month = second;
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

/**
 * Independent invoice type classification - uses different priority order than server
 * This provides a second opinion on invoice type classification
 */
function classifyInvoiceType(services, invoice_number, amount) {
  // Credit memos - check amount first
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

  if (!services) return 'PS';

  const lower = services.toLowerCase();

  // Check for explicit credit memo keywords
  if (lower.includes('credit memo') || lower.includes('credit note')) {
    return 'Credit Memo';
  }

  // Software licenses - check for single/perpetual/one-time keywords FIRST
  // Different priority order than server
  if (lower.includes('license') || lower.includes('licence')) {
    if (lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time') ||
        lower.includes('connection license') ||
        lower.includes('application') && !lower.includes('subscription')) {
      return 'SW';
    }
  }

  // Managed Services - check various patterns
  if (lower.includes('managed') || lower.includes('outsourcing')) {
    if (lower.includes('service') ||
        lower.includes('outsourcing') ||
        lower.includes('managedservices')) {
      return 'MS';
    }
  }

  // Professional Services - consulting, implementation
  if (lower.includes('professional') ||
      lower.includes('consulting') ||
      lower.includes('implementation') ||
      lower.includes('training') ||
      lower.includes('penetration testing')) {
    return 'PS';
  }

  // Maintenance & Support
  if (lower.includes('maintenance') ||
      lower.includes('support') ||
      lower.includes('annual maintenance')) {
    // Make sure it's not managed services
    if (!lower.includes('managed') && !lower.includes('outsourcing')) {
      return 'Maint';
    }
  }

  // Subscriptions
  if (lower.includes('subscription') ||
      lower.includes('saas') ||
      (lower.includes('annual') && lower.includes('license'))) {
    return 'Sub';
  }

  // Hardware
  if (lower.includes('hardware') ||
      lower.includes('equipment') ||
      lower.includes('device') ||
      lower.includes('appliance')) {
    return 'HW';
  }

  // Hosting/Cloud
  if (lower.includes('hosting') ||
      lower.includes('cloud') ||
      lower.includes('infrastructure')) {
    return 'Hosting';
  }

  // Third party
  if (lower.includes('third party') || lower.includes('3rd party')) {
    return '3PP';
  }

  // Software - broader check
  if (lower.includes('software') || lower.includes('application')) {
    return 'SW';
  }

  // Default to Professional Services
  return 'PS';
}

/**
 * Independent PDF extraction - uses ALTERNATIVE patterns from the server
 * This creates a true third-party validation
 */
async function extractInvoiceDataFromPDF(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  const invoice = {
    invoiceNumber: '',
    client: '',
    invoiceDate: '',
    amountDue: 0,
    currency: 'USD',
    services: '',
    invoiceType: 'PS'
  };

  // ALTERNATIVE invoice number extraction - different patterns
  // Try multiple strategies in different order than server
  let invNumMatch =
    text.match(/Invoice\s+(?:Number|No\.?|#)?\s*:?\s*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Tax\s+Invoice\s*:?\s*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Credit\s+Memo\s*(?:Number|No\.?|#)?\s*:?\s*([0-9][A-Z0-9-]+)/i) ||
    text.match(/^([0-9]{8,})\s/m); // Invoice number at start of line

  if (invNumMatch) {
    const invoiceNum = invNumMatch[1].trim();
    if (invoiceNum !== 'Total' && invoiceNum.match(/\d/)) {
      invoice.invoiceNumber = invoiceNum;
    }
  }

  // ALTERNATIVE currency extraction - look in different locations
  const currencyMatch =
    text.match(/Currency\s*:?\s*(USD|AUD|EUR|GBP|SGD|NZD)/i) ||
    text.match(/\b(USD|AUD|EUR|GBP|SGD|NZD)\b/i) ||
    text.match(/\$\s*(USD|AUD|EUR|GBP|SGD|NZD)/i);

  if (currencyMatch) {
    invoice.currency = currencyMatch[1].toUpperCase();
  }

  // ALTERNATIVE invoice date extraction - try different patterns
  const invDateMatch =
    text.match(/Invoice\s+Date\s*:?\s*([0-9]{1,2}[-\/]\s*[A-Za-z]+[-\/\s]*[0-9]{2,4})/i) ||
    text.match(/Invoice\s+Date\s*:?\s*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
    text.match(/Date\s*:?\s*([0-9]{1,2}[-\/]\s*[A-Za-z]+[-\/\s]*[0-9]{2,4})/i) ||
    text.match(/\b([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})\b/i);

  if (invDateMatch) {
    invoice.invoiceDate = parseDate(invDateMatch[1].trim(), invoice.currency, invoice.invoiceNumber);
  }

  // ALTERNATIVE amount extraction - different pattern order
  let amountMatch =
    text.match(/Balance\s+Due\s*:?\s*\$?\s*(-?[\d,]+\.?\d*)/i) ||
    text.match(/Amount\s+Due\s*:?\s*\$?\s*(-?[\d,]+\.?\d*)/i) ||
    text.match(/Invoice\s+Total\s*:?\s*\$?\s*(-?[\d,]+\.?\d*)/i) ||
    text.match(/Total\s+Amount\s*:?\s*\$?\s*(-?[\d,]+\.?\d*)/i) ||
    text.match(/Item\s+Subtotal\s*\$?\s*(-?[\d,]+\.?\d*)/i);

  if (amountMatch) {
    const fullMatch = amountMatch[0];
    let amountStr = amountMatch[1];
    let amount = parseFloat(amountStr.replace(/[,$]/g, ''));

    // Check for negative indicators
    if (fullMatch.includes('-') || fullMatch.toLowerCase().includes('credit')) {
      amount = -Math.abs(amount);
    }

    invoice.amountDue = amount;
  }

  // ALTERNATIVE services extraction - look in different sections
  let services = '';

  // Strategy 1: Look for Description section with table data
  let descMatch = text.match(/Description[\s\S]{0,200}?(?:Taxable|Extended|Price)[\s\S]{0,100}?([\s\S]{0,1000}?)(?:Item\s+Subtotal|Subtotal|Total|Page\s+\d+)/i);
  if (descMatch) {
    services = descMatch[1];
  }

  // Strategy 2: Look between specific markers
  if (!services) {
    descMatch = text.match(/Transaction\s+Type[\s\S]{0,300}?([\s\S]{0,800}?)(?:Item\s+Subtotal|Special\s+Instructions)/i);
    if (descMatch) {
      services = descMatch[1];
    }
  }

  // Strategy 3: Look for line items with descriptions
  if (!services) {
    descMatch = text.match(/(?:Services|Items|Description)[:\s]+([\s\S]{0,600}?)(?:Subtotal|Total|Amount)/i);
    if (descMatch) {
      services = descMatch[1];
    }
  }

  // Clean up services text
  if (services) {
    // Remove pricing information
    services = services.replace(/\$\s*[\d,]+\.?\d*/g, '');
    // Remove Yes/No columns
    services = services.replace(/\b(Yes|No)\b/gi, '');
    // Remove numbers at line starts (quantities)
    services = services.replace(/^\s*\d+\s+/gm, '');
    // Remove extra whitespace
    services = services.replace(/\s+/g, ' ').trim();
    // Take first 500 chars
    invoice.services = services.substring(0, 500);
  } else {
    invoice.services = 'No service description found';
  }

  // Classify invoice type using independent logic
  invoice.invoiceType = classifyInvoiceType(invoice.services, invoice.invoiceNumber, invoice.amountDue);

  return invoice;
}

async function validatePDFParsing() {
  console.log('==================================================');
  console.log('PDF PARSING VALIDATION');
  console.log('==================================================\n');

  const invoicePdfsDir = path.join(__dirname, '../../invoice_pdfs');

  if (!fs.existsSync(invoicePdfsDir)) {
    console.error('ERROR: invoice_pdfs directory not found');
    return;
  }

  const pdfFiles = fs.readdirSync(invoicePdfsDir)
    .filter(file => {
      // Only include PDFs, exclude attachments
      if (!file.endsWith('.pdf')) return false;

      // Exclude files that are clearly attachments (remittance, statement, etc.)
      const lower = file.toLowerCase();
      if (lower.includes('remittance') ||
          lower.includes('statement') ||
          lower.includes('receipt') ||
          lower.includes('attachment')) {
        return false;
      }

      // Only include files that start with timestamp or contain "invoice" or "credit"
      // Format: timestamp-Invoice or timestamp-Credit Memo
      const isInvoiceFile = lower.includes('invoice') ||
                           lower.includes('credit') ||
                           lower.match(/^\d+-.*\.pdf$/);

      return isInvoiceFile;
    })
    .map(file => ({ filename: file, path: path.join(invoicePdfsDir, file) }));

  console.log(`Found ${pdfFiles.length} invoice/credit memo PDF files`);
  console.log(`(Excluding attachments like remittance notes, statements, etc.)\n`);

  // Check for command line arguments
  const args = process.argv.slice(2);
  let validationType = 'sample'; // default: sample
  let sampleSize = 20; // default sample size

  if (args.includes('--all')) {
    validationType = 'all';
  } else if (args.some(arg => arg.startsWith('--random'))) {
    validationType = 'random';
    const randomArg = args.find(arg => arg.startsWith('--random'));
    if (randomArg && randomArg.includes('=')) {
      sampleSize = parseInt(randomArg.split('=')[1]) || 20;
    }
  } else if (args.some(arg => arg.startsWith('--sample'))) {
    const sampleArg = args.find(arg => arg.startsWith('--sample'));
    if (sampleArg && sampleArg.includes('=')) {
      sampleSize = parseInt(sampleArg.split('=')[1]) || 20;
    }
  }

  let sample;
  if (validationType === 'all') {
    sample = pdfFiles;
    console.log(`Validating ALL ${pdfFiles.length} PDFs...\n`);
  } else if (validationType === 'random') {
    // Randomly select PDFs
    const shuffled = [...pdfFiles].sort(() => 0.5 - Math.random());
    sample = shuffled.slice(0, Math.min(sampleSize, pdfFiles.length));
    console.log(`Validating RANDOM sample of ${sample.length} PDFs...\n`);
  } else {
    // Default: first N PDFs (sequential sample)
    sample = pdfFiles.slice(0, Math.min(sampleSize, pdfFiles.length));
    console.log(`Validating first ${sample.length} PDFs...\n`);
  }

  const results = {
    total: 0,
    matched: 0,
    mismatched: 0,
    notInDB: 0,
    errors: 0,
    details: []
  };

  for (const pdfFile of sample) {
    results.total++;

    try {
      // Parse PDF
      const parsed = await extractInvoiceDataFromPDF(pdfFile.path);

      if (!parsed.invoiceNumber) {
        results.errors++;
        results.details.push({
          filename: pdfFile.filename,
          status: 'ERROR',
          message: 'Could not extract invoice number from PDF'
        });
        continue;
      }

      // Get from database
      const dbResult = await pool.query(
        'SELECT invoice_number, client, invoice_date, amount_due, currency, services, invoice_type FROM invoices WHERE invoice_number = $1',
        [parsed.invoiceNumber]
      );

      if (dbResult.rows.length === 0) {
        results.notInDB++;
        results.details.push({
          filename: pdfFile.filename,
          invoiceNumber: parsed.invoiceNumber,
          status: 'NOT_IN_DB',
          message: 'Invoice not found in database'
        });
        continue;
      }

      const dbInvoice = dbResult.rows[0];
      const mismatches = [];

      // Compare fields
      if (parsed.invoiceNumber !== dbInvoice.invoice_number) {
        mismatches.push(`Invoice Number: PDF="${parsed.invoiceNumber}" DB="${dbInvoice.invoice_number}"`);
      }

      if (parsed.invoiceDate && dbInvoice.invoice_date) {
        const parsedDate = new Date(parsed.invoiceDate).toISOString().split('T')[0];
        const dbDate = new Date(dbInvoice.invoice_date).toISOString().split('T')[0];
        if (parsedDate !== dbDate) {
          mismatches.push(`Invoice Date: PDF="${parsedDate}" DB="${dbDate}"`);
        }
      }

      if (parsed.amountDue !== 0 && dbInvoice.amount_due !== null) {
        const diff = Math.abs(parsed.amountDue - dbInvoice.amount_due);
        if (diff > 0.01) {
          mismatches.push(`Amount: PDF="${parsed.amountDue}" DB="${dbInvoice.amount_due}"`);
        }
      }

      if (parsed.currency !== dbInvoice.currency) {
        mismatches.push(`Currency: PDF="${parsed.currency}" DB="${dbInvoice.currency}"`);
      }

      if (parsed.invoiceType !== dbInvoice.invoice_type) {
        mismatches.push(`Type: PDF="${parsed.invoiceType}" DB="${dbInvoice.invoice_type}"`);
      }

      if (mismatches.length > 0) {
        results.mismatched++;
        results.details.push({
          filename: pdfFile.filename,
          invoiceNumber: parsed.invoiceNumber,
          status: 'MISMATCH',
          mismatches
        });
      } else {
        results.matched++;
        results.details.push({
          filename: pdfFile.filename,
          invoiceNumber: parsed.invoiceNumber,
          status: 'MATCH'
        });
      }

    } catch (error) {
      results.errors++;
      results.details.push({
        filename: pdfFile.filename,
        status: 'ERROR',
        message: error.message
      });
    }
  }

  // Print results
  console.log('\n==================================================');
  console.log('VALIDATION RESULTS');
  console.log('==================================================\n');
  console.log(`Total PDFs Tested:     ${results.total}`);
  console.log(`✅ Matched:             ${results.matched}`);
  console.log(`⚠️  Mismatched:          ${results.mismatched}`);
  console.log(`❓ Not in Database:     ${results.notInDB}`);
  console.log(`❌ Errors:              ${results.errors}`);
  console.log(`\nAccuracy: ${((results.matched / results.total) * 100).toFixed(1)}%\n`);

  // Show details
  if (results.mismatched > 0) {
    console.log('\n==================================================');
    console.log('MISMATCHES');
    console.log('==================================================\n');
    results.details.filter(d => d.status === 'MISMATCH').forEach(detail => {
      console.log(`📄 ${detail.filename}`);
      console.log(`   Invoice: ${detail.invoiceNumber}`);
      detail.mismatches.forEach(m => console.log(`   - ${m}`));
      console.log('');
    });
  }

  if (results.errors > 0) {
    console.log('\n==================================================');
    console.log('ERRORS');
    console.log('==================================================\n');
    results.details.filter(d => d.status === 'ERROR').forEach(detail => {
      console.log(`📄 ${detail.filename}`);
      console.log(`   Error: ${detail.message}\n`);
    });
  }

  if (results.notInDB > 0) {
    console.log('\n==================================================');
    console.log('NOT IN DATABASE');
    console.log('==================================================\n');
    results.details.filter(d => d.status === 'NOT_IN_DB').forEach(detail => {
      console.log(`📄 ${detail.filename}`);
      console.log(`   Invoice: ${detail.invoiceNumber}\n`);
    });
  }

  // Save report
  const reportPath = path.join(__dirname, '../../pdf-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Detailed report saved to: pdf-validation-report.json\n`);

  await pool.end();
}

validatePDFParsing().catch(console.error);
