const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 11);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// Initialize SQLite database
const db = new sqlite3.Database('./invoices.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    createTables();
  }
});

// Create tables
function createTables() {
  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('Error creating invoices table:', err);
    } else {
      console.log('Invoices table ready');
    }
  });

  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('Error creating expected_invoices table:', err);
    } else {
      console.log('Expected invoices table ready');
    }
  });
}

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
  if (lower.includes('managed services')) return 'MS';  // Check this before subscription
  if (lower.includes('maintenance') || lower.includes('support') || lower.includes('annual maintenance')) return 'Maint';
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
  
  // Strategy 1: Look in BILL TO section, skip ATTN lines
  const billToSection = text.match(/BILL\s*TO:?\s*([\s\S]{0,300}?)(?:SHIP\s*TO|Transaction|Currency|Week|$)/i);
  if (billToSection) {
    const lines = billToSection[1].split('\n').map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      if (!line.match(/^ATTN:/i) && !line.match(/^PO\s*BOX/i) && !line.match(/^\d+\s+\w+/i) && line.length > 3 && !line.match(/^[A-Z]{2}$/)) {
        invoice.client = line.replace(/[^\w\s&-]/g, '').substring(0, 100);
        clientFound = true;
        break;
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
  
  // Strategy 4: Extract from file name as last resort
  if (!clientFound && originalName) {
    const nameMatch = originalName.match(/([A-Za-z\s&]+)_/);
    if (nameMatch) {
      invoice.client = nameMatch[1].trim().replace(/[^\w\s&-]/g, '').substring(0, 100);
    }
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
  
  // Extract services (first 500 chars of description)
  const serviceMatch = text.match(/(?:Description|Services|Items)[:\s]*\n([\s\S]{0,500})/i);
  if (serviceMatch) {
    invoice.services = serviceMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    invoice.services = text.substring(0, 500).replace(/\s+/g, ' ');
  }
  
  // Classify and detect frequency
  invoice.invoiceType = classifyInvoiceType(invoice.services);
  invoice.frequency = detectFrequency(invoice.services, invoice.amountDue);
  
  return invoice;
}

// API Endpoints

// Get all invoices
app.get('/api/invoices', (req, res) => {
  db.all('SELECT * FROM invoices ORDER BY invoiceDate DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Upload PDFs
app.post('/api/upload-pdfs', upload.array('pdfs', 50), async (req, res) => {
  try {
    const files = req.files;
    const results = [];
    const duplicates = [];
    
    for (const file of files) {
      try {
        const invoiceData = await extractInvoiceData(file.path, file.originalname);
        
        // Check for duplicates
        const existing = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id, pdfPath FROM invoices WHERE LOWER(TRIM(invoiceNumber)) = LOWER(TRIM(?))',
            [invoiceData.invoiceNumber],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        
        if (existing) {
          duplicates.push({
            invoiceNumber: invoiceData.invoiceNumber,
            filename: file.originalname,
            existingId: existing.id,
            tempPath: file.path,
            newData: invoiceData
          });
          // Don't delete temp file yet - frontend may want to replace
          continue;
        }
        
        // Move PDF to permanent storage
        const pdfFilename = `${Date.now()}-${file.originalname}`;
        const pdfPath = path.join(pdfsDir, pdfFilename);
        fs.renameSync(file.path, pdfPath);
        
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
        
        const invoice = {
          id,
          ...invoiceData,
          status: 'Pending',
          uploadDate: new Date().toISOString().split('T')[0],
          pdfPath: `/pdfs/${pdfFilename}`,
          pdfOriginalName: file.originalname
        };
        
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO invoices (
              id, invoiceNumber, invoiceDate, client, customerContract, 
              oracleContract, poNumber, invoiceType, amountDue, currency, 
              dueDate, status, uploadDate, services, pdfPath, pdfOriginalName, frequency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoice.id, invoice.invoiceNumber, invoice.invoiceDate, invoice.client,
            invoice.customerContract, invoice.oracleContract, invoice.poNumber,
            invoice.invoiceType, invoice.amountDue, invoice.currency, invoice.dueDate,
            invoice.status, invoice.uploadDate, invoice.services, invoice.pdfPath,
            invoice.pdfOriginalName, invoice.frequency
          ], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        results.push(invoice);
        
        // Check if this matches an expected invoice
        await checkAndRemoveExpectedInvoice(invoice);
        
      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    
    // Generate expected invoices for new uploads
    if (results.length > 0) {
      await generateExpectedInvoices();
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

// Replace duplicate invoice
app.post('/api/replace-invoice/:id', upload.single('pdf'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    
    // Get existing invoice to delete old PDF
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT pdfPath FROM invoices WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    // Extract new invoice data
    const invoiceData = await extractInvoiceData(file.path, file.originalname);
    
    // Move new PDF to permanent storage
    const pdfFilename = `${Date.now()}-${file.originalname}`;
    const pdfPath = path.join(pdfsDir, pdfFilename);
    fs.renameSync(file.path, pdfPath);
    
    // Delete old PDF
    if (existing && existing.pdfPath) {
      const oldPdfPath = path.join(__dirname, existing.pdfPath);
      if (fs.existsSync(oldPdfPath)) {
        fs.unlinkSync(oldPdfPath);
      }
    }
    
    // Update invoice in database
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE invoices 
        SET invoiceDate = ?, client = ?, customerContract = ?, oracleContract = ?,
            poNumber = ?, invoiceType = ?, amountDue = ?, currency = ?, dueDate = ?,
            services = ?, pdfPath = ?, pdfOriginalName = ?, frequency = ?,
            uploadDate = ?
        WHERE id = ?
      `, [
        invoiceData.invoiceDate, invoiceData.client, invoiceData.customerContract,
        invoiceData.oracleContract, invoiceData.poNumber, invoiceData.invoiceType,
        invoiceData.amountDue, invoiceData.currency, invoiceData.dueDate,
        invoiceData.services, `/pdfs/${pdfFilename}`, file.originalname,
        invoiceData.frequency, new Date().toISOString().split('T')[0], id
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({ success: true, message: 'Invoice replaced successfully' });
    
  } catch (error) {
    console.error('Replace error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload payment spreadsheet
app.post('/api/upload-payments', upload.single('spreadsheet'), async (req, res) => {
  try {
    const file = req.file;
    const workbook = new ExcelJS.Workbook();
    
    // Read the file based on extension
    if (file.originalname.endsWith('.csv')) {
      await workbook.csv.readFile(file.path);
    } else {
      await workbook.xlsx.readFile(file.path);
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
    
    for (const update of updates) {
      const result = await new Promise((resolve, reject) => {
        db.run(`
          UPDATE invoices 
          SET status = 'Paid', paymentDate = ?
          WHERE LOWER(TRIM(invoiceNumber)) = LOWER(?)
        `, [update.paymentDate, update.invoiceNumber], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
      
      updatedCount += result;
    }
    
    fs.unlinkSync(file.path);
    
    res.json({ 
      success: true, 
      updatedCount 
    });
    
  } catch (error) {
    console.error('Payment upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update invoice
app.put('/api/invoices/:id', (req, res) => {
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
  
  db.run(
    `UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, changes: this.changes });
    }
  );
});

// Delete invoice
app.delete('/api/invoices/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT pdfPath FROM invoices WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row && row.pdfPath) {
      const pdfFullPath = path.join(__dirname, row.pdfPath);
      if (fs.existsSync(pdfFullPath)) {
        fs.unlinkSync(pdfFullPath);
      }
    }
    
    db.run('DELETE FROM invoices WHERE id = ?', [id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    });
  });
});

// Get expected invoices
app.get('/api/expected-invoices', (req, res) => {
  db.all('SELECT * FROM expected_invoices ORDER BY expectedDate ASC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Update expected invoice
app.put('/api/expected-invoices/:id', (req, res) => {
  const { id } = req.params;
  const { acknowledged } = req.body;
  
  const acknowledgedDate = acknowledged ? new Date().toISOString().split('T')[0] : null;
  
  db.run(
    'UPDATE expected_invoices SET acknowledged = ?, acknowledgedDate = ? WHERE id = ?',
    [acknowledged ? 1 : 0, acknowledgedDate, id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// Delete expected invoice
app.delete('/api/expected-invoices/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM expected_invoices WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// Generate expected invoices
async function generateExpectedInvoices() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        client, customerContract, invoiceType, amountDue, currency, 
        invoiceDate, invoiceNumber, frequency
      FROM invoices 
      WHERE frequency != 'adhoc'
      ORDER BY client, customerContract, invoiceDate DESC
    `, [], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
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
          const existing = await new Promise((resolve) => {
            db.get(
              'SELECT id FROM expected_invoices WHERE client = ? AND customerContract = ? AND expectedDate = ?',
              [invoice.client, invoice.customerContract || '', expectedDate],
              (err, row) => resolve(row)
            );
          });
          
          if (!existing) {
            const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
            const createdDate = new Date().toISOString().split('T')[0];
            
            await new Promise((resolve) => {
              db.run(`
                INSERT INTO expected_invoices (
                  id, client, customerContract, invoiceType, expectedAmount, 
                  currency, expectedDate, frequency, lastInvoiceNumber, lastInvoiceDate, 
                  createdDate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
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
              ], (err) => {
                if (err) {
                  console.error('Error inserting expected invoice:', err);
                }
                resolve();
              });
            });
          }
        }
      }
      
      resolve();
    });
  });
}

