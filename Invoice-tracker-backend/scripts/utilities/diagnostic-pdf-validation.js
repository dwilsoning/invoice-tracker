const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Parse date from string
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // Try various date formats
  const patterns = [
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,  // DD-MM-YYYY or MM-DD-YYYY
    /(\d{1,2})[-\/\s]([a-z]+)[-\/\s](\d{2,4})/i  // DD-MMM-YYYY
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return cleaned; // Return as string for comparison
    }
  }
  return null;
}

// Classify invoice type from services
function classifyInvoiceType(services, amount) {
  if (amount && amount < 0) return 'Credit Memo';
  if (!services) return 'PS';

  const lower = services.toLowerCase();

  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';
  if (lower.includes('managed services') || lower.includes('managed/outsourcing')) return 'MS';
  if (lower.includes('professional services') || lower.includes('consulting')) return 'PS';

  if ((lower.includes('maintenance') || lower.includes('software support') ||
       lower.includes('support services') || lower.includes('support fee')) &&
      !lower.includes('managed') && !lower.includes('professional')) {
    return 'Maint';
  }

  if (lower.includes('subscription') || lower.includes('saas')) return 'Sub';
  if (lower.includes('hosting') || lower.includes('cloud services')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

// Detect frequency from services
function detectFrequency(services) {
  if (!services) return 'adhoc';
  const lower = services.toLowerCase();

  if (lower.includes('monthly')) return 'monthly';
  if (lower.includes('quarterly') || lower.includes('quarter')) return 'quarterly';
  if (lower.includes('bi-annual') || lower.includes('semi-annual') || lower.includes('6 month')) return 'bi-annual';
  if (lower.includes('tri-annual') || lower.includes('4 month')) return 'tri-annual';
  if ((lower.includes('annual') || lower.includes('yearly')) && !lower.includes('bi-annual') && !lower.includes('semi-annual')) return 'annual';

  return 'adhoc';
}

// Extract data from PDF
async function extractFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    const extracted = {
      invoiceNumber: null,
      client: null,
      invoiceDate: null,
      dueDate: null,
      amountDue: null,
      currency: null,
      services: null,
      customerContract: null,
      poNumber: null
    };

    // Extract invoice number
    const invMatch = text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
                     text.match(/Credit\s*Memo\s*[:\s#]*([0-9][A-Z0-9-]+)/i);
    if (invMatch) extracted.invoiceNumber = invMatch[1].trim();

    // Extract client from BILL TO section
    const billToMatch = text.match(/BILL\s*TO:?\s*([\s\S]{0,400}?)(?:Transaction\s+Type|Description|Week\s+Ending)/i);
    if (billToMatch) {
      const lines = billToMatch[1].split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        if (line.length > 5 && !line.match(/^ATTN:|^PO\s*BOX|^\d{4,}$|^GPO/i)) {
          if (line.match(/(Medical|Center|Hospital|Health|Inc|Ltd|Pty|Limited|Corporation)/i)) {
            extracted.client = line.substring(0, 100);
            break;
          }
        }
      }
    }

    // Extract currency
    const currMatch = text.match(/\b(USD|AUD|EUR|GBP|SGD)\b/i);
    if (currMatch) extracted.currency = currMatch[1].toUpperCase();

    // Extract invoice date
    const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                        text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
    if (invDateMatch) extracted.invoiceDate = invDateMatch[1].trim();

    // Extract due date
    const dueMatch = text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                    text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
    if (dueMatch) extracted.dueDate = dueMatch[1].trim();

    // Extract amount
    const amountMatch = text.match(/Invoice\s*Total[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
                       text.match(/Amount\s*Due[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i);
    if (amountMatch) {
      let amount = parseFloat(amountMatch[1].replace(/[,\$]/g, ''));
      if (amountMatch[0].includes('-') || amountMatch[0].includes('(')) {
        amount = -Math.abs(amount);
      }
      extracted.amountDue = amount;
    }

    // Extract contract
    const contractMatch = text.match(/(?:Customer\s*Contract|Contract)\s*#?[:\s]*([A-Z0-9-]+)/i);
    if (contractMatch) extracted.customerContract = contractMatch[1].trim();

    // Extract PO
    const poMatch = text.match(/PO\s*Number[:\s]*([A-Z0-9-]+)/i) ||
                   text.match(/(?:^|\s)PO[:\s#]*([A-Z0-9-]+)/im);
    if (poMatch) extracted.poNumber = poMatch[1].trim();

    // Extract services
    const descMatch = text.match(/Quantity\s*Description\s*Taxable\s*Ext\s+Price([\s\S]{0,8000}?)Item\s+Subtotal/i);
    if (descMatch) {
      let services = descMatch[1].trim();
      services = services.replace(/\s+Yes\s+\$[\d,]+\.?\d*/g, '');
      services = services.replace(/\s+No\s+\$[\d,]+\.?\d*/g, '');
      services = services.replace(/^\d+\s+/gm, '');
      services = services.replace(/\s+/g, ' ').trim();
      extracted.services = services.substring(0, 500);
    }

    return extracted;
  } catch (error) {
    return { error: error.message };
  }
}

// Compare two values with tolerance
function compareValues(field, pdfValue, dbValue, tolerance = { amount: 0.01, string: 0.8 }) {
  if (pdfValue === null || pdfValue === undefined) return { match: true, reason: 'PDF value not found' };
  if (dbValue === null || dbValue === undefined) return { match: false, reason: 'DB value is null' };

  // Numeric comparison
  if (field === 'amountDue') {
    const diff = Math.abs(pdfValue - dbValue);
    if (diff <= tolerance.amount) return { match: true };
    return { match: false, reason: `PDF: ${pdfValue}, DB: ${dbValue}, Diff: ${diff}` };
  }

  // String comparison (case-insensitive, trimmed)
  const pdfStr = String(pdfValue).toLowerCase().trim();
  const dbStr = String(dbValue).toLowerCase().trim();

  if (pdfStr === dbStr) return { match: true };

  // Partial match for longer strings
  if (pdfStr.length > 10 && dbStr.includes(pdfStr)) return { match: true };
  if (dbStr.length > 10 && pdfStr.includes(dbStr)) return { match: true };

  return { match: false, reason: `PDF: "${pdfValue}", DB: "${dbValue}"` };
}

async function runDiagnostic() {
  try {
    console.log('\n=====================================');
    console.log('PDF Validation Diagnostic Tool');
    console.log('=====================================\n');

    // Get command line arguments
    const args = process.argv.slice(2);
    let invoiceFilter = null;
    let limit = 10; // Default to checking 10 invoices

    if (args.includes('--all')) {
      limit = 99999;
    } else if (args.includes('--invoice')) {
      const idx = args.indexOf('--invoice');
      invoiceFilter = args[idx + 1];
      limit = 1;
    } else if (args.includes('--limit')) {
      const idx = args.indexOf('--limit');
      limit = parseInt(args[idx + 1]) || 10;
    }

    let query = `
      SELECT id, invoice_number, client, invoice_date, due_date, amount_due,
             currency, services, customer_contract, po_number, invoice_type,
             frequency, pdf_path
      FROM invoices
    `;

    const params = [];
    if (invoiceFilter) {
      query += ' WHERE invoice_number = $1';
      params.push(invoiceFilter);
    }
    query += ` ORDER BY upload_date DESC LIMIT ${limit}`;

    console.log(`Checking ${invoiceFilter ? 'invoice ' + invoiceFilter : 'up to ' + limit + ' invoices'}...\n`);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      console.log('No invoices found.');
      await pool.end();
      return;
    }

    const issues = [];
    let checkedCount = 0;
    let pdfNotFoundCount = 0;

    for (const invoice of result.rows) {
      if (!invoice.pdf_path) {
        console.log(`⚠️  Invoice ${invoice.invoice_number}: No PDF path in database`);
        continue;
      }

      const pdfFullPath = path.join(__dirname, '../..', invoice.pdf_path);

      if (!fs.existsSync(pdfFullPath)) {
        pdfNotFoundCount++;
        console.log(`⚠️  Invoice ${invoice.invoice_number}: PDF file not found at ${pdfFullPath}`);
        continue;
      }

      console.log(`Checking invoice ${invoice.invoice_number}...`);
      const pdfData = await extractFromPDF(pdfFullPath);

      if (pdfData.error) {
        issues.push({
          invoice_number: invoice.invoice_number,
          issue: 'PDF Parse Error',
          details: pdfData.error
        });
        continue;
      }

      checkedCount++;
      const invoiceIssues = [];

      // Compare invoice number
      const invNumComp = compareValues('invoiceNumber', pdfData.invoiceNumber, invoice.invoice_number);
      if (!invNumComp.match) {
        invoiceIssues.push({ field: 'Invoice Number', ...invNumComp });
      }

      // Compare client
      if (pdfData.client) {
        const clientComp = compareValues('client', pdfData.client, invoice.client);
        if (!clientComp.match) {
          invoiceIssues.push({ field: 'Client', ...clientComp });
        }
      }

      // Compare amount
      if (pdfData.amountDue !== null) {
        const amountComp = compareValues('amountDue', pdfData.amountDue, invoice.amount_due);
        if (!amountComp.match) {
          invoiceIssues.push({ field: 'Amount Due', ...amountComp });
        }
      }

      // Compare currency
      if (pdfData.currency) {
        const currComp = compareValues('currency', pdfData.currency, invoice.currency);
        if (!currComp.match) {
          invoiceIssues.push({ field: 'Currency', ...currComp });
        }
      }

      // Compare contract
      if (pdfData.customerContract) {
        const contractComp = compareValues('contract', pdfData.customerContract, invoice.customer_contract);
        if (!contractComp.match) {
          invoiceIssues.push({ field: 'Customer Contract', ...contractComp });
        }
      }

      // Validate frequency and type based on services
      if (pdfData.services || invoice.services) {
        const services = pdfData.services || invoice.services;
        const expectedFreq = detectFrequency(services);
        const expectedType = classifyInvoiceType(services, invoice.amount_due);

        if (invoice.frequency !== expectedFreq) {
          invoiceIssues.push({
            field: 'Frequency',
            match: false,
            reason: `Expected: ${expectedFreq}, DB: ${invoice.frequency}`
          });
        }

        if (invoice.invoice_type !== expectedType) {
          invoiceIssues.push({
            field: 'Invoice Type',
            match: false,
            reason: `Expected: ${expectedType}, DB: ${invoice.invoice_type}`
          });
        }
      }

      if (invoiceIssues.length > 0) {
        issues.push({
          invoice_number: invoice.invoice_number,
          client: invoice.client,
          issues: invoiceIssues
        });
      } else {
        console.log(`  ✅ All fields match\n`);
      }
    }

    // Generate report
    console.log('\n=====================================');
    console.log('Diagnostic Report');
    console.log('=====================================\n');
    console.log(`Total invoices checked: ${checkedCount}`);
    console.log(`PDFs not found: ${pdfNotFoundCount}`);
    console.log(`Invoices with issues: ${issues.length}\n`);

    if (issues.length > 0) {
      console.log('=====================================');
      console.log('Issues Found');
      console.log('=====================================\n');

      issues.forEach((issue, idx) => {
        console.log(`${idx + 1}. Invoice: ${issue.invoice_number}`);
        if (issue.client) console.log(`   Client: ${issue.client}`);

        if (issue.issue) {
          console.log(`   Issue: ${issue.issue}`);
          console.log(`   Details: ${issue.details}`);
        } else {
          issue.issues.forEach(i => {
            console.log(`   ❌ ${i.field}: ${i.reason}`);
          });
        }
        console.log('');
      });

      console.log('=====================================');
      console.log('Summary by Issue Type');
      console.log('=====================================\n');

      const issueTypes = {};
      issues.forEach(inv => {
        if (inv.issues) {
          inv.issues.forEach(i => {
            issueTypes[i.field] = (issueTypes[i.field] || 0) + 1;
          });
        }
      });

      Object.entries(issueTypes).forEach(([field, count]) => {
        console.log(`  ${field}: ${count} invoice(s)`);
      });
      console.log('');
    } else {
      console.log('✅ All checked invoices match their PDFs!\n');
    }

    console.log('=====================================');
    console.log('Usage');
    console.log('=====================================');
    console.log('Check specific invoice:');
    console.log('  node scripts/utilities/diagnostic-pdf-validation.js --invoice 4600032089');
    console.log('');
    console.log('Check first 50 invoices:');
    console.log('  node scripts/utilities/diagnostic-pdf-validation.js --limit 50');
    console.log('');
    console.log('Check all invoices:');
    console.log('  node scripts/utilities/diagnostic-pdf-validation.js --all');
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

runDiagnostic();
