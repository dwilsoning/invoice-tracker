const express = require('express');
const cors = require('cors');
const { formidable } = require('formidable');
const { db, pool } = require('./db-postgres');
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
const deletedPdfsDir = path.join(__dirname, 'invoice_pdfs', 'deleted');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir);
if (!fs.existsSync(deletedPdfsDir)) fs.mkdirSync(deletedPdfsDir);

// Using PostgreSQL database from db-postgres.js

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

// Determine date format based on invoice number pattern
function getDateFormatByInvoiceNumber(invoice_number) {
  if (!invoice_number) return 'international'; // Default to international

  const invoiceStr = invoice_number.toString();

  // US format invoice series (MM-DD-YYYY)
  const usFormatPrefixes = ['46', '47', '48', '49'];

  // International format invoice series (DD-MM-YYYY)
  const intlFormatPrefixes = ['40', '41', '42', '43', '44', '45', '60', '61', '11', '12', '86'];

  // Check if invoice starts with any US format prefix
  for (const prefix of usFormatPrefixes) {
    if (invoiceStr.startsWith(prefix)) {
      return 'us';
    }
  }

  // Check if invoice starts with any international format prefix
  for (const prefix of intlFormatPrefixes) {
    if (invoiceStr.startsWith(prefix)) {
      return 'international';
    }
  }

  // Default to international for unknown patterns
  return 'international';
}

// Parse date - handles multiple formats based on invoice number
function parseDate(dateStr, currency, invoice_number) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Month name mapping
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

  // Try to match DD-MMM-YYYY or DD-MMMM-YYYY format (e.g., 12-MAR-2025, 11-APR-2025)
  const namedMonthMatch = cleaned.match(/(\d{1,2})[-\/\s]([a-z]+)[-\/\s](\d{2,4})/i);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1]);
    const monthStr = namedMonthMatch[2].toLowerCase();
    let year = parseInt(namedMonthMatch[3]);

    const month = monthMap[monthStr];

    if (month) {
      if (year < 100) year += 2000;

      // Create date using UTC to avoid timezone issues
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  // Handle numeric formats (MM-DD-YYYY or DD-MM-YYYY)
  const parts = cleaned.split(/[-\/]/);

  if (parts.length !== 3) return null;

  let day, month, year;

  // Try to determine format intelligently
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  const third = parseInt(parts[2]);

  if (isNaN(first) || isNaN(second) || isNaN(third)) return null;

  year = third;
  if (year < 100) year += 2000;

  // If first number > 12, it must be DD-MM-YYYY
  if (first > 12) {
    day = first;
    month = second;
  }
  // If second number > 12, it must be MM-DD-YYYY
  else if (second > 12) {
    month = first;
    day = second;
  }
  // Otherwise, use invoice number pattern to determine format
  else {
    const dateFormat = getDateFormatByInvoiceNumber(invoice_number);

    if (dateFormat === 'us') {
      // US format: MM-DD-YYYY
      month = first;
      day = second;
    } else {
      // International format: DD-MM-YYYY
      day = first;
      month = second;
    }
  }

  // Validate date components
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Create date using UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day));

  // Check if date is valid
  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
}

// Format date for display (DD-MMM-YY)
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';

  // Parse date string directly to avoid timezone issues
  // Expected format: YYYY-MM-DD
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return '';

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // 0-indexed
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = String(day).padStart(2, '0');
  const monthStr = months[month];
  const yearStr = String(year).slice(-2); // 2-digit year
  return `${dayStr}-${monthStr}-${yearStr}`;
}

