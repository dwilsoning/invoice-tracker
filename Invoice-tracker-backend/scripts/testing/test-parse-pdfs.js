const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Parse date - handles multiple formats based on invoice number
function parseDate(dateStr, currency, invoiceNumber) {
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

  // Try to match DD-MMM-YYYY or DD-MMMM-YYYY format
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

  // Handle numeric formats
  const parts = cleaned.split(/[-\/]/);
  if (parts.length !== 3) return null;

  let day, month, year;
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
  // Otherwise, use invoice number pattern
  else {
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

// Format date for display (DD-MMM-YY)
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';

  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return '';

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = String(day).padStart(2, '0');
  const monthStr = months[month];
  const yearStr = String(year).slice(-2);
  return `${dayStr}-${monthStr}-${yearStr}`;
}

// Detect frequency
function detectFrequency(services) {
  if (!services) return 'adhoc';

  const lower = services.toLowerCase();

  if (lower.includes('monthly')) return 'monthly';

  if (lower.includes('quarterly') ||
      lower.includes('quarter') ||
      lower.includes('3 month') ||
      lower.includes('three month') ||
      lower.match(/\bq[1-4]\b/i) ||
      lower.match(/\b(jan|apr|jul|oct)[\s-]+(apr|jul|oct|jan)\b/i) ||
      lower.includes('every 3 months')) {
    return 'quarterly';
  }

  if (lower.includes('bi-annual') ||
      lower.includes('semi-annual') ||
      lower.includes('6 month') ||
      lower.includes('six month') ||
      lower.includes('every 6 months')) {
    return 'bi-annual';
  }

  if (lower.includes('tri-annual') ||
      lower.includes('4 month') ||
      lower.includes('four month') ||
      lower.includes('every 4 months')) {
    return 'tri-annual';
  }

  if ((lower.includes('annual') || lower.includes('yearly')) &&
      !lower.includes('bi-annual') &&
      !lower.includes('semi-annual') &&
      !lower.includes('tri-annual')) {
    return 'annual';
  }

  return 'adhoc';
}

// Classify invoice type
function classifyInvoiceType(services, invoiceNumber, amount) {
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

  if (!services) return 'PS';

  const lower = services.toLowerCase();

  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  if (lower.includes('managed services') ||
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  if ((lower.includes('maintenance') || lower.includes('support') || lower.includes('annual maintenance')) &&
      !lower.includes('managed')) {
    return 'Maint';
  }

  if (lower.includes('subscription') || lower.includes('license') || lower.includes('saas')) return 'Sub';
  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';
  if (lower.includes('consulting') || lower.includes('professional services') || lower.includes('penetration testing')) return 'PS';

  return 'PS';
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
    invoiceType: 'PS',
    frequency: 'adhoc'
  };

  // Extract invoice number
  const invNumMatch =
    text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Tax\s*Invoice\s*[:\s]*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Credit\s*Memo\s*[:\s#]*([0-9][A-Z0-9-]+)/i) ||
    text.match(/Invoice\s+([0-9][A-Z0-9-]+)/i);
  if (invNumMatch) {
    const invoiceNum = invNumMatch[1].trim();
    if (invoiceNum !== 'Total' && invoiceNum.match(/\d/)) {
      invoice.invoiceNumber = invoiceNum;
    }
  }

  // Extract client
  let clientFound = false;
  const billToSection = text.match(/BILL\s*TO:?\s*([\s\S]{0,400}?)(?:Transaction\s+Type|Description|Week\s+Ending|Special\s+Instructions|$)/i);
  if (billToSection) {
    const lines = billToSection[1].split('\n').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/Minister\s+for\s+Health/i)) {
        let cleanClient = line.replace(/^Minister\s+for\s+Health\s+aka\s+/i, '').trim();
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

    if (!clientFound) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/^ATTN:/i)) continue;
        if (line.match(/^PO\s*BOX/i)) continue;
        if (line.match(/^c\/o\s+/i)) continue;
        if (line.match(/^[A-Z]{2}$/)) continue;
        if (line.match(/^SHIP\s*TO/i)) continue;
        if (line.match(/^\d{4,}$/)) continue;
        if (line.match(/^[A-Za-z]+\s+\d{4}$/)) continue;
        if (line.match(/^GPO\s+Box/i)) continue;
        if (line.match(/^(Application|Digital|Shared)\s+(Services|Health)/i)) continue;
        if (line.match(/^(DHW-|Accounts\s+Payable$)/i)) continue;
        if (line.match(/(Dr|St|Ave|Road|Street|Boulevard|Drive|Avenue)\s+(corner|and|\d)/i)) continue;
        if (line.match(/^\d+\s+[A-Z]/)) continue;
        if (line.match(/^(Bonifacio|Taguig|Adelaide|Sydney|Melbourne|Brisbane)/i)) continue;

        if (line.length > 5 && !line.match(/^\d/)) {
          let cleanClient = line.trim();
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

  if (!clientFound || !invoice.client || invoice.client.length < 3) {
    invoice.client = 'Unknown Client';
  }

  // Extract currency
  const currencyMatch = text.match(/\b(USD|AUD|EUR|GBP|SGD)\b/i);
  if (currencyMatch) {
    invoice.currency = currencyMatch[1].toUpperCase();
  }

  // Extract dates - look for labels
  let invoiceDateStr = null;
  const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
  if (invDateMatch) {
    invoiceDateStr = invDateMatch[1].trim();
  }

  let dueDateStr = null;
  const dueDateMatch = text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                       text.match(/Due\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);
  if (dueDateMatch) {
    dueDateStr = dueDateMatch[1].trim();
  }

  if (invoiceDateStr) {
    invoice.invoiceDate = parseDate(invoiceDateStr, invoice.currency, invoice.invoiceNumber);
  }
  if (dueDateStr) {
    invoice.dueDate = parseDate(dueDateStr, invoice.currency, invoice.invoiceNumber);
  }

  if (!invoice.invoiceDate) {
    invoice.invoiceDate = new Date().toISOString().split('T')[0];
  }
  if (!invoice.dueDate) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    invoice.dueDate = futureDate.toISOString().split('T')[0];
  }

  // Extract amount
  let amountMatch =
    text.match(/Invoice\s*Total[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
    text.match(/Open\s*Credit[\s:]*\$?\s*-?\s*([\d,]+\.?\d*)/i) ||
    text.match(/Item\s*Subtotal[\s\n]*\$[\s\n]*(-?[\d,]+\.?\d*)/i) ||
    text.match(/(?:Amount\s*Due|Balance\s*Due)[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i) ||
    text.match(/Credit\s*Amount[:\s]*[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/i) ||
    text.match(/[-\(]\$?\s*([\d,]+\.?\d*)\)?/i);

  if (amountMatch) {
    const fullMatch = amountMatch[0];
    let amountStr = amountMatch[1] || amountMatch[0];
    let amount = parseFloat(amountStr.replace(/[,\$]/g, ''));

    if (fullMatch.includes('-') || fullMatch.includes('(') || amountStr.startsWith('-')) {
      amount = -Math.abs(amount);
    }

    invoice.amountDue = amount;
  }

  if (!invoice.amountDue && invoice.amountDue !== 0) {
    invoice.amountDue = 0;
  }

  // Extract services
  let services = '';

  const descMatch = text.match(/Description[\s\S]{0,150}?Week\s+Ending\s+Date[\s\S]{0,150}?Qty[\s\S]{0,150}?UOM[\s\S]{0,150}?Unit\s+Price[\s\S]{0,150}?Taxable[\s\S]{0,150}?Extended\s+Price([\s\S]{0,1500}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
  if (descMatch) {
    services = descMatch[1].trim();
  }

  if (!services) {
    const simpleMatch = text.match(/Quantity\s*Description\s*Taxable\s*Ext\s+Price([\s\S]{0,2500}?)Item\s+Subtotal/i);
    if (simpleMatch) {
      services = simpleMatch[1].trim();
    }
  }

  if (!services) {
    const serviceMatch = text.match(/(?:Description|Services|Items)[:\s]*\n([\s\S]{0,800}?)(?:Item\s+Subtotal|Special\s+Instructions|Transaction\s+Type|Page\s+\d+)/i);
    if (serviceMatch) {
      services = serviceMatch[1].trim();
    }
  }

  if (!services) {
    const betweenMatch = text.match(/Transaction\s+Type[\s\S]{0,300}?Currency[\s\S]{0,200}?([\s\S]{0,1000}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
    if (betweenMatch) {
      services = betweenMatch[1].trim();
    }
  }

  if (services) {
    const invoiceNumIndex = services.indexOf('Invoice Number:');
    if (invoiceNumIndex > 0) {
      services = services.substring(0, invoiceNumIndex);
    }

    services = services.replace(/^(Taxable\s*Extended\s*Price\s*|Week\s+Ending\s+Date\s*Qty\s*UOM\s*Unit\s*Price\s*|Quantity\s*Description\s*Taxable\s*Ext\s+Price\s*)/i, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+/g, '');
    services = services.replace(/\s+Yes\s+/g, ' ');
    services = services.replace(/\s+No\s+/g, ' ');
    services = services.replace(/^\d+\s+/gm, '');
    services = services.replace(/\s+\d+\s+/g, ' ');
    services = services.replace(/Invoice\s+Number:\s*[\d]+\s+Invoice\s+Date:\s*[\d\-]+/gi, '');
    services = services.replace(/\s+/g, ' ').trim();

    const firstPart = services.substring(0, 200);
    const hasAddressInStart = firstPart.match(/(BILL\s+TO|SHIP\s+TO|ATTN:|GPO\s+Box|c\/o\s+Shared\s+Services)/i);
    const hasServiceKeywords = services.match(/(Professional\s+Services|Subscription|Maintenance|Support|License|Training|Implementation|Integration|Annual|Monthly|Quarterly|Fee)/i);

    if (hasAddressInStart && !hasServiceKeywords) {
      services = '';
    } else {
      invoice.services = services.substring(0, 500);
    }
  }

  if (!services || services.length === 0) {
    invoice.services = 'No service description found';
  }

  // Classify and detect frequency
  invoice.invoiceType = classifyInvoiceType(invoice.services, invoice.invoiceNumber, invoice.amountDue);
  invoice.frequency = detectFrequency(invoice.services);

  return invoice;
}

// Main function to test all PDFs
async function testAllPDFs() {
  const pdfDirectory = '/mnt/c/Users/dwils/Altera Digital Health/APAC Leadership Team - Confidential - Documents/Downloads/DLD/2';

  console.log('==================================================');
  console.log('PDF PARSING TEST');
  console.log('==================================================');
  console.log(`Reading PDFs from: ${pdfDirectory}\n`);

  if (!fs.existsSync(pdfDirectory)) {
    console.error(`ERROR: Directory not found: ${pdfDirectory}`);
    return;
  }

  const files = fs.readdirSync(pdfDirectory).filter(f => f.toLowerCase().endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files\n`);
  console.log('==================================================\n');

  const results = [];

  for (const file of files) {
    const filePath = path.join(pdfDirectory, file);

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FILE: ${file}`);
      console.log('='.repeat(80));

      const invoice = await extractInvoiceData(filePath, file);

      console.log(`Invoice Number:  ${invoice.invoiceNumber || 'NOT FOUND'}`);
      console.log(`Client:          ${invoice.client}`);
      console.log(`Invoice Date:    ${formatDateForDisplay(invoice.invoiceDate)} (${invoice.invoiceDate})`);
      console.log(`Due Date:        ${formatDateForDisplay(invoice.dueDate)} (${invoice.dueDate})`);
      console.log(`Amount:          ${invoice.currency} ${invoice.amountDue.toLocaleString()}`);
      console.log(`Type:            ${invoice.invoiceType}`);
      console.log(`Frequency:       ${invoice.frequency}`);
      console.log(`Services:        ${invoice.services.substring(0, 150)}${invoice.services.length > 150 ? '...' : ''}`);

      results.push({
        file,
        success: true,
        invoice
      });

    } catch (error) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`FILE: ${file}`);
      console.log('='.repeat(80));
      console.log(`ERROR: ${error.message}`);

      results.push({
        file,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total files:      ${files.length}`);
  console.log(`Successful:       ${results.filter(r => r.success).length}`);
  console.log(`Failed:           ${results.filter(r => !r.success).length}`);

  if (results.filter(r => !r.success).length > 0) {
    console.log('\nFailed files:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.file}: ${r.error}`);
    });
  }

  // Frequency distribution
  console.log('\nFrequency Distribution:');
  const frequencies = {};
  results.filter(r => r.success).forEach(r => {
    const freq = r.invoice.frequency;
    frequencies[freq] = (frequencies[freq] || 0) + 1;
  });
  Object.keys(frequencies).sort().forEach(freq => {
    console.log(`  ${freq.padEnd(15)}: ${frequencies[freq]}`);
  });

  // Type distribution
  console.log('\nType Distribution:');
  const types = {};
  results.filter(r => r.success).forEach(r => {
    const type = r.invoice.invoiceType;
    types[type] = (types[type] || 0) + 1;
  });
  Object.keys(types).sort().forEach(type => {
    console.log(`  ${type.padEnd(15)}: ${types[type]}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run the test
testAllPDFs().catch(console.error);
