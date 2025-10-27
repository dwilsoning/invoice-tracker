const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const pdf = require('pdf-parse');
const path = require('path');

const db = new sqlite3.Database('./invoices.db');

// List of missing MDRX invoices identified from QA report
const missingInvoices = [
  '6000000893',
  '6000000897',
  '9000000081',
  '9000000082',
  '9000000083',
  '9000000084',
  '9000000085',
  '9000000086',
  '9000000087',
  '9000000088',
  '9000000089',
  '9000000090',
  '9000000092',
  '9000000093'
];

// Parse invoice data from PDF (simplified version of server.js logic)
async function parseInvoicePDF(pdfPath, filename) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  const invoice = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    invoiceNumber: null,
    client: null,
    invoiceDate: null,
    dueDate: null,
    amount: 0,
    currency: 'USD',
    status: 'Pending',
    invoiceType: null,
    pdfPath: filename
  };

  // Extract invoice number
  let invNumMatch = text.match(/Invoice\s*#?\s*:?\s*([A-Z]?[0-9]+)/i) ||
                    text.match(/Invoice\s+Number\s*:?\s*([A-Z]?[0-9]+)/i) ||
                    text.match(/Credit\s+Memo\s*#?\s*:?\s*(\d+)/i);
  if (invNumMatch) {
    invoice.invoiceNumber = invNumMatch[1].trim();
  }

  // Extract client name
  const clientMatch = text.match(/Bill\s+To[:\s\n]+([^\n]+)/i) ||
                      text.match(/Customer[:\s\n]+([^\n]+)/i);
  if (clientMatch) {
    invoice.client = clientMatch[1].trim().replace(/\s+/g, ' ');
  }

  // Extract currency
  if (text.includes('SGD') || text.includes('S$')) {
    invoice.currency = 'SGD';
  } else if (text.includes('USD') || text.includes('US$') || text.includes('$')) {
    invoice.currency = 'USD';
  } else if (text.includes('AUD') || text.includes('A$')) {
    invoice.currency = 'AUD';
  }

  // Extract invoice date - FIXED VERSION
  let invoiceDateStr = null;
  const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                       text.match(/DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
  if (invDateMatch) {
    invoiceDateStr = invDateMatch[1].trim();
    invoice.invoiceDate = parseDate(invoiceDateStr, invoice.invoiceNumber);
  }

  // Extract due date
  let dueDateStr = null;
  const dueDateMatch = text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                       text.match(/DUE\s+DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
  if (dueDateMatch) {
    dueDateStr = dueDateMatch[1].trim();
    invoice.dueDate = parseDate(dueDateStr, invoice.invoiceNumber);
  }

  // Extract amount
  let amountMatch = text.match(/Invoice\s*Total[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
                    text.match(/Amount\s*Due[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i);
  if (amountMatch) {
    invoice.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Classify invoice type
  if (text.match(/Credit\s+Memo/i)) {
    invoice.invoiceType = 'Credit Memo';
  } else if (text.match(/Professional\s+Services|Consulting|Implementation/i)) {
    invoice.invoiceType = 'PS';
  } else if (text.match(/Maintenance|Support\s+Services|Annual\s+Support/i)) {
    invoice.invoiceType = 'Maint';
  } else if (text.match(/Subscription|License\s+Subscription/i)) {
    invoice.invoiceType = 'Sub';
  }

  return invoice;
}

// Parse date function (simplified)
function parseDate(dateStr, invoiceNumber) {
  if (!dateStr) return null;

  const monthMap = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  // Handle DD-MMM-YYYY format
  const match1 = dateStr.match(/(\d{1,2})[-\/\s]([a-z]{3})[-\/\s](\d{4})/i);
  if (match1) {
    const day = match1[1].padStart(2, '0');
    const month = monthMap[match1[2].toLowerCase()];
    const year = match1[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Handle DD/MM/YYYY or MM/DD/YYYY
  const match2 = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (match2) {
    const first = parseInt(match2[1]);
    const second = parseInt(match2[2]);
    let year = match2[3];
    if (year.length === 2) year = '20' + year;

    let day, month;
    // If first > 12, it must be DD-MM-YYYY
    if (first > 12) {
      day = first.toString().padStart(2, '0');
      month = second.toString().padStart(2, '0');
    }
    // If second > 12, it must be MM-DD-YYYY
    else if (second > 12) {
      month = first.toString().padStart(2, '0');
      day = second.toString().padStart(2, '0');
    }
    // Use invoice pattern (90 series and 60 series are DD-MM-YYYY)
    else {
      const invoiceStr = invoiceNumber?.toString() || '';
      if (invoiceStr.startsWith('9') || invoiceStr.startsWith('60') || invoiceStr.startsWith('40')) {
        // DD-MM-YYYY for international invoices
        day = first.toString().padStart(2, '0');
        month = second.toString().padStart(2, '0');
      } else {
        // MM-DD-YYYY for US invoices
        month = first.toString().padStart(2, '0');
        day = second.toString().padStart(2, '0');
      }
    }

    return `${year}-${month}-${day}`;
  }

  return null;
}

// Upload missing invoices
async function uploadMissingInvoices() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('        UPLOADING MISSING MDRX INVOICES');
  console.log('═══════════════════════════════════════════════════════\n');

  const pdfDir = './invoice_pdfs';
  let uploaded = 0;
  let failed = 0;

  for (const invoiceNum of missingInvoices) {
    try {
      // Find PDF file for this invoice
      const files = fs.readdirSync(pdfDir).filter(f =>
        f.includes(invoiceNum) && f.endsWith('.pdf')
      );

      if (files.length === 0) {
        console.log(`❌ PDF not found for invoice ${invoiceNum}`);
        failed++;
        continue;
      }

      const filename = files[0];
      const pdfPath = path.join(pdfDir, filename);

      // Check if already in database
      const existing = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE invoiceNumber = ?', [invoiceNum], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existing) {
        console.log(`⚠️  Invoice ${invoiceNum} already exists in database - skipping`);
        continue;
      }

      // Parse PDF and extract invoice data
      console.log(`📄 Processing ${invoiceNum}...`);
      const invoice = await parseInvoicePDF(pdfPath, filename);

      // Ensure required fields have values
      if (!invoice.dueDate) {
        // Default to 30 days from invoice date or today
        const baseDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
        baseDate.setDate(baseDate.getDate() + 30);
        invoice.dueDate = baseDate.toISOString().split('T')[0];
      }
      if (!invoice.invoiceDate) {
        invoice.invoiceDate = new Date().toISOString().split('T')[0];
      }

      // Insert into database
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO invoices (id, invoiceNumber, client, invoiceDate, dueDate, amountDue, currency, status, invoiceType, pdfPath)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoice.id,
          invoice.invoiceNumber,
          invoice.client,
          invoice.invoiceDate,
          invoice.dueDate,
          invoice.amount,
          invoice.currency,
          invoice.status,
          invoice.invoiceType,
          invoice.pdfPath
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`✅ Uploaded invoice ${invoiceNum}`);
      console.log(`   Client: ${invoice.client}`);
      console.log(`   Date: ${invoice.invoiceDate}`);
      console.log(`   Amount: ${invoice.currency} ${invoice.amount}`);
      console.log('');

      uploaded++;
    } catch (error) {
      console.error(`❌ Error processing invoice ${invoiceNum}:`, error.message);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                  UPLOAD SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully uploaded: ${uploaded}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${missingInvoices.length}\n`);

  db.close();
}

uploadMissingInvoices().catch(console.error);
