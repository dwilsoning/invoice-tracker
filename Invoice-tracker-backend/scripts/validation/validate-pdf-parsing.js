require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  user: process.env.DB_USER || 'invoiceuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD || 'invoicepass',
  port: process.env.DB_PORT || 5432,
});

// PDF parsing functions (replicated from server-postgres.js)
function parseDate(dateStr, currency, invoiceNumber) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

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

  const namedMonthMatch = cleaned.match(/(\d{1,2})[-\/\s]([a-z]+)[-\/\s](\d{2,4})/i);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1]);
    const monthStr = namedMonthMatch[2].toLowerCase();
    let year = parseInt(namedMonthMatch[3]);

    const month = monthMap[monthStr];

    if (month) {
      if (year < 100) year += 2000;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  const parts = cleaned.split(/[-\/]/);
  if (parts.length !== 3) return null;

  let day, month, year;
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  const third = parseInt(parts[2]);

  if (isNaN(first) || isNaN(second) || isNaN(third)) return null;

  year = third;
  if (year < 100) year += 2000;

  if (first > 12) {
    day = first;
    month = second;
  } else if (second > 12) {
    month = first;
    day = second;
  } else {
    const invoiceStr = invoiceNumber ? invoiceNumber.toString() : '';
    const usFormatPrefixes = ['46', '47', '48', '49'];

    let isUSFormat = false;
    for (const prefix of usFormatPrefixes) {
      if (invoiceStr.startsWith(prefix)) {
        isUSFormat = true;
        break;
      }
    }

    if (isUSFormat) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
}

function classifyInvoiceType(services, invoice_number, amount) {
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

  if (!services) return 'PS';

  const lower = services.toLowerCase();

  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  if (lower.includes('consulting') ||
      lower.includes('professional services') ||
      lower.includes('professionalservice') ||
      lower.includes('professional service fee') ||
      lower.includes('professionalservicesfee') ||
      lower.includes('penetration testing')) return 'PS';

  if (lower.includes('managed services') ||
      lower.includes('managedservices') ||
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  if ((lower.includes('maintenance') ||
       lower.includes('annual maintenance') ||
       lower.includes('software support') ||
       lower.includes('support services') ||
       lower.includes('support fee') ||
       lower.includes('license maintenance')) &&
      !lower.includes('managed') &&
      !lower.includes('professional') &&
      !lower.includes('subscription')) {
    return 'Maint';
  }

  if ((lower.includes('license') || lower.includes('licence')) &&
      !lower.includes('subscription') &&
      !lower.includes('annual') &&
      !lower.includes('yearly') &&
      !lower.includes('recurring')) {
    if (lower.includes('software') ||
        lower.includes('connectivity') ||
        lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time')) {
      return 'SW';
    }
    return 'SW';
  }

  if (lower.includes('subscription') ||
      (lower.includes('license') && (lower.includes('annual') || lower.includes('yearly'))) ||
      lower.includes('saas')) return 'Sub';

  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application') || lower.includes('program')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

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

  // Extract invoice number
  const invNumMatch =
    text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Tax\s*Invoice\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Credit\s*Memo\s*[:\s#]*([0-9][A-Z0-9-]+)/i);
  if (invNumMatch) {
    const invoiceNum = invNumMatch[1].trim();
    if (invoiceNum !== 'Total' && invoiceNum.match(/\d/)) {
      invoice.invoiceNumber = invoiceNum;
    }
  }

  // Extract currency
  const currencyMatch = text.match(/\b(USD|AUD|EUR|GBP|SGD|NZD)\b/i);
  if (currencyMatch) {
    invoice.currency = currencyMatch[1].toUpperCase();
  }

  // Extract invoice date
  const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
  if (invDateMatch) {
    invoice.invoiceDate = parseDate(invDateMatch[1].trim(), invoice.currency, invoice.invoiceNumber);
  }

  // Extract amount
  let amountMatch =
    text.match(/Invoice\s*Total[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
    text.match(/(?:Amount\s*Due|Balance\s*Due)[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i) ||
    text.match(/Item\s*Subtotal[\s\n]*\$[\s\n]*(-?[\d,]+\.?\d*)/i);

  if (amountMatch) {
    const fullMatch = amountMatch[0];
    let amountStr = amountMatch[1];
    let amount = parseFloat(amountStr.replace(/[,\$]/g, ''));

    if (fullMatch.includes('-') || fullMatch.includes('(')) {
      amount = -Math.abs(amount);
    }

    invoice.amountDue = amount;
  }

  // Extract services
  let services = '';
  const descMatch = text.match(/Description[\s\S]{0,150}?Week\s+Ending\s+Date[\s\S]{0,150}?Qty[\s\S]{0,150}?UOM[\s\S]{0,150}?Unit\s+Price[\s\S]{0,150}?Taxable[\s\S]{0,150}?Extended\s+Price([\s\S]{0,1500}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
  if (descMatch) {
    services = descMatch[1].trim();
    services = services.replace(/\s+Yes\s+\$[\d,]+\.?\d*/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+\.?\d*/g, '');
    services = services.replace(/\s+/g, ' ').trim();
    invoice.services = services.substring(0, 500);
  }

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
    .filter(file => file.endsWith('.pdf'))
    .map(file => ({ filename: file, path: path.join(invoicePdfsDir, file) }));

  console.log(`Found ${pdfFiles.length} PDF files\n`);

  // Sample validation - test first 20 PDFs
  const sampleSize = Math.min(20, pdfFiles.length);
  const sample = pdfFiles.slice(0, sampleSize);

  console.log(`Validating ${sampleSize} PDFs...\n`);

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