// Check and remove expected invoice when actual invoice received
async function checkAndRemoveExpectedInvoice(invoice) {
  if (invoice.frequency === 'adhoc') return;
  
  const clientMatch = invoice.client;
  const contractMatch = invoice.customerContract || '';
  
  db.run(`
    DELETE FROM expected_invoices 
    WHERE client = ? AND (customerContract = ? OR customerContract IS NULL)
  `, [clientMatch, contractMatch], (err) => {
    if (err) console.error('Error removing expected invoice:', err);
  });
}

// Clean up old acknowledged expected invoices (weekly)
function cleanupAcknowledgedInvoices() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const cutoffDate = oneWeekAgo.toISOString().split('T')[0];
  
  db.run(
    'DELETE FROM expected_invoices WHERE acknowledged = 1 AND acknowledgedDate < ?',
    [cutoffDate],
    (err) => {
      if (err) console.error('Cleanup error:', err);
      else console.log('Cleaned up old acknowledged invoices');
    }
  );
}

// Run cleanup weekly
setInterval(cleanupAcknowledgedInvoices, 7 * 24 * 60 * 60 * 1000);

// Get exchange rates
app.get('/api/exchange-rates', (req, res) => {
  res.json(exchangeRates);
});

// Natural language query
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    db.all('SELECT * FROM invoices', [], (err, invoices) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
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
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Invoice Tracker API running on http://localhost:${PORT}`);
});