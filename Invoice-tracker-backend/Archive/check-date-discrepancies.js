require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Extract dates from PDF
async function extractDatesFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    let invoiceDate = null;
    let dueDate = null;

    // Try to extract invoice date
    const invoiceDatePatterns = [
      /Invoice Date[:\s]+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i,
      /Invoice Date[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /Date[:\s]+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i,
      /Inv(?:oice)?\s*Date[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i
    ];

    for (const pattern of invoiceDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        invoiceDate = match[1];
        break;
      }
    }

    // Try to extract due date
    const dueDatePatterns = [
      /Due Date[:\s]+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i,
      /Due Date[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /Payment Due[:\s]+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i
    ];

    for (const pattern of dueDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        dueDate = match[1];
        break;
      }
    }

    return { invoiceDate, dueDate };
  } catch (error) {
    return { invoiceDate: null, dueDate: null, error: error.message };
  }
}

// Parse date string to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle DD-MMM-YYYY format (e.g., 22-Oct-2025)
  const ddMmmYyyy = dateStr.match(/(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})/);
  if (ddMmmYyyy) {
    const day = ddMmmYyyy[1].padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = (monthNames.indexOf(ddMmmYyyy[2].toLowerCase()) + 1).toString().padStart(2, '0');
    let year = ddMmmYyyy[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // Handle MM/DD/YYYY or DD/MM/YYYY format
  const mdyOrDmy = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (mdyOrDmy) {
    let part1 = parseInt(mdyOrDmy[1]);
    let part2 = parseInt(mdyOrDmy[2]);
    let year = mdyOrDmy[3];
    if (year.length === 2) year = '20' + year;

    // If part1 > 12, it must be DD/MM/YYYY
    if (part1 > 12) {
      const day = part1.toString().padStart(2, '0');
      const month = part2.toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // If part2 > 12, it must be MM/DD/YYYY
    else if (part2 > 12) {
      const month = part1.toString().padStart(2, '0');
      const day = part2.toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Ambiguous - assume DD/MM/YYYY for international format
    else {
      const day = part1.toString().padStart(2, '0');
      const month = part2.toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

// Main function
(async () => {
  try {
    console.log('=== Checking Date Discrepancies ===\n');

    // Get all invoices from database
    const result = await pool.query(`
      SELECT id, invoice_number,
             TO_CHAR(invoice_date, 'YYYY-MM-DD') as invoice_date,
             TO_CHAR(due_date, 'YYYY-MM-DD') as due_date,
             client, pdf_path, pdf_original_name
      FROM invoices
      ORDER BY invoice_number
    `);

    console.log(`Found ${result.rows.length} invoices to check\n`);

    const discrepancies = [];
    let checked = 0;
    let errors = 0;

    for (const invoice of result.rows) {
      checked++;

      // Progress indicator
      if (checked % 50 === 0) {
        console.log(`Progress: ${checked}/${result.rows.length} invoices checked...`);
      }

      // Find the PDF file
      const pdfDir = path.join(__dirname, 'invoice_pdfs');
      const files = fs.readdirSync(pdfDir);
      const pdfFile = files.find(f => f.includes(invoice.pdf_original_name.replace('.pdf', '')));

      if (!pdfFile) {
        errors++;
        continue;
      }

      const pdfPath = path.join(pdfDir, pdfFile);
      const pdfDates = await extractDatesFromPDF(pdfPath);

      if (pdfDates.error) {
        errors++;
        continue;
      }

      if (pdfDates.invoiceDate || pdfDates.dueDate) {
        const pdfInvoiceDate = parseDate(pdfDates.invoiceDate);
        const pdfDueDate = parseDate(pdfDates.dueDate);

        const invoiceDateMismatch = pdfInvoiceDate && pdfInvoiceDate !== invoice.invoice_date;
        const dueDateMismatch = pdfDueDate && pdfDueDate !== invoice.due_date;

        if (invoiceDateMismatch || dueDateMismatch) {
          discrepancies.push({
            invoice_number: invoice.invoice_number,
            client: invoice.client,
            db_invoice_date: invoice.invoice_date,
            pdf_invoice_date: pdfInvoiceDate,
            db_due_date: invoice.due_date,
            pdf_due_date: pdfDueDate,
            invoice_date_mismatch: invoiceDateMismatch,
            due_date_mismatch: dueDateMismatch
          });
        }
      }
    }

    console.log(`\n\n=== RESULTS ===`);
    console.log(`Total invoices checked: ${checked}`);
    console.log(`Errors/Skipped: ${errors}`);
    console.log(`Discrepancies found: ${discrepancies.length}\n`);

    if (discrepancies.length > 0) {
      console.log('Discrepancies:\n');
      discrepancies.forEach(d => {
        console.log(`Invoice: ${d.invoice_number} (${d.client})`);
        if (d.invoice_date_mismatch) {
          console.log(`  Invoice Date: DB=${d.db_invoice_date} vs PDF=${d.pdf_invoice_date} ❌`);
        }
        if (d.due_date_mismatch) {
          console.log(`  Due Date: DB=${d.db_due_date} vs PDF=${d.pdf_due_date} ❌`);
        }
        console.log('');
      });

      // Save to JSON file for correction script
      fs.writeFileSync(
        'date-discrepancies.json',
        JSON.stringify(discrepancies, null, 2)
      );
      console.log('Discrepancies saved to date-discrepancies.json');
    } else {
      console.log('✅ No date discrepancies found!');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
