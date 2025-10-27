require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    // Read discrepancies file
    const discrepancies = JSON.parse(
      fs.readFileSync('date-discrepancies.json', 'utf8')
    );

    console.log('=== Fixing Date Discrepancies ===\n');
    console.log(`Found ${discrepancies.length} invoices to fix\n`);

    let fixed = 0;
    let errors = 0;

    for (const disc of discrepancies) {
      try {
        // Build update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (disc.invoice_date_mismatch && disc.pdf_invoice_date) {
          updates.push(`invoice_date = $${paramCount}`);
          values.push(disc.pdf_invoice_date);
          paramCount++;
        }

        if (disc.due_date_mismatch && disc.pdf_due_date) {
          updates.push(`due_date = $${paramCount}`);
          values.push(disc.pdf_due_date);
          paramCount++;
        }

        if (updates.length === 0) continue;

        values.push(disc.invoice_number);
        const sql = `
          UPDATE invoices
          SET ${updates.join(', ')}
          WHERE invoice_number = $${paramCount}
        `;

        await pool.query(sql, values);

        console.log(`✓ Fixed ${disc.invoice_number}`);
        if (disc.invoice_date_mismatch) {
          console.log(`  Invoice Date: ${disc.db_invoice_date} → ${disc.pdf_invoice_date}`);
        }
        if (disc.due_date_mismatch) {
          console.log(`  Due Date: ${disc.db_due_date} → ${disc.pdf_due_date}`);
        }
        console.log('');

        fixed++;
      } catch (error) {
        console.error(`✗ Error fixing ${disc.invoice_number}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total invoices fixed: ${fixed}`);
    console.log(`Errors: ${errors}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
