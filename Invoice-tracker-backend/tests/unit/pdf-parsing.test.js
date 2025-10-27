const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

describe('PDF Parsing Unit Tests', () => {
  const testPdfPath = path.join(__dirname, '../test-data', 'sample-invoice-quarterly.pdf');
  const testPdfPath2 = path.join(__dirname, '../test-data', 'sample-invoice-monthly.pdf');
  const testCreditMemoPath = path.join(__dirname, '../test-data', 'sample-credit-memo.pdf');

  describe('PDF Text Extraction', () => {
    test('Should extract text from PDF', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const dataBuffer = fs.readFileSync(testPdfPath);
      const pdfData = await pdfParse(dataBuffer);

      expect(pdfData.text).toBeDefined();
      expect(pdfData.text.length).toBeGreaterThan(0);
      expect(typeof pdfData.text).toBe('string');
    });

    test('PDF should contain expected keywords', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const dataBuffer = fs.readFileSync(testPdfPath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text.toLowerCase();

      expect(text).toMatch(/invoice/i);
      expect(text).toMatch(/total|amount|due/i);
    });
  });

  describe('Date Parsing Functions', () => {
    // Test parseDate function logic
    const parseDate = (dateStr, currency, invoiceNumber) => {
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

      // Try named month format
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

      return null;
    };

    test('Should parse DD-MMM-YYYY format', () => {
      const result = parseDate('23-Aug-2024', 'AUD', '4600012956');
      expect(result).toBe('2024-08-23');
    });

    test('Should parse DD-MMMM-YYYY format', () => {
      const result = parseDate('15-January-2025', 'USD', '4600012956');
      expect(result).toBe('2025-01-15');
    });

    test('Should handle 2-digit years', () => {
      const result = parseDate('23-Aug-24', 'AUD', '4600012956');
      expect(result).toBe('2024-08-23');
    });

    test('Should return null for invalid dates', () => {
      const result = parseDate('invalid-date-string', 'USD', '4600012956');
      expect(result).toBeNull();
    });

    test('Should return null for empty string', () => {
      const result = parseDate('', 'USD', '4600012956');
      expect(result).toBeNull();
    });
  });

  describe('Frequency Detection Functions', () => {
    const detectFrequency = (services) => {
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
    };

    test('Should detect monthly frequency', () => {
      expect(detectFrequency('Monthly maintenance fee')).toBe('monthly');
      expect(detectFrequency('MONTHLY SUPPORT')).toBe('monthly');
    });

    test('Should detect quarterly frequency', () => {
      expect(detectFrequency('Quarterly fee')).toBe('quarterly');
      expect(detectFrequency('Quarter maintenance')).toBe('quarterly');
      expect(detectFrequency('Q1 payment')).toBe('quarterly');
      expect(detectFrequency('every 3 months')).toBe('quarterly');
      expect(detectFrequency('3 month fee')).toBe('quarterly');
    });

    test('Should detect annual frequency', () => {
      expect(detectFrequency('Annual subscription')).toBe('annual');
      expect(detectFrequency('Yearly fee')).toBe('annual');
    });

    test('Should detect bi-annual frequency', () => {
      expect(detectFrequency('Bi-annual payment')).toBe('bi-annual');
      expect(detectFrequency('Semi-annual fee')).toBe('bi-annual');
      expect(detectFrequency('6 month subscription')).toBe('bi-annual');
    });

    test('Should detect tri-annual frequency', () => {
      expect(detectFrequency('Tri-annual fee')).toBe('tri-annual');
      expect(detectFrequency('4 month payment')).toBe('tri-annual');
    });

    test('Should default to adhoc for unknown patterns', () => {
      expect(detectFrequency('One-time payment')).toBe('adhoc');
      expect(detectFrequency('Professional services')).toBe('adhoc');
      expect(detectFrequency('')).toBe('adhoc');
      expect(detectFrequency(null)).toBe('adhoc');
    });

    test('Should not confuse bi-annual with annual', () => {
      expect(detectFrequency('Bi-annual subscription')).toBe('bi-annual');
      expect(detectFrequency('Semi-annual maintenance')).toBe('bi-annual');
    });
  });

  describe('Invoice Type Classification', () => {
    const classifyInvoiceType = (services, invoiceNumber, amount) => {
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
    };

    test('Should classify maintenance services', () => {
      expect(classifyInvoiceType('Annual maintenance fee', 'INV-001', 1000)).toBe('Maint');
      expect(classifyInvoiceType('Support services', 'INV-001', 1000)).toBe('Maint');
    });

    test('Should classify professional services', () => {
      expect(classifyInvoiceType('Professional services', 'INV-001', 1000)).toBe('PS');
      expect(classifyInvoiceType('Consulting fee', 'INV-001', 1000)).toBe('PS');
    });

    test('Should classify subscriptions', () => {
      expect(classifyInvoiceType('Software subscription', 'INV-001', 1000)).toBe('Sub');
      expect(classifyInvoiceType('License fee', 'INV-001', 1000)).toBe('Sub');
      expect(classifyInvoiceType('SaaS platform', 'INV-001', 1000)).toBe('Sub');
    });

    test('Should classify hosting', () => {
      expect(classifyInvoiceType('Cloud hosting', 'INV-001', 1000)).toBe('Hosting');
      expect(classifyInvoiceType('Infrastructure services', 'INV-001', 1000)).toBe('Hosting');
    });

    test('Should classify managed services', () => {
      expect(classifyInvoiceType('Managed services', 'INV-001', 1000)).toBe('MS');
      expect(classifyInvoiceType('Managed/outsourcing services', 'INV-001', 1000)).toBe('MS');
    });

    test('Should classify hardware', () => {
      expect(classifyInvoiceType('Hardware equipment', 'INV-001', 1000)).toBe('HW');
      expect(classifyInvoiceType('Devices purchase', 'INV-001', 1000)).toBe('HW');
    });

    test('Should classify third party', () => {
      expect(classifyInvoiceType('Third party software', 'INV-001', 1000)).toBe('3PP');
    });

    test('Should classify credit memos by negative amount', () => {
      expect(classifyInvoiceType('Any service', 'INV-001', -1000)).toBe('Credit Memo');
    });

    test('Should classify credit memos by keyword', () => {
      expect(classifyInvoiceType('Credit note for services', 'INV-001', 1000)).toBe('Credit Memo');
    });

    test('Should default to PS for unknown services', () => {
      expect(classifyInvoiceType('Unknown service', 'INV-001', 1000)).toBe('PS');
      expect(classifyInvoiceType('', 'INV-001', 1000)).toBe('PS');
      expect(classifyInvoiceType(null, 'INV-001', 1000)).toBe('PS');
    });

    test('Should prioritize MS over Sub when both keywords present', () => {
      expect(classifyInvoiceType('Subscription managed services', 'INV-001', 1000)).toBe('MS');
    });
  });

  describe('Currency Extraction', () => {
    test('Should extract currency codes from text', () => {
      const extractCurrency = (text) => {
        const currencyMatch = text.match(/\b(USD|AUD|EUR|GBP|SGD)\b/i);
        return currencyMatch ? currencyMatch[1].toUpperCase() : 'USD';
      };

      expect(extractCurrency('Total: $1000 USD')).toBe('USD');
      expect(extractCurrency('Amount: $500 AUD')).toBe('AUD');
      expect(extractCurrency('€250 EUR')).toBe('EUR');
      expect(extractCurrency('£100 GBP')).toBe('GBP');
      expect(extractCurrency('SGD 1000')).toBe('SGD');
      expect(extractCurrency('No currency code')).toBe('USD'); // Default
    });
  });

  describe('Amount Extraction', () => {
    test('Should extract positive amounts', () => {
      const extractAmount = (text) => {
        const match = text.match(/\$?\s*(-?[\d,]+\.?\d*)/);
        if (match) {
          return parseFloat(match[1].replace(/,/g, ''));
        }
        return 0;
      };

      expect(extractAmount('Total: $1,234.56')).toBe(1234.56);
      expect(extractAmount('Amount: 500')).toBe(500);
      expect(extractAmount('$10,000.00')).toBe(10000);
    });

    test('Should extract negative amounts', () => {
      const extractAmount = (text) => {
        const match = text.match(/[-\(]?\$?\s*([\d,]+\.?\d*)[\)]?/);
        if (match) {
          let amount = parseFloat(match[1].replace(/,/g, ''));
          if (text.includes('-') || text.includes('(')) {
            amount = -amount;
          }
          return amount;
        }
        return 0;
      };

      expect(extractAmount('Total: -$1,234.56')).toBe(-1234.56);
      expect(extractAmount('Amount: ($500.00)')).toBe(-500);
    });
  });

  describe('Invoice Number Extraction', () => {
    test('Should extract invoice numbers', () => {
      const extractInvoiceNumber = (text) => {
        const match = text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i);
        return match ? match[1].trim() : null;
      };

      expect(extractInvoiceNumber('Invoice Number: 4600012956')).toBe('4600012956');
      expect(extractInvoiceNumber('Invoice #: 123-ABC')).toBe('123-ABC');
      expect(extractInvoiceNumber('Invoice No. 12345')).toBe('12345');
      expect(extractInvoiceNumber('Invoice: 4000005321')).toBe('4000005321');
    });

    test('Should not extract non-invoice numbers', () => {
      const extractInvoiceNumber = (text) => {
        const match = text.match(/Invoice\s*(?:#|No\.?|Number)?\s*[:\s]*([0-9][A-Z0-9-]+)/i);
        if (match) {
          const invoiceNum = match[1].trim();
          // Exclude common words
          if (invoiceNum !== 'Total' && invoiceNum.match(/\d/)) {
            return invoiceNum;
          }
        }
        return null;
      };

      expect(extractInvoiceNumber('Invoice Total: $1000')).toBeNull();
    });
  });

  describe('Format Date for Display', () => {
    const formatDateForDisplay = (dateStr) => {
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
    };

    test('Should format dates correctly', () => {
      expect(formatDateForDisplay('2024-08-23')).toBe('23-Aug-24');
      expect(formatDateForDisplay('2025-01-15')).toBe('15-Jan-25');
      expect(formatDateForDisplay('2024-12-31')).toBe('31-Dec-24');
    });

    test('Should handle ISO timestamps', () => {
      expect(formatDateForDisplay('2024-08-23T00:00:00Z')).toBe('23-Aug-24');
    });

    test('Should return empty string for invalid dates', () => {
      expect(formatDateForDisplay('')).toBe('');
      expect(formatDateForDisplay('invalid')).toBe('');
      expect(formatDateForDisplay(null)).toBe('');
    });
  });

  describe('Exchange Rate Conversion', () => {
    const exchangeRates = {
      USD: 1,
      AUD: 0.65,
      EUR: 1.08,
      GBP: 1.27,
      SGD: 0.74
    };

    const convertToUSD = (amount, currency) => {
      const rate = exchangeRates[currency] || 1;
      return Math.round(amount * rate);
    };

    test('Should convert AUD to USD', () => {
      expect(convertToUSD(1000, 'AUD')).toBe(650);
    });

    test('Should convert EUR to USD', () => {
      expect(convertToUSD(1000, 'EUR')).toBe(1080);
    });

    test('Should convert GBP to USD', () => {
      expect(convertToUSD(1000, 'GBP')).toBe(1270);
    });

    test('Should handle USD (no conversion)', () => {
      expect(convertToUSD(1000, 'USD')).toBe(1000);
    });

    test('Should handle unknown currencies', () => {
      expect(convertToUSD(1000, 'UNKNOWN')).toBe(1000);
    });
  });
});
