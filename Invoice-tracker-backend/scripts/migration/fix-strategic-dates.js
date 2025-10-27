require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Parse US date format (MM/DD/YYYY) to YYYY-MM-DD
function parseUSDate(dateStr) {
  if (!dateStr) return null;

  // Match MM/DD/YYYY or M/D/YYYY
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!match) return null;

  let month = parseInt(match[1]);
  let day = parseInt(match[2]);
  let year = parseInt(match[3]);

  if (year < 100) year += 2000;

  // Validate
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Create date and add 1 day to compensate for PostgreSQL timezone interpretation
  // When PG stores a date, it's in server timezone; when retrieved by Node, it shows as previous day in UTC
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);

  const adjustedYear = date.getFullYear();
  const adjustedMonth = String(date.getMonth() + 1).padStart(2, '0');
  const adjustedDay = String(date.getDate()).padStart(2, '0');

  return `${adjustedYear}-${adjustedMonth}-${adjustedDay}`;
}

async function fixInvoice(invoice) {
  try {
    // Convert web path to file system path
    const pdfPath = invoice.pdf_path.replace(/^\/pdfs\//, './invoice_pdfs/');

    if (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF not found for invoice ${invoice.invoice_number}: ${pdfPath}`);
      return null;
    }

    // Read PDF
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // Extract dates with US format (MM/DD/YYYY)
    const invDateMatch = text.match(/Invoice\s+Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const dueDateMatch = text.match(/Due\s+Date[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);

    if (!invDateMatch || !dueDateMatch) {
      console.log(`⚠️  Could not find dates in PDF for invoice ${invoice.invoice_number}`);
      return null;
    }

    const newInvoiceDate = parseUSDate(invDateMatch[1]);
    const newDueDate = parseUSDate(dueDateMatch[1]);

    if (!newInvoiceDate || !newDueDate) {
      console.log(`❌ Failed to parse dates for invoice ${invoice.invoice_number}`);
      console.log(`   Raw dates: ${invDateMatch[1]} → ${dueDateMatch[1]}`);
      return null;
    }

    // Check if dates actually changed
    const oldInvDate = invoice.invoice_date ? invoice.invoice_date.toISOString().split('T')[0] : null;
    const oldDueDate = invoice.due_date ? invoice.due_date.toISOString().split('T')[0] : null;

    if (oldInvDate === newInvoiceDate && oldDueDate === newDueDate) {
      return { invoice_number: invoice.invoice_number, status: 'unchanged' };
    }

    console.log(`📝 Invoice ${invoice.invoice_number}:`);
    console.log(`   OLD: Invoice ${oldInvDate} → Due ${oldDueDate}`);
    console.log(`   NEW: Invoice ${newInvoiceDate} → Due ${newDueDate}`);

    return {
      invoice_number: invoice.invoice_number,
      old_invoice_date: oldInvDate,
      old_due_date: oldDueDate,
      new_invoice_date: newInvoiceDate,
      new_due_date: newDueDate,
      status: 'changed'
    };

  } catch (error) {
    console.error(`❌ Error processing invoice ${invoice.invoice_number}:`, error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('=== FIXING STRATEGIC ASIA PACIFIC PARTNERS DATES ===\n');

    // Get all Strategic Asia Pacific Partners invoices
    const result = await pool.query(`
      SELECT id, invoice_number, invoice_date, due_date, pdf_path, status
      FROM invoices
      WHERE client ILIKE '%Strategic Asia Pacific%'
      ORDER BY invoice_number
    `);

    console.log(`Found ${result.rows.length} invoices for Strategic Asia Pacific Partners\n`);

    const updates = [];
    let unchangedCount = 0;

    for (const invoice of result.rows) {
      const update = await fixInvoice(invoice);
      if (update) {
        if (update.status === 'changed') {
          updates.push(update);
        } else {
          unchangedCount++;
        }
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total invoices: ${result.rows.length}`);
    console.log(`Needs update: ${updates.length}`);
    console.log(`Already correct: ${unchangedCount}`);
    console.log(`Errors/not found: ${result.rows.length - updates.length - unchangedCount}`);

    if (updates.length === 0) {
      console.log('\n✅ No updates needed!');
      await pool.end();
      return;
    }

    // Ask for confirmation
    console.log(`\n⚠️  Ready to update ${updates.length} invoices in the database.`);
    console.log('Run with --apply flag to apply changes: node fix-strategic-dates.js --apply\n');

    if (process.argv.includes('--apply')) {
      console.log('Applying updates...\n');

      for (const update of updates) {
        await pool.query(
          `UPDATE invoices
           SET invoice_date = $1, due_date = $2, updated_at = NOW()
           WHERE invoice_number = $3`,
          [update.new_invoice_date, update.new_due_date, update.invoice_number]
        );
        console.log(`✅ Updated ${update.invoice_number}`);
      }

      console.log(`\n✅ Successfully updated ${updates.length} invoices!`);
    }

    await pool.end();

  } catch (error) {
    console.error('Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
