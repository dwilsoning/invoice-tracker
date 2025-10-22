const express = require('express');
const cors = require('cors');
const { formidable } = require('formidable');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const axios = require('axios');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/pdfs', express.static(path.join(__dirname, 'invoice_pdfs')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const pdfsDir = path.join(__dirname, 'invoice_pdfs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir);

// Initialize SQLite database
const db = new Database('./invoices.db');
console.log('Connected to SQLite database');

// Create tables
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT NOT NULL,
      invoiceDate TEXT,
      client TEXT NOT NULL,
      customerContract TEXT,
      oracleContract TEXT,
      poNumber TEXT,
      invoiceType TEXT,
      amountDue REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      dueDate TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      paymentDate TEXT,
      frequency TEXT DEFAULT 'adhoc',
      uploadDate TEXT,
      services TEXT,
      pdfPath TEXT,
      pdfOriginalName TEXT,
      contractValue REAL,
      contractCurrency TEXT DEFAULT 'USD',
      notes TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS expected_invoices (
      id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      customerContract TEXT,
      invoiceType TEXT,
      expectedAmount REAL,
      currency TEXT DEFAULT 'USD',
      expectedDate TEXT NOT NULL,
      frequency TEXT NOT NULL,
      lastInvoiceNumber TEXT,
      lastInvoiceDate TEXT,
      acknowledged INTEGER DEFAULT 0,
      acknowledgedDate TEXT,
      createdDate TEXT
    )
  `);

  console.log('Database tables ready');
}

createTables();

// Exchange rate cache
let exchangeRates = {
  USD: 1,
  AUD: 0.65,
  EUR: 1.08,
  GBP: 1.27,
  SGD: 0.74
};

// Fetch exchange rates
async function fetchExchangeRates() {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    if (response.data && response.data.rates) {
      exchangeRates.USD = 1;
      exchangeRates.AUD = 1 / response.data.rates.AUD;
      exchangeRates.EUR = 1 / response.data.rates.EUR;
      exchangeRates.GBP = 1 / response.data.rates.GBP;
      exchangeRates.SGD = 1 / response.data.rates.SGD;
      console.log('Exchange rates updated:', exchangeRates);
    }
  } catch (error) {
    console.error('Error fetching exchange rates, using cached rates:', error.message);
  }
}

// Fetch rates on startup and every 6 hours
fetchExchangeRates();
setInterval(fetchExchangeRates, 6 * 60 * 60 * 1000);

// Convert to USD
function convertToUSD(amount, currency) {
  const rate = exchangeRates[currency] || 1;
  return Math.round(amount * rate);
}

// Parse date based on currency
function parseDate(dateStr, currency) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();
  const parts = cleaned.split(/[-\/]/);

  if (parts.length !== 3) return null;

  let day, month, year;

  if (currency === 'USD') {
    // MM-DD-YYYY for USD
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    // DD-MM-YYYY for non-USD
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  }

  if (year < 100) year += 2000;

  // Validate date components
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);

  // Check if date is valid
  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
}

// Format date for display (DD-MMM-YYYY)
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Classify invoice type
function classifyInvoiceType(services) {
  if (!services) return 'PS';

  const lower = services.toLowerCase();

  // Check in order of specificity
  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  // Check for Managed Services - handle various formats (check this FIRST before subscription)
  // Pattern: "subscription" + "managed" = MS, not Sub
  if (lower.includes('managed services') ||
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  // Maintenance and Support - but NOT if it's managed services
  if ((lower.includes('maintenance') || lower.includes('support') || lower.includes('annual maintenance')) &&
      !lower.includes('managed')) {
    return 'Maint';
  }

  // Subscription - only if NOT managed services
  if (lower.includes('subscription') || lower.includes('license') || lower.includes('saas')) return 'Sub';
  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';
  if (lower.includes('consulting') || lower.includes('professional services') || lower.includes('penetration testing')) return 'PS';

  return 'PS';
}

// Detect frequency
function detectFrequency(services, amount) {
  if (!services) return 'adhoc';

  const lower = services.toLowerCase();

  if (lower.includes('monthly')) return 'monthly';
  if (lower.includes('quarterly') || lower.includes('quarter')) return 'quarterly';
  if (lower.includes('bi-annual') || lower.includes('semi-annual') || lower.includes('6 month')) return 'bi-annual';
  if (lower.includes('tri-annual') || lower.includes('4 month')) return 'tri-annual';
  if (lower.includes('annual') || lower.includes('yearly')) return 'annual';

  return 'adhoc';
}

// Extract invoice data from PDF
async function extractInvoiceData(pdfPath, originalName) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  const invoice = {
    invoiceNumber: '',
    client: '',
    invoiceDate: '',
    dueDate: '',
    amountDue: 0,
    currency: 'USD',
    services: '',
    customerContract: '',
    oracleContract: '',
    poNumber: '',
    invoiceType: 'PS',
    frequency: 'adhoc'
  };

  // Extract invoice number
  const invNumMatch = text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([A-Z0-9-]+)/i) ||
                      text.match(/Tax\s*Invoice\s*[:\s]*([A-Z0-9-]+)/i) ||
                      text.match(/Invoice\s+([A-Z0-9-]+)/i);
  if (invNumMatch) invoice.invoiceNumber = invNumMatch[1].trim();

  // Extract client - multiple strategies with fallbacks
  let clientFound = false;

  // Strategy 1: Look in BILL TO section, skip ATTN lines and unwanted content
  const billToSection = text.match(/BILL\s*TO:?\s*([\s\S]{0,400}?)(?:Transaction\s+Type|Description|Week\s+Ending|Special\s+Instructions|$)/i);
  if (billToSection) {
    const lines = billToSection[1].split('\n').map(l => l.trim()).filter(l => l);

    // First, specifically look for "Minister for Health" pattern (most reliable)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/Minister\s+for\s+Health/i)) {
        let cleanClient = line.replace(/^Minister\s+for\s+Health\s+aka\s+/i, '').trim();

        // Check if next line might be part of client name (like "Health" on separate line)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.match(/^Health$/i) || nextLine.match(/^(Pty|Ltd|Limited|Inc|Corporation)\.?$/i)) {
            cleanClient = cleanClient + ' ' + nextLine;
          }
        }

        if (cleanClient.length > 3) {
          invoice.client = cleanClient.substring(0, 100);
          clientFound = true;
          break;
        }
      }
    }

    // If no "Minister for Health" found, try general extraction
    if (!clientFound) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip unwanted lines
        if (line.match(/^ATTN:/i)) continue; // Skip ATTN lines but don't skip next line automatically
        if (line.match(/^PO\s*BOX/i)) continue;
        if (line.match(/^c\/o\s+/i)) continue; // Skip "c/o" lines
        if (line.match(/^[A-Z]{2}$/)) continue; // Country code like "AU"
        if (line.match(/^SHIP\s*TO/i)) continue;
        if (line.match(/^\d{4,}$/)) continue; // Postal code only
        if (line.match(/^[A-Za-z]+\s+\d{4}$/)) continue; // City + postal code like "Adelaide 5001"
        if (line.match(/^GPO\s+Box/i)) continue; // GPO Box lines

        // Skip department/division names (but not company names)
        if (line.match(/^(Application|Digital|Shared)\s+(Services|Health)/i)) continue;
        if (line.match(/^(DHW-|Accounts\s+Payable$)/i)) continue; // Department codes and generic dept names

        // Skip address lines (contain street indicators)
        if (line.match(/(Dr|St|Ave|Road|Street|Boulevard|Drive|Avenue)\s+(corner|and|\d)/i)) continue;
        if (line.match(/^\d+\s+[A-Z]/)) continue; // Lines starting with numbers (street numbers)
        if (line.match(/^(Bonifacio|Taguig|Adelaide|Sydney|Melbourne|Brisbane)/i)) continue; // City names

        // Look for substantial client names (company names typically have these indicators)
        if (line.length > 5 && !line.match(/^\d/)) {
          // Prioritize lines with company indicators
          const hasCompanyIndicator = line.match(/(Medical|Center|Hospital|Health|Inc|Ltd|Pty|Limited|Corporation|University|College|Clinic)/i);

          let cleanClient = line.trim();

          // Check if next line might be part of client name (like "Health" on separate line)
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine.match(/^Health$/i) || nextLine.match(/^(Pty|Ltd|Limited|Inc|Corporation)\.?$/i)) {
              cleanClient = cleanClient + ' ' + nextLine;
            }
          }

          if (cleanClient.length > 3) {
            invoice.client = cleanClient.substring(0, 100);
            clientFound = true;
            break;
          }
        }
      }
    }
  }

  // Strategy 2: Look for "Customer:" or "Client:" labels
  if (!clientFound) {
    const clientMatch = text.match(/(?:Customer|Client|Company)[:\s]+([^\n]+)/i);
    if (clientMatch) {
      const clientText = clientMatch[1].trim();
      if (clientText.length > 3 && !clientText.match(/^Number|^#/i)) {
        invoice.client = clientText.replace(/[^\w\s&-]/g, '').substring(0, 100);
        clientFound = true;
      }
    }
  }

  // Strategy 3: Use first substantial line after "BILL TO" or "TO:"
  if (!clientFound) {
    const toMatch = text.match(/(?:^|\n)TO:\s*\n([^\n]+)/i);
    if (toMatch) {
      invoice.client = toMatch[1].trim().replace(/[^\w\s&-]/g, '').substring(0, 100);
      clientFound = true;
    }
  }

  // Strategy 4: Extract from file name as last resort (only if truly not found)
  if (!clientFound && originalName) {
    // Avoid extracting short codes like "MDRX" - look for more substantial names
    const nameMatch = originalName.match(/([A-Za-z\s&]{6,})_/);
    if (nameMatch) {
      invoice.client = nameMatch[1].trim().substring(0, 100);
    } else {
      // If still no client found, use placeholder
      invoice.client = 'Unknown Client';
    }
  }

  // If still no client, use placeholder
  if (!invoice.client || invoice.client.length < 3) {
    invoice.client = 'Unknown Client';
  }

  // Extract currency
  const currencyMatch = text.match(/\b(USD|AUD|EUR|GBP|SGD)\b/i);
  if (currencyMatch) {
    invoice.currency = currencyMatch[1].toUpperCase();
  } else if (text.includes('$') && text.includes('AUD')) {
    invoice.currency = 'AUD';
  } else if (text.includes('€')) {
    invoice.currency = 'EUR';
  } else if (text.includes('£')) {
    invoice.currency = 'GBP';
  }

  // Extract dates
  const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  const dates = [...text.matchAll(dateRegex)].map(m => m[0]);
  if (dates.length > 0) {
    invoice.invoiceDate = parseDate(dates[0], invoice.currency);
    invoice.dueDate = parseDate(dates[dates.length > 1 ? 1 : 0], invoice.currency);
  }

  // Fallback to today if dates are invalid
  if (!invoice.invoiceDate) {
    invoice.invoiceDate = new Date().toISOString().split('T')[0];
  }
  if (!invoice.dueDate) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    invoice.dueDate = futureDate.toISOString().split('T')[0];
  }

  // Extract amount
  const amountMatch = text.match(/(?:Total|Amount\s*Due|Balance\s*Due)[:\s]*\$?\s*([\d,]+\.?\d*)/i) ||
                      text.match(/\$\s*([\d,]+\.?\d*)/);
  if (amountMatch) {
    invoice.amountDue = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract contract numbers - improved patterns
  const contractMatch = text.match(/(?:Customer\s*Contract|Contract)\s*#?[:\s]*([A-Z0-9-]+)/i);
  if (contractMatch) {
    invoice.customerContract = contractMatch[1].trim();
  }

  const poMatch = text.match(/PO\s*Number[:\s]*([A-Z0-9-]+)/i) ||
                  text.match(/(?:^|\s)PO[:\s#]*([A-Z0-9-]+)/im);
  if (poMatch) {
    invoice.poNumber = poMatch[1].trim();
  }

  // Extract services - try multiple strategies
  let services = '';

  // Strategy 1: Look for "Description" section in table, skip header row - increased capture limit
  const descMatch = text.match(/Description[\s\S]{0,150}?Week\s+Ending\s+Date[\s\S]{0,150}?Qty[\s\S]{0,150}?UOM[\s\S]{0,150}?Unit\s+Price[\s\S]{0,150}?Taxable[\s\S]{0,150}?Extended\s+Price([\s\S]{0,1500}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
  if (descMatch) {
    services = descMatch[1].trim();
  }

  // Strategy 2: Look for "Description:" or "Services:" label
  if (!services) {
    const serviceMatch = text.match(/(?:Description|Services|Items)[:\s]*\n([\s\S]{0,800}?)(?:Item\s+Subtotal|Special\s+Instructions|Transaction\s+Type|Page\s+\d+)/i);
    if (serviceMatch) {
      services = serviceMatch[1].trim();
    }
  }

  // Strategy 3: Find content between "Transaction Type" and "Item Subtotal"
  if (!services) {
    const betweenMatch = text.match(/Transaction\s+Type[\s\S]{0,300}?Currency[\s\S]{0,200}?([\s\S]{0,1000}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
    if (betweenMatch) {
      services = betweenMatch[1].trim();
    }
  }

  // Clean up and filter
  if (services) {
    // Remove table header remnants that might have been captured
    services = services.replace(/^(Taxable\s*Extended\s*Price\s*|Week\s+Ending\s+Date\s*Qty\s*UOM\s*Unit\s*Price\s*)/i, '');

    // Remove line items with just "Yes" and dollar amounts
    services = services.replace(/\s+Yes\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+/g, '');

    // Remove isolated "Yes" entries
    services = services.replace(/\s+Yes\s+/g, ' ');

    // Remove invoice number references that got captured
    services = services.replace(/Invoice\s+Number:\s*[\d]+\s+Invoice\s+Date:\s*[\d\-]+/gi, '');

    // Remove extra whitespace
    services = services.replace(/\s+/g, ' ').trim();

    // Check if this looks PRIMARILY like address information (not just mentions it)
    // Only reject if address patterns are in the first 200 chars and no service keywords present
    const firstPart = services.substring(0, 200);
    const hasAddressInStart = firstPart.match(/(BILL\s+TO|SHIP\s+TO|ATTN:|GPO\s+Box|c\/o\s+Shared\s+Services)/i);
    const hasServiceKeywords = services.match(/(Professional\s+Services|Subscription|Maintenance|Support|License|Training|Implementation|Integration|Annual|Monthly)/i);

    if (hasAddressInStart && !hasServiceKeywords) {
      // This looks like address info, not a service description
      services = '';
    } else {
      // Take first 500 chars
      invoice.services = services.substring(0, 500);
    }
  }

  // If still no services found, set a default message
  if (!services || services.length === 0) {
    invoice.services = 'No service description found';
  }

  // Classify and detect frequency
  invoice.invoiceType = classifyInvoiceType(invoice.services);
  invoice.frequency = detectFrequency(invoice.services, invoice.amountDue);

  return invoice;
}

// API Endpoints

// Get all invoices
app.get('/api/invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invoices ORDER BY invoiceDate DESC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload PDFs
app.post('/api/upload-pdfs', async (req, res) => {
  const form = formidable({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    multiples: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: err.message });
    }

    try {
      console.log('Received files:', Object.keys(files));
      console.log('Files object:', files);

      const results = [];
      const duplicates = [];

      // formidable v3 returns files as an object with arrays
      // Try different possible field names
      let pdfFiles = files.pdfs || files.pdf || files.file || [];

      // If files is an object, get all file arrays
      if (!Array.isArray(pdfFiles) && typeof files === 'object') {
        pdfFiles = Object.values(files).flat();
      }

      const fileArray = Array.isArray(pdfFiles) ? pdfFiles : [pdfFiles].filter(Boolean);

      for (const file of fileArray) {
        try {
          const invoiceData = await extractInvoiceData(file.filepath, file.originalFilename);

          // Check for duplicates
          const existing = db.prepare(
            'SELECT id, pdfPath FROM invoices WHERE LOWER(TRIM(invoiceNumber)) = LOWER(TRIM(?))'
          ).get(invoiceData.invoiceNumber);

          if (existing) {
            duplicates.push({
              invoiceNumber: invoiceData.invoiceNumber,
              filename: file.originalFilename,
              existingId: existing.id,
              tempPath: file.filepath,
              newData: invoiceData
            });
            continue;
          }

          // Move PDF to permanent storage
          const pdfFilename = `${Date.now()}-${file.originalFilename}`;
          const pdfPath = path.join(pdfsDir, pdfFilename);
          fs.renameSync(file.filepath, pdfPath);

          const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);

          const invoice = {
            id,
            ...invoiceData,
            status: 'Pending',
            uploadDate: new Date().toISOString().split('T')[0],
            pdfPath: `/pdfs/${pdfFilename}`,
            pdfOriginalName: file.originalFilename
          };

          db.prepare(`
            INSERT INTO invoices (
              id, invoiceNumber, invoiceDate, client, customerContract,
              oracleContract, poNumber, invoiceType, amountDue, currency,
              dueDate, status, uploadDate, services, pdfPath, pdfOriginalName, frequency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            invoice.id, invoice.invoiceNumber, invoice.invoiceDate, invoice.client,
            invoice.customerContract, invoice.oracleContract, invoice.poNumber,
            invoice.invoiceType, invoice.amountDue, invoice.currency, invoice.dueDate,
            invoice.status, invoice.uploadDate, invoice.services, invoice.pdfPath,
            invoice.pdfOriginalName, invoice.frequency
          );

          results.push(invoice);

          // Check if this matches an expected invoice
          checkAndRemoveExpectedInvoice(invoice);

        } catch (error) {
          console.error(`Error processing ${file.originalFilename}:`, error);
          if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
        }
      }

      // Generate expected invoices for new uploads
      if (results.length > 0) {
        generateExpectedInvoices();
      }

      res.json({
        success: true,
        invoices: results,
        duplicates: duplicates
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Replace duplicate invoice
app.post('/api/replace-invoice/:id', async (req, res) => {
  const form = formidable({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Replace error:', err);
      return res.status(500).json({ error: err.message });
    }

    try {
      const { id } = req.params;
      const file = files.pdf ? (Array.isArray(files.pdf) ? files.pdf[0] : files.pdf) : null;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get existing invoice to delete old PDF
      const existing = db.prepare('SELECT pdfPath FROM invoices WHERE id = ?').get(id);

      // Extract new invoice data
      const invoiceData = await extractInvoiceData(file.filepath, file.originalFilename);

      // Move new PDF to permanent storage
      const pdfFilename = `${Date.now()}-${file.originalFilename}`;
      const pdfPath = path.join(pdfsDir, pdfFilename);
      fs.renameSync(file.filepath, pdfPath);

      // Delete old PDF
      if (existing && existing.pdfPath) {
        const oldPdfPath = path.join(__dirname, existing.pdfPath);
        if (fs.existsSync(oldPdfPath)) {
          fs.unlinkSync(oldPdfPath);
        }
      }

      // Update invoice in database
      db.prepare(`
        UPDATE invoices
        SET invoiceDate = ?, client = ?, customerContract = ?, oracleContract = ?,
            poNumber = ?, invoiceType = ?, amountDue = ?, currency = ?, dueDate = ?,
            services = ?, pdfPath = ?, pdfOriginalName = ?, frequency = ?,
            uploadDate = ?
        WHERE id = ?
      `).run(
        invoiceData.invoiceDate, invoiceData.client, invoiceData.customerContract,
        invoiceData.oracleContract, invoiceData.poNumber, invoiceData.invoiceType,
        invoiceData.amountDue, invoiceData.currency, invoiceData.dueDate,
        invoiceData.services, `/pdfs/${pdfFilename}`, file.originalFilename,
        invoiceData.frequency, new Date().toISOString().split('T')[0], id
      );

      res.json({ success: true, message: 'Invoice replaced successfully' });

    } catch (error) {
      console.error('Replace error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Upload payment spreadsheet
app.post('/api/upload-payments', async (req, res) => {
  const form = formidable({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Payment upload error:', err);
      return res.status(500).json({ error: err.message });
    }

    try {
      const file = files.spreadsheet ? (Array.isArray(files.spreadsheet) ? files.spreadsheet[0] : files.spreadsheet) : null;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const workbook = new ExcelJS.Workbook();

      // Read the file based on extension
      if (file.originalFilename.endsWith('.csv')) {
        await workbook.csv.readFile(file.filepath);
      } else {
        await workbook.xlsx.readFile(file.filepath);
      }

      const worksheet = workbook.worksheets[0];
      const updates = [];

      worksheet.eachRow((row, rowNumber) => {
        const invoiceNumber = row.getCell(1).value;
        const paymentDate = row.getCell(2).value;

        if (!invoiceNumber) return;

        const invoiceStr = String(invoiceNumber).trim();
        const paymentDateStr = paymentDate ?
          (paymentDate instanceof Date ? paymentDate.toISOString().split('T')[0] : String(paymentDate)) :
          new Date().toISOString().split('T')[0];

        updates.push({ invoiceNumber: invoiceStr, paymentDate: paymentDateStr });
      });

      let updatedCount = 0;

      const updateStmt = db.prepare(`
        UPDATE invoices
        SET status = 'Paid', paymentDate = ?
        WHERE LOWER(TRIM(invoiceNumber)) = LOWER(?)
      `);

      for (const update of updates) {
        const result = updateStmt.run(update.paymentDate, update.invoiceNumber);
        updatedCount += result.changes;
      }

      fs.unlinkSync(file.filepath);

      res.json({
        success: true,
        updatedCount
      });

    } catch (error) {
      console.error('Payment upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Update invoice
app.put('/api/invoices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    values.push(id);

    const result = db.prepare(
      `UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`
    ).run(...values);

    res.json({ success: true, changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', (req, res) => {
  try {
    const { id } = req.params;

    const row = db.prepare('SELECT pdfPath FROM invoices WHERE id = ?').get(id);

    if (row && row.pdfPath) {
      const pdfFullPath = path.join(__dirname, row.pdfPath);
      if (fs.existsSync(pdfFullPath)) {
        fs.unlinkSync(pdfFullPath);
      }
    }

    db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete ALL invoices (DEVELOPMENT ONLY)
app.delete('/api/invoices', (req, res) => {
  try {
    console.log('⚠️  DELETE ALL INVOICES REQUESTED');

    // Get all invoice PDFs
    const invoices = db.prepare('SELECT pdfPath FROM invoices').all();

    // Delete all PDF files
    let deletedFiles = 0;
    for (const invoice of invoices) {
      if (invoice.pdfPath) {
        const pdfFullPath = path.join(__dirname, invoice.pdfPath);
        if (fs.existsSync(pdfFullPath)) {
          fs.unlinkSync(pdfFullPath);
          deletedFiles++;
        }
      }
    }

    // Delete all invoices from database
    const result = db.prepare('DELETE FROM invoices').run();

    // Delete all expected invoices
    db.prepare('DELETE FROM expected_invoices').run();

    console.log(`✅ Deleted ${result.changes} invoices and ${deletedFiles} PDF files`);

    res.json({
      success: true,
      deletedInvoices: result.changes,
      deletedFiles: deletedFiles
    });
  } catch (error) {
    console.error('Error deleting all invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get expected invoices
app.get('/api/expected-invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM expected_invoices ORDER BY expectedDate ASC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expected invoice
app.put('/api/expected-invoices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged } = req.body;

    const acknowledgedDate = acknowledged ? new Date().toISOString().split('T')[0] : null;

    db.prepare(
      'UPDATE expected_invoices SET acknowledged = ?, acknowledgedDate = ? WHERE id = ?'
    ).run(acknowledged ? 1 : 0, acknowledgedDate, id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expected invoice
app.delete('/api/expected-invoices/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM expected_invoices WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate expected invoices
function generateExpectedInvoices() {
  try {
    const rows = db.prepare(`
      SELECT
        client, customerContract, invoiceType, amountDue, currency,
        invoiceDate, invoiceNumber, frequency
      FROM invoices
      WHERE frequency != 'adhoc'
      ORDER BY client, customerContract, invoiceDate DESC
    `).all();

    const grouped = {};

    for (const row of rows) {
      const key = `${row.client}-${row.customerContract || 'none'}-${row.frequency}`;
      if (!grouped[key]) {
        grouped[key] = row;
      }
    }

    for (const key in grouped) {
      const invoice = grouped[key];

      // Validate invoice date
      const lastDate = new Date(invoice.invoiceDate);
      if (isNaN(lastDate.getTime())) {
        console.log(`Invalid date for invoice ${invoice.invoiceNumber}, skipping expected invoice generation`);
        continue;
      }

      let nextDate = new Date(lastDate);

      switch (invoice.frequency) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'bi-annual':
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'tri-annual':
          nextDate.setMonth(nextDate.getMonth() + 4);
          break;
        case 'annual':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Validate next date
      if (isNaN(nextDate.getTime())) {
        console.log(`Invalid next date calculation for ${invoice.invoiceNumber}, skipping`);
        continue;
      }

      const expectedDate = nextDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      if (expectedDate <= today) {
        const existing = db.prepare(
          'SELECT id FROM expected_invoices WHERE client = ? AND customerContract = ? AND expectedDate = ?'
        ).get(invoice.client, invoice.customerContract || '', expectedDate);

        if (!existing) {
          const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
          const createdDate = new Date().toISOString().split('T')[0];

          db.prepare(`
            INSERT INTO expected_invoices (
              id, client, customerContract, invoiceType, expectedAmount,
              currency, expectedDate, frequency, lastInvoiceNumber, lastInvoiceDate,
              createdDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            invoice.client,
            invoice.customerContract || '',
            invoice.invoiceType,
            invoice.amountDue,
            invoice.currency,
            expectedDate,
            invoice.frequency,
            invoice.invoiceNumber,
            invoice.invoiceDate,
            createdDate
          );
        }
      }
    }
  } catch (error) {
    console.error('Error generating expected invoices:', error);
  }
}

// Check and remove expected invoice when actual invoice received
function checkAndRemoveExpectedInvoice(invoice) {
  if (invoice.frequency === 'adhoc') return;

  try {
    const clientMatch = invoice.client;
    const contractMatch = invoice.customerContract || '';

    db.prepare(`
      DELETE FROM expected_invoices
      WHERE client = ? AND (customerContract = ? OR customerContract IS NULL)
    `).run(clientMatch, contractMatch);
  } catch (error) {
    console.error('Error removing expected invoice:', error);
  }
}

// Clean up old acknowledged expected invoices (weekly)
function cleanupAcknowledgedInvoices() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const cutoffDate = oneWeekAgo.toISOString().split('T')[0];

    db.prepare(
      'DELETE FROM expected_invoices WHERE acknowledged = 1 AND acknowledgedDate < ?'
    ).run(cutoffDate);

    console.log('Cleaned up old acknowledged invoices');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run cleanup weekly
setInterval(cleanupAcknowledgedInvoices, 7 * 24 * 60 * 60 * 1000);

// Get exchange rates
app.get('/api/exchange-rates', (req, res) => {
  res.json(exchangeRates);
});

// Natural language query
app.post('/api/query', (req, res) => {
  try {
    const { query } = req.body;

    const invoices = db.prepare('SELECT * FROM invoices').all();

    const queryLower = query.toLowerCase();
    let results = [...invoices];

    // Filter by type
    const types = ['ps', 'maint', 'sub', 'hosting', 'ms', 'hw', '3pp', 'credit memo'];
    types.forEach(type => {
      if (queryLower.includes(type)) {
        results = results.filter(inv => inv.invoiceType && inv.invoiceType.toLowerCase() === type);
      }
    });

    // Filter by client
    const clientMatch = queryLower.match(/(?:for|from|by)\s+([a-z\s&]+?)(?:\s|$)/i);
    if (clientMatch) {
      const clientName = clientMatch[1].trim();
      results = results.filter(inv =>
        inv.client && inv.client.toLowerCase().includes(clientName)
      );
    }

    // Filter by status
    if (queryLower.includes('paid')) {
      results = results.filter(inv => inv.status === 'Paid');
    } else if (queryLower.includes('unpaid') || queryLower.includes('pending')) {
      results = results.filter(inv => inv.status === 'Pending');
    } else if (queryLower.includes('overdue')) {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter(inv => inv.status === 'Pending' && inv.dueDate < today);
    }

    // Calculate totals if requested
    if (queryLower.includes('total') || queryLower.includes('sum') || queryLower.includes('how much')) {
      const total = results.reduce((sum, inv) => {
        return sum + convertToUSD(inv.amountDue, inv.currency);
      }, 0);

      res.json({
        type: 'total',
        value: total,
        count: results.length,
        invoices: results
      });
    } else {
      res.json({
        type: 'list',
        invoices: results,
        count: results.length
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Invoice Tracker API running on http://localhost:${PORT}`);
});
