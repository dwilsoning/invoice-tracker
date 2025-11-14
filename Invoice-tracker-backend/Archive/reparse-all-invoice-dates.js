const { db, pool } = require('./db-postgres');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// Determine date format based on currency
function getDateFormatByCurrency(currency) {
  if (currency === 'USD') return 'us';
  return 'international';
}

// Parse date - handles multiple formats based on currency
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

  // Format: DD-MM-YYYY or MM-DD-YYYY based on currency and delimiter
  const numericPattern = /^(\d{1,2})([-\/])(\d{1,2})[-\/](\d{4})$/;
  const numericMatch = cleaned.match(numericPattern);
  if (numericMatch) {
    const [, first, delimiter, second, year] = numericMatch;

    // If using slash (/), assume US format for backward compatibility
    // Otherwise use currency-based logic
    const isUSFormat = (delimiter === '/' && dateFormat === 'us') || (delimiter !== '/' && dateFormat === 'us');

    if (isUSFormat) {
      const month = first;
      const day = second;
      // Validate date
      if (parseInt(month) > 12 || parseInt(day) > 31) return null;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      const day = first;
      const month = second;
      // Validate date
      if (parseInt(month) > 12 || parseInt(day) > 31) return null;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

async function reparseAllInvoiceDates() {
  try {
    console.log('Fetching all invoices...\n');

    // Get all invoices
    const invoices = await db.all(
      "SELECT * FROM invoices ORDER BY invoice_number"
    );

    console.log(`Found ${invoices.length} invoices\n`);
    console.log('Note: Only re-parsing invoices with PDFs available\n');

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    let noPdf = 0;

    for (const invoice of invoices) {
      try {
        const pdfPath = invoice.pdfPath ? invoice.pdfPath.replace('/pdfs/', 'invoice_pdfs/') : null;

        if (!pdfPath || !fs.existsSync(pdfPath)) {
          noPdf++;
          continue;
        }

        // Parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text = data.text;

        // Look for dates
        let invoiceDateStr = null;
        const invDateMatch = text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                             text.match(/Invoice\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i) ||
                             text.match(/DATE[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
                             text.match(/Credit\s+Processing\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                             text.match(/Credit\s+Processing\s+Date[:\s]*([0-9]{1,2}[-\/\s][A-Za-z]+[-\/\s][0-9]{2,4})/i) ||
                             text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i) ||
                             text.match(/Credit\s+Date[:\s]*([0-9]{1,2}[-\/\s][a-z]+[-\/\s][0-9]{2,4})/i);

        if (invDateMatch) {
          const dateStr = invDateMatch[1].trim();
          const parsedDate = parseDate(dateStr, invoice.currency);

          if (parsedDate && parsedDate !== invoice.invoiceDate) {
            // Check if this is a reasonable change (not wildly different)
            const oldDate = new Date(invoice.invoiceDate);
            const newDate = new Date(parsedDate);
            const daysDiff = Math.abs((newDate - oldDate) / (1000 * 60 * 60 * 24));

            // Only update if the date is significantly different (more than 30 days)
            // or if the current date looks wrong (year > 2025)
            if (daysDiff > 30 || oldDate.getFullYear() > 2025) {
              await db.run(
                "UPDATE invoices SET invoice_date = $1 WHERE id = $2",
                [parsedDate, invoice.id]
              );
              console.log(`✅ ${invoice.invoiceNumber} (${invoice.currency}): ${invoice.invoiceDate} → ${parsedDate}`);
              updated++;
            } else {
              skipped++;
            }
          } else if (parsedDate === invoice.invoiceDate) {
            skipped++;
          } else {
            if (dateStr) {
              console.log(`⚠️  ${invoice.invoiceNumber}: Could not parse "${dateStr}"`);
            }
            skipped++;
          }
        } else {
          skipped++;
        }

      } catch (error) {
        console.error(`❌ Error processing ${invoice.invoiceNumber}:`, error.message);
        failed++;
      }

      // Progress indicator every 100 invoices
      if ((updated + failed + skipped + noPdf) % 100 === 0) {
        console.log(`Progress: ${updated + failed + skipped + noPdf}/${invoices.length}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total invoices: ${invoices.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already correct or minor difference): ${skipped}`);
    console.log(`No PDF: ${noPdf}`);
    console.log(`Failed: ${failed}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

reparseAllInvoiceDates();
