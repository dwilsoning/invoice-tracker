const { db, pool } = require('./db-postgres');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// Determine date format based on currency
function getDateFormatByCurrency(currency) {
  // USD uses MM-DD-YYYY format
  if (currency === 'USD') {
    return 'us';
  }
  // All other currencies (AUD, EUR, GBP, SGD, NZD) use DD-MM-YYYY format
  return 'international';
}

// Parse date - handles multiple formats
function parseDate(dateStr, currency) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();
  const dateFormat = getDateFormatByCurrency(currency);

  // Month name mapping
  const months = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };

  // Format: 15-JAN-2024 or 15-Jan-2024
  const monthNamePattern = /^(\d{1,2})[-\/\s]([a-z]+)[-\/\s](\d{4})$/i;
  const monthMatch = cleaned.match(monthNamePattern);
  if (monthMatch) {
    const [, day, monthName, year] = monthMatch;
    const month = months[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Format: DD-MM-YYYY or MM-DD-YYYY based on invoice number and delimiter
  const numericPattern = /^(\d{1,2})([-\/])(\d{1,2})[-\/](\d{4})$/;
  const numericMatch = cleaned.match(numericPattern);
  if (numericMatch) {
    const [, first, delimiter, second, year] = numericMatch;

    // If using slash (/), assume US format (MM/DD/YYYY)
    // If using dash (-), use invoice number pattern
    const isUSFormat = delimiter === '/' || dateFormat === 'us';

    if (isUSFormat) {
      // MM-DD-YYYY or MM/DD/YYYY
      const month = first;
      const day = second;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      // DD-MM-YYYY
      const day = first;
      const month = second;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

async function fixCreditMemoDates() {
  try {
    console.log('Finding all credit memos...\n');

    // Get all credit memos
    const creditMemos = await db.all(
      "SELECT * FROM invoices WHERE invoice_type = $1 ORDER BY invoice_number",
      ['Credit Memo']
    );

    console.log(`Found ${creditMemos.length} credit memos\n`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const invoice of creditMemos) {
      try {
        const pdfPath = invoice.pdfPath.replace('/pdfs/', 'invoice_pdfs/');

        if (!fs.existsSync(pdfPath)) {
          console.log(`⚠️  PDF not found for ${invoice.invoiceNumber}: ${pdfPath}`);
          skipped++;
          continue;
        }

        // Parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;

        // Look for Credit Processing Date
        const dateMatch = text.match(/Credit\s+Processing\s+Date[:\s]*([0-9]{1,2}[-\/\s][A-Za-z]+[-\/\s][0-9]{2,4})/i) ||
                         text.match(/Credit\s+Processing\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                         text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                         text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i);

        if (dateMatch) {
          const dateStr = dateMatch[1].trim();
          const parsedDate = parseDate(dateStr, invoice.currency);

          if (parsedDate && parsedDate !== invoice.invoiceDate) {
            // Update the invoice date
            await db.run(
              "UPDATE invoices SET invoice_date = $1 WHERE id = $2",
              [parsedDate, invoice.id]
            );
            console.log(`✅ Updated ${invoice.invoiceNumber}: ${invoice.invoiceDate} → ${parsedDate}`);
            updated++;
          } else if (parsedDate === invoice.invoiceDate) {
            console.log(`✓  ${invoice.invoiceNumber}: Already correct (${parsedDate})`);
            skipped++;
          } else {
            console.log(`❌ Failed to parse date for ${invoice.invoiceNumber}: ${dateStr}`);
            failed++;
          }
        } else {
          console.log(`⚠️  No date found in PDF for ${invoice.invoiceNumber}`);
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error processing ${invoice.invoiceNumber}:`, error.message);
        failed++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total credit memos: ${creditMemos.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixCreditMemoDates();