// Classify invoice type
function classifyInvoiceType(services, invoice_number, amount) {
  // Check if amount is negative - credit memos have negative amounts
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

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

  // Professional Services - check BEFORE maintenance/support to avoid false positives
  if (lower.includes('consulting') ||
      lower.includes('professional services') ||
      lower.includes('professional service fee') ||
      lower.includes('professionalservicesfee') ||
      lower.includes('penetration testing')) return 'PS';

  // Maintenance and Support - check BEFORE subscriptions to avoid misclassification
  // More specific checks to avoid catching "support" in other contexts
  if ((lower.includes('maintenance') ||
       lower.includes('annual maintenance') ||
       lower.includes('software support') ||
       lower.includes('support services') ||
       lower.includes('support fee') ||
       lower.includes('license maintenance')) &&
      !lower.includes('managed') &&
      !lower.includes('professional')) {
    return 'Maint';
  }

  // Software licenses (ad-hoc) - check BEFORE subscription
  // If it has "license/licence" with software-related terms but NO subscription indicators, it's SW
  if ((lower.includes('license') || lower.includes('licence')) &&
      !lower.includes('subscription') &&
      !lower.includes('annual') &&
      !lower.includes('yearly') &&
      !lower.includes('recurring')) {
    // Ad-hoc licenses are typically software purchases
    if (lower.includes('software') ||
        lower.includes('connectivity') ||
        lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time')) {
      return 'SW';
    }
    // Default ad-hoc licenses to SW unless proven otherwise
    return 'SW';
  }

  // Subscription - only if NOT managed services or maintenance
  // Now only catches explicit subscriptions with recurring patterns
  if (lower.includes('subscription') ||
      (lower.includes('license') && (lower.includes('annual') || lower.includes('yearly'))) ||
      lower.includes('saas')) return 'Sub';

  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application') || lower.includes('program')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

// Detect frequency
function detectFrequency(services, amount) {
  if (!services) return 'adhoc';

  const lower = services.toLowerCase();

  // Check for monthly patterns
  if (lower.includes('monthly')) return 'monthly';

  // Check for quarterly patterns - enhanced to catch more variations
  if (lower.includes('quarterly') ||
      lower.includes('quarter') ||
      lower.includes('3 month') ||
      lower.includes('three month') ||
      lower.match(/\bq[1-4]\b/i) || // Q1, Q2, Q3, Q4
      lower.match(/\b(jan|apr|jul|oct)[\s-]+(apr|jul|oct|jan)\b/i) || // Quarterly month pairs
      lower.includes('every 3 months')) {
    return 'quarterly';
  }

  // Check for bi-annual patterns
  if (lower.includes('bi-annual') ||
      lower.includes('semi-annual') ||
      lower.includes('6 month') ||
      lower.includes('six month') ||
      lower.includes('every 6 months')) {
    return 'bi-annual';
  }

  // Check for tri-annual patterns
  if (lower.includes('tri-annual') ||
      lower.includes('4 month') ||
      lower.includes('four month') ||
      lower.includes('every 4 months')) {
    return 'tri-annual';
  }

  // Check for annual patterns - but NOT if it contains "bi-annual" or "semi-annual"
  if ((lower.includes('annual') || lower.includes('yearly')) &&
      !lower.includes('bi-annual') &&
      !lower.includes('semi-annual') &&
      !lower.includes('tri-annual')) {
    return 'annual';
  }

  return 'adhoc';
}

// Extract invoice data from PDF
async function extractInvoiceData(pdf_path, originalName) {
  const dataBuffer = fs.readFileSync(pdf_path);
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

  // Extract invoice number - prioritize numeric patterns and avoid "Total"
  const invNumMatch =
                      text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
                      text.match(/Tax\s*Invoice\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
                      text.match(/Credit\s*Memo\s*[:\s#]*([0-9][A-Z0-9-]+)/i) ||
                      text.match(/Invoice\s+([0-9][A-Z0-9-]+)/i);
  if (invNumMatch) {
    const invoiceNum = invNumMatch[1].trim();
    // Exclude common words like "Total"
    if (invoiceNum !== 'Total' && invoiceNum.match(/\d/)) {
      invoice.invoiceNumber = invoiceNum;
    }
  }

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
        if (line.match(/^Ship\s*To$/i)) continue; // Skip "Ship To" exactly
        if (line.match(/^Remittance$/i)) continue; // Skip "Remittance"
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
      const potentialClient = toMatch[1].trim();
      // Skip if it's just another header like "SHIP TO:", "BILL TO:", etc.
      if (!potentialClient.match(/^(SHIP|BILL|SOLD|SEND)\s+TO:?$/i)) {
        invoice.client = potentialClient.replace(/[^\w\s&-]/g, '').substring(0, 100);
        clientFound = true;
      }
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

  // If still no client, use placeholder and log warning
  if (!invoice.client || invoice.client.length < 3) {
    console.warn(`⚠️  WARNING: Could not extract client name for invoice ${invoice.invoiceNumber}. Using 'Unknown Client' as fallback.`);
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

  // Extract dates - look specifically for Invoice Date and Due Date labels
  // This is more accurate than just taking first/last dates which can pick up service period dates

  // Try to find Invoice Date with label - multiple patterns
  let invoiceDateStr = null;
  const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                       text.match(/DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
                       text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
  if (invDateMatch) {
    invoiceDateStr = invDateMatch[1].trim();
  }

  // Try to find Due Date with label - multiple patterns
  let dueDateStr = null;
  const dueDateMatch = text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                       text.match(/DUE\s+DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
                       text.match(/Payment\s+Due[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);
  if (dueDateMatch) {
    dueDateStr = dueDateMatch[1].trim();
  }

  // Parse the dates if found
  if (invoiceDateStr) {
    invoice.invoiceDate = parseDate(invoiceDateStr, invoice.currency, invoice.invoiceNumber);
  }
  if (dueDateStr) {
    invoice.dueDate = parseDate(dueDateStr, invoice.currency, invoice.invoiceNumber);
  }

  // WARNING: Fallback to today if dates are invalid
  // This is a workaround - ideally should flag for manual review
  if (!invoice.invoiceDate) {
    console.warn(`⚠️  WARNING: Could not extract invoice date for invoice ${invoice.invoiceNumber}. Using current date as fallback.`);
    invoice.invoiceDate = new Date().toISOString().split('T')[0];
  }
  if (!invoice.dueDate) {
    console.warn(`⚠️  WARNING: Could not extract due date for invoice ${invoice.invoiceNumber}. Using current date + 30 days as fallback.`);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    invoice.dueDate = futureDate.toISOString().split('T')[0];
  }

  // Extract amount - handle negative amounts (credit memos)
  // Try multiple patterns to find the amount, prioritizing Invoice Total
  let amountMatch =
    // Pattern 1: Invoice Total (highest priority) - handles both "Invoice Total$" and "Invoice Total $"
    text.match(/Invoice\s*Total[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
    // Pattern 2: Open Credit
    text.match(/Open\s*Credit[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
    // Pattern 3: Item Subtotal (for credit memos)
    text.match(/Item\s*Subtotal[\s\n]*\$[\s\n]*(-?[\d,]+\.?\d*)/i) ||
    // Pattern 4: Amount Due/Balance Due with various formats
    text.match(/(?:Amount\s*Due|Balance\s*Due)[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i) ||
    // Pattern 5: Credit Amount
    text.match(/Credit\s*Amount[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i) ||
    // Pattern 6: Just a dollar amount with possible negative indicators
    text.match(/[-\(]\$?\s*([\d,]+\.?\d*)\)?/i);

  if (amountMatch) {
    // Check if this is an Invoice Total or similar where we need to look for minus sign in the full match
    const fullMatch = amountMatch[0];

    // Extract numeric value from capture group
    let amountStr = amountMatch[1] || amountMatch[0];

    // Clean and parse
    let amount = parseFloat(amountStr.replace(/[,\$]/g, ''));

    // Check if the amount should be negative
    // Look for minus sign or parentheses in either the full match or the original text around this amount
    if (fullMatch.includes('-') || fullMatch.includes('(') || amountStr.startsWith('-')) {
      amount = -Math.abs(amount);
    }

    invoice.amountDue = amount;
  }

  // If still no amount found, set to 0 to avoid database error
  if (!invoice.amountDue && invoice.amountDue !== 0) {
    invoice.amountDue = 0;
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

  // Strategy 2: Look for simpler format "QuantityDescriptionTaxableExt Price" (common in Altera invoices) - RUN THIS BEFORE Strategy 3!
  if (!services) {
    // Match both "Quantity Description Taxable Ext Price" (with spaces) and "QuantityDescriptionTaxableExt Price" (concatenated)
    // Increased limit to 8000 chars to handle multi-page invoices
    const simpleMatch = text.match(/Quantity\s*Description\s*Taxable\s*Ext\s+Price([\s\S]{0,8000}?)Item\s+Subtotal/i);
    if (simpleMatch) {
      services = simpleMatch[1].trim();
    }

    // Also try concatenated version if first attempt failed
    if (!services) {
      const concatenatedMatch = text.match(/QuantityDescriptionTaxableExt\s+Price([\s\S]{0,8000}?)Item\s+Subtotal/i);
      if (concatenatedMatch) {
        services = concatenatedMatch[1].trim();
      }
    }
  }

  // Strategy 3: Look for "Description:" or "Services:" label
  if (!services) {
    const serviceMatch = text.match(/(?:Description|Services|Items)[:\s]*\n([\s\S]{0,800}?)(?:Item\s+Subtotal|Special\s+Instructions|Transaction\s+Type|Page\s+\d+)/i);
    if (serviceMatch) {
      services = serviceMatch[1].trim();
    }
  }

  // Strategy 4: Find content between "Transaction Type" and "Item Subtotal"
  if (!services) {
    const betweenMatch = text.match(/Transaction\s+Type[\s\S]{0,300}?Currency[\s\S]{0,200}?([\s\S]{0,1000}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
    if (betweenMatch) {
      services = betweenMatch[1].trim();
    }
  }

  // Clean up and filter
  if (services) {
    // Stop at "Invoice Number:" if it appears (repeated header)
    const invoiceNumIndex = services.indexOf('Invoice Number:');
    if (invoiceNumIndex > 0) {
      services = services.substring(0, invoiceNumIndex);
    }

    // Remove table header remnants that might have been captured
    services = services.replace(/^(Taxable\s*Extended\s*Price\s*|Week\s+Ending\s+Date\s*Qty\s*UOM\s*Unit\s*Price\s*|Quantity\s*Description\s*Taxable\s*Ext\s+Price\s*|QuantityDescriptionTaxableExt\s+Price\s*)/i, '');

    // Remove line items with just "Yes" and dollar amounts
    services = services.replace(/\s+Yes\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+/g, '');

    // Remove line items with "No" and dollar amounts (common in Altera format)
    services = services.replace(/\s+No\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+/g, '');

    // Remove isolated "Yes" and "No" entries
    services = services.replace(/\s+Yes\s+/g, ' ');
    services = services.replace(/\s+No\s+/g, ' ');

    // Remove standalone numbers at the beginning of lines (quantity indicators)
    services = services.replace(/^\d+\s+/gm, '');
    services = services.replace(/\s+\d+\s+/g, ' ');

    // Remove invoice number references that got captured
    services = services.replace(/Invoice\s+Number:\s*[\d]+\s+Invoice\s+Date:\s*[\d\-]+/gi, '');

    // Remove extra whitespace and normalize
    services = services.replace(/\s+/g, ' ').trim();

    // Check if this looks PRIMARILY like address information (not just mentions it)
    // Only reject if address patterns are in the first 200 chars and no service keywords present
    const firstPart = services.substring(0, 200);
    const hasAddressInStart = firstPart.match(/(BILL\s+TO|SHIP\s+TO|ATTN:|GPO\s+Box|c\/o\s+Shared\s+Services)/i);
    const hasServiceKeywords = services.match(/(Professional\s+Services|Subscription|Maintenance|Support|License|Training|Implementation|Integration|Annual|Monthly|Quarterly|Fee)/i);

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
  invoice.invoiceType = classifyInvoiceType(invoice.services, invoice.invoiceNumber, invoice.amountDue);
  invoice.frequency = detectFrequency(invoice.services, invoice.amountDue);

  return invoice;
}

// API Endpoints

// Health check endpoint - indicates database type
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'postgresql',
      version: '1.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'postgresql',
      error: error.message
    });
  }
});

// Get all invoices
app.get('/api/invoices', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM invoices ORDER BY invoice_date DESC');
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

          // Check for duplicates (for tracking purposes, but allow upload)
          const existing = await db.get(
            'SELECT id, invoice_number FROM invoices WHERE LOWER(TRIM(invoice_number)) = LOWER(TRIM($1))',
            invoiceData.invoice_number
          );

          if (existing) {
            duplicates.push({
              invoiceNumber: invoiceData.invoice_number,
              filename: file.originalFilename,
              existingId: existing.id
            });
          }

          // Move PDF to permanent storage
          const pdfFilename = `${Date.now()}-${file.originalFilename}`;
          const pdf_path = path.join(pdfsDir, pdfFilename);
          fs.renameSync(file.filepath, pdf_path);

          const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);

          const invoice = {
            id,
            ...invoiceData,
            status: 'Pending',
            uploadDate: new Date().toISOString().split('T')[0],
            pdfPath: `/pdfs/${pdfFilename}`,
            pdfOriginalName: file.originalFilename
          };

          await db.run(`
            INSERT INTO invoices (
              id, invoice_number, invoice_date, client, customer_contract,
              oracle_contract, po_number, invoice_type, amount_due, currency,
              due_date, status, upload_date, services, pdf_path, pdf_original_name, frequency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `,
            invoice.id, invoice.invoiceNumber, invoice.invoiceDate, invoice.client,
            invoice.customerContract, invoice.oracleContract, invoice.poNumber,
            invoice.invoiceType, invoice.amountDue, invoice.currency, invoice.dueDate,
            invoice.status, invoice.uploadDate, invoice.services, invoice.pdfPath,
            invoice.pdfOriginalName, invoice.frequency
          );

          results.push(invoice);

          // Check if this matches an expected invoice
          await checkAndRemoveExpectedInvoice(invoice);

        } catch (error) {
          console.error(`Error processing ${file.originalFilename}:`, error.message);
          if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
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
      const existing = await db.get('SELECT pdf_path FROM invoices WHERE id = $1', id);

      // Extract new invoice data
      const invoiceData = await extractInvoiceData(file.filepath, file.originalFilename);

      // Move new PDF to permanent storage
      const pdfFilename = `${Date.now()}-${file.originalFilename}`;
      const pdf_path = path.join(pdfsDir, pdfFilename);
      fs.renameSync(file.filepath, pdf_path);

      // Delete old PDF
      if (existing && existing.pdf_path) {
        const oldPdfPath = path.join(__dirname, existing.pdf_path);
        if (fs.existsSync(oldPdfPath)) {
          fs.unlinkSync(oldPdfPath);
        }
      }

      // Update invoice in database
      await db.run(`
        UPDATE invoices
        SET invoice_date = $1, client = $2, customer_contract = $3, oracle_contract = $4,
            po_number = $5, invoice_type = $6, amount_due = $7, currency = $8, due_date = $9,
            services = $10, pdf_path = $11, pdf_original_name = $12, frequency = $13,
            upload_date = $14
        WHERE id = $15
      `,
        invoiceData.invoice_date, invoiceData.client, invoiceData.customer_contract,
        invoiceData.oracle_contract, invoiceData.po_number, invoiceData.invoice_type,
        invoiceData.amount_due, invoiceData.currency, invoiceData.due_date,
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
        const invoice_number = row.getCell(1).value;
        const payment_date = row.getCell(2).value;

        if (!invoice_number) return;

        const invoiceStr = String(invoice_number).trim();
        const paymentDateStr = payment_date ?
          (payment_date instanceof Date ? paymentDate.toISOString().split('T')[0] : String(payment_date)) :
          new Date().toISOString().split('T')[0];

        updates.push({ invoiceNumber: invoiceStr, paymentDate: paymentDateStr });
      });

      let updatedCount = 0;

      for (const update of updates) {
        const result = await db.run(`
          UPDATE invoices
          SET status = 'Paid', payment_date = $1
          WHERE LOWER(TRIM(invoice_number)) = LOWER($2)
        `, update.paymentDate, update.invoiceNumber);
        updatedCount += result.rowCount || 0;
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
app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Convert camelCase to snake_case for PostgreSQL columns
    const toSnakeCase = (str) => {
      return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    };

    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        const snakeKey = toSnakeCase(key);
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    values.push(id);

    const result = await db.run(
      `UPDATE invoices SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const row = await db.get('SELECT pdf_path FROM invoices WHERE id = $1', id);

    if (row && row.pdf_path) {
      // Convert web path (/pdfs/file.pdf) to file system path (invoice_pdfs/file.pdf)
      const relativePath = row.pdfPath.replace(/^\/pdfs\//, 'invoice_pdfs/');
      const pdfFullPath = path.join(__dirname, relativePath);

      if (fs.existsSync(pdfFullPath)) {
        // Move PDF to deleted folder instead of deleting it
        const pdfFilename = path.basename(pdfFullPath);
        const deletedPath = path.join(deletedPdfsDir, pdfFilename);

        // If a file with the same name exists in deleted folder, add timestamp
        let finalDeletedPath = deletedPath;
        if (fs.existsSync(deletedPath)) {
          const timestamp = Date.now();
          const ext = path.extname(pdfFilename);
          const nameWithoutExt = path.basename(pdfFilename, ext);
          finalDeletedPath = path.join(deletedPdfsDir, `${nameWithoutExt}_${timestamp}${ext}`);
        }

        fs.renameSync(pdfFullPath, finalDeletedPath);
      }
    }

    await db.run('DELETE FROM invoices WHERE id = $1', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete ALL invoices (DEVELOPMENT ONLY)
app.delete('/api/invoices', async (req, res) => {
  try {
    // Get all invoice PDFs
    const invoices = await db.all('SELECT pdf_path FROM invoices');

    // Move all PDF files to deleted folder
    let movedFiles = 0;
    for (const invoice of invoices) {
      if (invoice.pdfPath) {
        // Convert web path (/pdfs/file.pdf) to file system path (invoice_pdfs/file.pdf)
        const relativePath = invoice.pdfPath.replace(/^\/pdfs\//, 'invoice_pdfs/');
        const pdfFullPath = path.join(__dirname, relativePath);

        if (fs.existsSync(pdfFullPath)) {
          // Move PDF to deleted folder
          const pdfFilename = path.basename(pdfFullPath);
          const timestamp = Date.now();
          const ext = path.extname(pdfFilename);
          const nameWithoutExt = path.basename(pdfFilename, ext);
          const deletedPath = path.join(deletedPdfsDir, `${nameWithoutExt}_${timestamp}${ext}`);

          fs.renameSync(pdfFullPath, deletedPath);
          movedFiles++;
        }
      }
    }

    // Delete all invoices from database
    const result = await db.run('DELETE FROM invoices');

    // Delete all expected invoices
    await db.run('DELETE FROM expected_invoices');

    res.json({
      success: true,
      deletedInvoices: result.changes,
      movedFiles: movedFiles
    });
  } catch (error) {
    console.error('Error deleting all invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get expected invoices
app.get('/api/expected-invoices', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM expected_invoices ORDER BY expected_date ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expected invoice
app.put('/api/expected-invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledged } = req.body;

    const acknowledged_date = acknowledged ? new Date().toISOString().split('T')[0] : null;

    await db.run(
      'UPDATE expected_invoices SET acknowledged = $1, acknowledged_date = $2 WHERE id = $3',
      acknowledged ? 1 : 0, acknowledged_date, id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expected invoice
app.delete('/api/expected-invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM expected_invoices WHERE id = $1', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate expected invoices
async function generateExpectedInvoices() {
  try {
    const rows = await db.all(`
      SELECT
        client, customer_contract, invoice_type, amount_due, currency,
        invoice_date, invoice_number, frequency
      FROM invoices
      WHERE frequency != 'adhoc'
      ORDER BY client, customer_contract, invoice_date DESC
    `);

    const grouped = {};

    for (const row of rows) {
      // Group by client and contract only - one expected invoice per contract
      const key = `${row.client}-${row.customer_contract || 'none'}`;
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

      const expected_date = nextDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      if (expected_date <= today) {
        // Check for existing expected invoice within ±1 day to handle timezone differences
        const dateMinus1 = new Date(expected_date);
        dateMinus1.setDate(dateMinus1.getDate() - 1);
        const datePlus1 = new Date(expected_date);
        datePlus1.setDate(datePlus1.getDate() + 1);

        // Check for existing expected invoice for this contract (regardless of invoice type)
        const existing = await db.get(`
          SELECT id FROM expected_invoices
          WHERE LOWER(TRIM(client)) = LOWER(TRIM($1))
            AND LOWER(TRIM(customer_contract)) = LOWER(TRIM($2))
            AND expected_date BETWEEN $3 AND $4
            AND acknowledged = false
        `,
          invoice.client,
          invoice.customerContract || '',
          dateMinus1.toISOString().split('T')[0],
          datePlus1.toISOString().split('T')[0]
        );

        if (!existing) {
          console.log(`Creating expected invoice for ${invoice.client} - ${invoice.customerContract} on ${expected_date}`);
        } else {
          console.log(`Skipping duplicate expected invoice for ${invoice.client} - ${invoice.customerContract} on ${expected_date} (already exists)`);
        }

        if (!existing) {
          const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
          const created_date = new Date().toISOString().split('T')[0];

          await db.run(`
            INSERT INTO expected_invoices (
              id, client, customer_contract, invoice_type, expected_amount,
              currency, expected_date, frequency, last_invoice_number, last_invoice_date,
              created_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
            id,
            invoice.client,
            invoice.customerContract || '',
            invoice.invoiceType,
            invoice.amountDue,
            invoice.currency,
            expected_date,
            invoice.frequency,
            invoice.invoiceNumber,
            invoice.invoiceDate,
            created_date
          );
        }
      }
    }
  } catch (error) {
    console.error('Error generating expected invoices:', error);
  }
}

// Schedule expected invoice generation to run daily at midnight
// This ensures expected invoices are generated even when no invoices are uploaded
setInterval(() => {
  console.log('Running scheduled expected invoice generation...');
  generateExpectedInvoices();
}, 24 * 60 * 60 * 1000); // Run every 24 hours

// Also run on server startup to catch any that were missed
console.log('Running initial expected invoice generation on server startup...');
generateExpectedInvoices();

// Check and remove expected invoice when actual invoice received
async function checkAndRemoveExpectedInvoice(invoice) {
  // Skip adhoc invoices - they shouldn't have expected entries
  if (invoice.frequency === 'adhoc') return;

  try {
    const clientMatch = invoice.client;
    const contractMatch = invoice.customerContract || '';
    const typeMatch = invoice.invoiceType;

    // Parse invoice date
    const invoice_date = new Date(invoice.invoiceDate);

    // Find matching expected invoices
    const expectedInvoices = await db.all(`
      SELECT id, expected_date FROM expected_invoices
      WHERE client = $1
        AND (customer_contract = $2 OR (customer_contract IS NULL AND $3 = ''))
        AND invoice_type = $4
        AND frequency = $5
    `, clientMatch, contractMatch, contractMatch, typeMatch, invoice.frequency);

    // Remove expected invoices that match and are within reasonable date range
    for (const expected of expectedInvoices) {
      const expected_date = new Date(expected.expected_date);
      const daysDiff = Math.abs((invoice_date - expected_date) / (1000 * 60 * 60 * 24));

      // Match if invoice is within 45 days of expected date
      if (daysDiff <= 45) {
        await db.run('DELETE FROM expected_invoices WHERE id = $1', expected.id);
        console.log(`Removed expected invoice for ${clientMatch} - ${contractMatch} (${typeMatch})`);
      }
    }
  } catch (error) {
    console.error('Error removing expected invoice:', error);
  }
}

// Clean up old acknowledged expected invoices (weekly)
async function cleanupAcknowledgedInvoices() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const cutoffDate = oneWeekAgo.toISOString().split('T')[0];

    await db.run(
      'DELETE FROM expected_invoices WHERE acknowledged = 1 AND acknowledged_date < $1',
      cutoffDate
    );

    console.log('Cleaned up old acknowledged invoices');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run cleanup weekly
setInterval(cleanupAcknowledgedInvoices, 7 * 24 * 60 * 60 * 1000);

// Get exchange rates
app.get('/api/exchange-rates', async (req, res) => {
  res.json(exchangeRates);
});

// Natural language query
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;

    const invoices = await db.all('SELECT * FROM invoices');

    const queryLower = query.toLowerCase();
    let results = [...invoices];

    // Check for "contracts with no value" query FIRST (before other filters)
    // This needs to be first to avoid the client filter matching "to no" as a client name
    if (queryLower.match(/contracts?.*(with\s+no|without|no)\s+value/i) ||
        queryLower.match(/which.*contracts.*no.*value/i) ||
        queryLower.match(/contracts.*value.*null|empty|missing/i)) {

      // Get all contracts from contracts table
      const allContracts = await db.all('SELECT * FROM contracts');

      // Get all unique contract names from invoices
      const uniqueContractNames = [...new Set(results
        .map(inv => inv.customer_contract)
        .filter(name => name))];

      // Find contracts with no value:
      // 1. Contracts in contracts table with value = NULL or 0
      // 2. Contracts in invoices but NOT in contracts table (no value entered yet)
      const contractsInTable = allContracts.map(c => c.contract_name);
      const contractsWithNoValue = uniqueContractNames.filter(contractName => {
        const contractRecord = allContracts.find(c => c.contract_name === contractName);
        // No record = no value, or record exists but value is null/0
        return !contractRecord || !contractRecord.contract_value || contractRecord.contract_value === 0;
      });

      // Filter invoices to only those belonging to contracts with no value
      results = results.filter(inv => {
        const contractName = inv.customer_contract;
        return contractName && contractsWithNoValue.includes(contractName);
      });

      // Return with special formatting to show grouped by contract and client
      return res.json({
        type: 'contracts_no_value',
        count: results.length,
        invoices: results,
        contractsWithNoValue: contractsWithNoValue,
        message: `Found ${contractsWithNoValue.length} contract(s) with no value and ${results.length} invoice(s)`
      });
    }

    // Filter by invoice type
    const types = ['ps', 'maint', 'sub', 'hosting', 'ms', 'sw', 'hw', '3pp', 'credit memo'];
    types.forEach(type => {
      if (queryLower.includes(type)) {
        results = results.filter(inv => inv.invoice_type && inv.invoiceType.toLowerCase() === type);
      }
    });

    // Filter by client name
    // Match patterns: "for X", "from X", "by X", "to X", "issued to X", "sent to X", "relating to X"
    const clientMatch = queryLower.match(/(?:relating to|issued to|sent to|for|from|by|to)\s+([a-z0-9\s&'.,-]+?)(?:\?|$|(?:\s+(?:what|total|sum|how|invoices|how many|are|is|in|during|between|and|>|<)))/i);
    if (clientMatch) {
      const clientName = clientMatch[1].trim();
      results = results.filter(inv =>
        inv.client && inv.client.toLowerCase().includes(clientName)
      );
    }

    // Filter by contract
    // Match patterns: "contract X", "on contract X", "for contract X"
    const contractMatch = queryLower.match(/(?:contract|on contract|for contract)\s+([a-z0-9\s\-_'.&,]+?)(?:\s+(?:what|total|sum|how|invoices|in|during|\?)|$)/i);
    if (contractMatch) {
      const contract_name = contractMatch[1].trim();
      results = results.filter(inv =>
        inv.customer_contract && inv.customerContract.toLowerCase().includes(contract_name)
      );
    }

    // Filter by status
    // Check for unpaid/pending/overdue BEFORE checking for paid (since "unpaid" contains "paid")
    if (queryLower.includes('overdue')) {
      const today = new Date().toISOString().split('T')[0];
      results = results.filter(inv =>
        inv.status === 'Pending' &&
        inv.due_date &&
        inv.due_date < today &&
        inv.invoiceType?.toLowerCase() !== 'credit memo'
      );
    } else if (queryLower.includes('unpaid') || queryLower.includes('pending') || queryLower.includes('outstanding')) {
      results = results.filter(inv =>
        inv.status === 'Pending' &&
        inv.invoiceType?.toLowerCase() !== 'credit memo'
      );
    } else if (queryLower.includes('paid')) {
      results = results.filter(inv => inv.status === 'Paid');
    }

    // Filter by date range
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // This month
    if (queryLower.includes('this month') || queryLower.includes('current month')) {
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      if (queryLower.includes('due')) {
        results = results.filter(inv => inv.due_date >= monthStart && inv.due_date <= monthEnd);
      } else {
        results = results.filter(inv => inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd);
      }
    }

    // Last month
    if (queryLower.includes('last month') || queryLower.includes('previous month')) {
      const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      if (queryLower.includes('due')) {
        results = results.filter(inv => inv.due_date >= monthStart && inv.due_date <= monthEnd);
      } else {
        results = results.filter(inv => inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd);
      }
    }

    // This year
    if (queryLower.includes('this year') || queryLower.includes('current year')) {
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      if (queryLower.includes('due')) {
        results = results.filter(inv => inv.due_date >= yearStart && inv.due_date <= yearEnd);
      } else {
        results = results.filter(inv => inv.invoice_date >= yearStart && inv.invoice_date <= yearEnd);
      }
    }

    // Last year
    if (queryLower.includes('last year') || queryLower.includes('previous year')) {
      const yearStart = `${currentYear - 1}-01-01`;
      const yearEnd = `${currentYear - 1}-12-31`;

      if (queryLower.includes('due')) {
        results = results.filter(inv => inv.due_date >= yearStart && inv.due_date <= yearEnd);
      } else {
        results = results.filter(inv => inv.invoice_date >= yearStart && inv.invoice_date <= yearEnd);
      }
    }

    // Specific month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    months.forEach((month, index) => {
      if (queryLower.includes(month)) {
        const year = queryLower.match(/\b(20\d{2})\b/) ? parseInt(queryLower.match(/\b(20\d{2})\b/)[1]) : currentYear;
        const monthStart = new Date(year, index, 1).toISOString().split('T')[0];
        const monthEnd = new Date(year, index + 1, 0).toISOString().split('T')[0];

        if (queryLower.includes('due')) {
          results = results.filter(inv => inv.due_date >= monthStart && inv.due_date <= monthEnd);
        } else {
          results = results.filter(inv => inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd);
        }
      }
    });

    // Between dates pattern: "between YYYY-MM-DD and YYYY-MM-DD"
    const betweenMatch = queryLower.match(/between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/i);
    if (betweenMatch) {
      const dateFrom = betweenMatch[1];
      const dateTo = betweenMatch[2];

      if (queryLower.includes('due')) {
        results = results.filter(inv => inv.due_date >= dateFrom && inv.due_date <= dateTo);
      } else {
        results = results.filter(inv => inv.invoice_date >= dateFrom && inv.invoice_date <= dateTo);
      }
    }

    // Filter by frequency
    const frequencies = ['monthly', 'quarterly', 'annual', 'adhoc', 'one-time'];
    frequencies.forEach(freq => {
      if (queryLower.includes(freq)) {
        results = results.filter(inv => inv.frequency && inv.frequency.toLowerCase() === freq);
      }
    });

    // Filter by currency
    const currencies = ['usd', 'aud', 'eur', 'gbp', 'sgd'];
    currencies.forEach(curr => {
      if (queryLower.includes(curr)) {
        results = results.filter(inv => inv.currency && inv.currency.toLowerCase() === curr);
      }
    });

    // Filter by contract completion percentage
    // Patterns:
    // - Single: "50% invoiced", "<70% invoiced", ">50% paid", "<=80% complete", ">=25% billed"
    // - Range: ">50% and <70% invoiced", ">=40% and <=60% paid", "between 30% and 50% invoiced"

    // First check for range queries (two percentage comparisons with "and" or "between")
    const rangeMatch = queryLower.match(/([<>]=?)\s*(\d+)\s*(?:%|percent)?\s+(?:and|&)\s+([<>]=?)\s*(\d+)\s*(?:%|percent)?\s*(?:invoiced|complete|billed|done|paid|unpaid)/i) ||
                       queryLower.match(/(?:between|from)\s+(\d+)\s*(?:%|percent)?\s+(?:and|to|-)\s+(\d+)\s*(?:%|percent)?\s*(?:invoiced|complete|billed|done|paid|unpaid)/i);

    // Then check for single percentage match
    const percentageMatch = queryLower.match(/([<>]=?|=)?\s*(\d+)\s*(?:%|percent|per cent)\s*(?:invoiced|complete|billed|done|paid|unpaid)/i);

    let contractSummary = null;
    let isRangeQuery = false;
    let operator1, operator2, targetPercentage1, targetPercentage2;

    if (rangeMatch) {
      isRangeQuery = true;
      if (rangeMatch[1] && rangeMatch[3]) {
        // Pattern: >50% and <70%
        operator1 = rangeMatch[1];
        targetPercentage1 = parseInt(rangeMatch[2]);
        operator2 = rangeMatch[3];
        targetPercentage2 = parseInt(rangeMatch[4]);
      } else {
        // Pattern: between 50% and 70% (treat as >= and <=)
        operator1 = '>=';
        targetPercentage1 = parseInt(rangeMatch[1]);
        operator2 = '<=';
        targetPercentage2 = parseInt(rangeMatch[2]);
      }
    }

    if (percentageMatch || isRangeQuery) {
      let operator, targetPercentage;

      if (!isRangeQuery) {
        operator = percentageMatch[1] || '='; // Default to equals if no operator
        targetPercentage = parseInt(percentageMatch[2]);
      }

      // Determine if we're looking at paid or unpaid percentages
      const isPaidQuery = queryLower.includes('paid') && !queryLower.includes('unpaid');
      const isUnpaidQuery = queryLower.includes('unpaid');

      // Get all contracts
      const contracts = await db.all('SELECT contract_name, contract_value, currency FROM contracts');

      // Group invoices by contract and calculate totals (both total and paid)
      const contractTotals = {};
      const contractPaidTotals = {};
      const contractsInResults = new Set();

      results.forEach(inv => {
        const contractName = inv.customerContract || inv.customer_contract;
        if (contractName) {
          contractsInResults.add(contractName);
          if (!contractTotals[contractName]) {
            contractTotals[contractName] = 0;
            contractPaidTotals[contractName] = 0;
          }
          // Convert to USD for comparison
          const amountUSD = convertToUSD(inv.amountDue || inv.amount_due, inv.currency);
          contractTotals[contractName] += amountUSD;

          // Track paid amounts
          if (inv.status === 'Paid') {
            contractPaidTotals[contractName] += amountUSD;
          }
        }
      });

      // Find contracts matching the percentage criteria and build summary
      const matchingContracts = [];
      const contractDetails = [];

      contracts.forEach(contract => {
        const contractName = contract.contractName || contract.contract_name;

        // Only process contracts that have invoices in the filtered results
        if (!contractsInResults.has(contractName)) {
          return;
        }

        const contractValue = parseFloat(contract.contractValue || contract.contract_value);
        const contractCurrency = contract.currency || 'USD';

        // Skip contracts with no value or invalid value
        if (!contractValue || isNaN(contractValue) || contractValue <= 0) {
          return;
        }

        const contractValueUSD = convertToUSD(contractValue, contractCurrency);

        const invoicedTotal = contractTotals[contractName] || 0;
        const paidTotal = contractPaidTotals[contractName] || 0;
        const unpaidTotal = invoicedTotal - paidTotal;

        // Calculate percentage based on query type
        let percentage;
        if (isPaidQuery) {
          percentage = contractValueUSD > 0 ? (paidTotal / contractValueUSD) * 100 : 0;
        } else if (isUnpaidQuery) {
          percentage = contractValueUSD > 0 ? (unpaidTotal / contractValueUSD) * 100 : 0;
        } else {
          // Default: total invoiced percentage
          percentage = contractValueUSD > 0 ? (invoicedTotal / contractValueUSD) * 100 : 0;
        }

        // Cap percentage at 100% (exchange rate fluctuations can cause values over 100%)
        percentage = Math.min(percentage, 100);

        // Check if percentage matches criteria based on operator(s)
        let matches = false;
        const tolerance = 5;

        if (isRangeQuery) {
          // For range queries, both conditions must be true
          let condition1 = false;
          let condition2 = false;

          switch(operator1) {
            case '<':
              condition1 = percentage < targetPercentage1;
              break;
            case '>':
              condition1 = percentage > targetPercentage1;
              break;
            case '<=':
              condition1 = percentage <= targetPercentage1;
              break;
            case '>=':
              condition1 = percentage >= targetPercentage1;
              break;
          }

          switch(operator2) {
            case '<':
              condition2 = percentage < targetPercentage2;
              break;
            case '>':
              condition2 = percentage > targetPercentage2;
              break;
            case '<=':
              condition2 = percentage <= targetPercentage2;
              break;
            case '>=':
              condition2 = percentage >= targetPercentage2;
              break;
          }

          matches = condition1 && condition2;
        } else {
          // Single condition
          switch(operator) {
            case '<':
              matches = percentage < targetPercentage;
              break;
            case '>':
              matches = percentage > targetPercentage;
              break;
            case '<=':
              matches = percentage <= targetPercentage;
              break;
            case '>=':
              matches = percentage >= targetPercentage;
              break;
            case '=':
            default:
              // Use tolerance for equals
              matches = Math.abs(percentage - targetPercentage) <= tolerance;
              break;
          }
        }

        if (matches) {
          matchingContracts.push(contractName);
          contractDetails.push({
            contractName,
            contractValue: contractValueUSD,
            invoicedTotal,
            paidTotal,
            unpaidTotal,
            percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
            currency: contractCurrency,
            originalValue: contractValue
          });
        }
      });

      // Create contract summary for response
      if (contractDetails.length > 0) {
        if (isRangeQuery) {
          contractSummary = {
            isRange: true,
            targetPercentage1,
            operator1,
            targetPercentage2,
            operator2,
            queryType: isPaidQuery ? 'paid' : isUnpaidQuery ? 'unpaid' : 'invoiced',
            matchingContracts: contractDetails,
            totalContracts: contractDetails.length
          };
        } else {
          contractSummary = {
            isRange: false,
            targetPercentage,
            operator,
            queryType: isPaidQuery ? 'paid' : isUnpaidQuery ? 'unpaid' : 'invoiced',
            matchingContracts: contractDetails,
            totalContracts: contractDetails.length
          };
        }
      }

      // Filter invoices to only those matching contracts
      if (matchingContracts.length > 0) {
        results = results.filter(inv => {
          const contractName = inv.customerContract || inv.customer_contract;
          return contractName && matchingContracts.includes(contractName);
        });
      } else {
        // No contracts match the criteria, return empty results
        results = [];
      }
    }

    // Determine response type
    const wantsCount = queryLower.includes('how many') || queryLower.includes('count') || queryLower.includes('number of');
    const wantsTotal = queryLower.includes('total') || queryLower.includes('sum') || queryLower.includes('how much') || queryLower.includes('value');
    const wantsAverage = queryLower.includes('average') || queryLower.includes('mean');
    const wantsList = queryLower.includes('show') || queryLower.includes('list') || queryLower.includes('which');

    // Calculate response
    if (wantsAverage) {
      const total = results.reduce((sum, inv) => sum + convertToUSD(inv.amount_due, inv.currency), 0);
      const average = results.length > 0 ? total / results.length : 0;

      res.json({
        type: 'average',
        value: average,
        total: total,
        count: results.length,
        invoices: results,
        contractSummary
      });
    } else if (wantsTotal || (wantsCount && wantsTotal)) {
      const total = results.reduce((sum, inv) => sum + convertToUSD(inv.amount_due, inv.currency), 0);

      res.json({
        type: 'total',
        value: total,
        count: results.length,
        invoices: results,
        contractSummary
      });
    } else if (wantsCount) {
      res.json({
        type: 'count',
        count: results.length,
        invoices: results,
        contractSummary
      });
    } else {
      res.json({
        type: 'list',
        invoices: results,
        count: results.length,
        contractSummary
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contract Management Endpoints

// Get all contracts
app.get('/api/contracts', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM contracts');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update contract value
app.post('/api/contracts', async (req, res) => {
  try {
    const { contract_name, contract_value, currency } = req.body;

    if (!contract_name || !contract_value) {
      return res.status(400).json({ error: 'Contract name and value are required' });
    }

    const existing = await db.get('SELECT id FROM contracts WHERE contract_name = $1', contract_name);
    const now = new Date().toISOString().split('T')[0];

    if (existing) {
      // Update existing contract
      await db.run(`
        UPDATE contracts
        SET contract_value = $1, currency = $2, updated_date = $3
        WHERE contract_name = $4
      `, contract_value, currency || 'USD', now, contract_name);

      res.json({ success: true, action: 'updated' });
    } else {
      // Create new contract
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
      await db.run(`
        INSERT INTO contracts (id, contract_name, contract_value, currency, created_date, updated_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, id, contract_name, contract_value, currency || 'USD', now, now);

      res.json({ success: true, action: 'created' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contract value
app.put('/api/contracts/:contractName', async (req, res) => {
  try {
    const { contractName } = req.params;
    const { contractValue, contract_value, currency } = req.body;

    // Debug logging
    console.log('PUT /api/contracts - Received request:');
    console.log('  contractName (param):', contractName);
    console.log('  contractValue (body):', contractValue, typeof contractValue);
    console.log('  contract_value (body):', contract_value, typeof contract_value);
    console.log('  currency (body):', currency);
    console.log('  Full body:', JSON.stringify(req.body));

    // Accept both camelCase and snake_case for backward compatibility
    const contract_name = contractName;
    const value = contractValue || contract_value;

    console.log('  Extracted value:', value, typeof value);
    console.log('  parseFloat(value):', parseFloat(value));
    console.log('  isNaN(parseFloat(value)):', isNaN(parseFloat(value)));

    // Validate inputs
    if (!contract_name) {
      console.log('  ❌ Validation failed: Contract name is required');
      return res.status(400).json({ error: 'Contract name is required' });
    }
    if (!value || isNaN(parseFloat(value))) {
      console.log('  ❌ Validation failed: Valid contract value is required');
      return res.status(400).json({ error: 'Valid contract value is required' });
    }

    const now = new Date().toISOString().split('T')[0];
    const numericValue = parseFloat(value);

    console.log('  ✅ Validation passed, updating contract:', contract_name, 'with value:', numericValue);

    const result = await db.run(`
      UPDATE contracts
      SET contract_value = $1, currency = $2, updated_date = $3
      WHERE contract_name = $4
    `, numericValue, currency || 'USD', now, contract_name);

    if (result.rowCount === 0) {
      // Contract doesn't exist, create it
      console.log('  📝 Contract not found, creating new entry');
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
      await db.run(`
        INSERT INTO contracts (id, contract_name, contract_value, currency, created_date, updated_date)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, id, contract_name, numericValue, currency || 'USD', now, now);
    } else {
      console.log('  ✅ Contract updated successfully');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete contract
app.delete('/api/contracts/:contractName', async (req, res) => {
  try {
    const { contractName } = req.params;
    console.log('DELETE /api/contracts - Received request for:', contractName);

    const result = await db.run('DELETE FROM contracts WHERE contract_name = $1', contractName);
    console.log('  ✅ Contract deleted, rows affected:', result.rowCount);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting contract:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all invoice numbers that have duplicates
app.get('/api/duplicates', async (req, res) => {
  try {
    const allInvoices = await db.all('SELECT invoice_number FROM invoices');
    const invoiceCount = {};

    // Count occurrences of each invoice number
    allInvoices.forEach(inv => {
      const num = inv.invoiceNumber.toLowerCase().trim();
      invoiceCount[num] = (invoiceCount[num] || 0) + 1;
    });

    // Get invoice numbers that appear more than once
    const duplicateNumbers = Object.keys(invoiceCount)
      .filter(num => invoiceCount[num] > 1)
      .map(num => {
        // Get the actual invoice number (with original casing)
        const original = allInvoices.find(inv => inv.invoiceNumber.toLowerCase().trim() === num);
        return {
          invoiceNumber: original.invoiceNumber,
          count: invoiceCount[num]
        };
      });

    res.json(duplicateNumbers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get duplicates by invoice number
app.get('/api/invoices/duplicates/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const duplicates = await db.all(
      'SELECT * FROM invoices WHERE LOWER(TRIM(invoice_number)) = LOWER(TRIM($1)) ORDER BY upload_date DESC',
      invoiceNumber
    );
    res.json(duplicates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete invoices by invoice number (keep only the latest)
app.delete('/api/invoices/duplicates/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    console.log('DELETE /api/invoices/duplicates - Invoice number:', invoiceNumber);

    // Get all records with this invoice number, ordered by upload date
    const records = await db.all(
      'SELECT id, upload_date, pdf_path FROM invoices WHERE LOWER(TRIM(invoice_number)) = LOWER(TRIM($1)) ORDER BY upload_date DESC',
      invoiceNumber
    );

    console.log('  Found', records.length, 'records with this invoice number');

    if (records.length <= 1) {
      console.log('  ✅ No duplicates to delete');
      return res.json({ success: true, message: 'No duplicates found', deleted: 0 });
    }

    // Keep the first one (most recent), delete the rest
    const toDelete = records.slice(1);
    console.log('  Keeping record ID:', records[0].id, 'uploaded:', records[0].upload_date);
    console.log('  Deleting', toDelete.length, 'duplicate(s):', toDelete.map(r => `ID ${r.id}`).join(', '));

    let deletedCount = 0;

    for (const record of toDelete) {
      // Delete PDF file
      if (record.pdf_path) {
        const pdfFullPath = path.join(__dirname, record.pdf_path);
        if (fs.existsSync(pdfFullPath)) {
          fs.unlinkSync(pdfFullPath);
          console.log('    Deleted PDF:', record.pdf_path);
        }
      }

      // Delete database record
      await db.run('DELETE FROM invoices WHERE id = ?', record.id);
      deletedCount++;
    }

    console.log('  ✅ Deleted', deletedCount, 'duplicate(s)');
    res.json({ success: true, message: `Deleted ${deletedCount} duplicate(s), kept the most recent`, deleted: deletedCount });
  } catch (error) {
    console.error('❌ Error deleting duplicates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize database and start server
async function startServer() {
  try {

    app.listen(PORT, () => {
      console.log(`Invoice Tracker API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
