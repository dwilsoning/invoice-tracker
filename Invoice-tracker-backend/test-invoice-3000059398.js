const { Pool } = require('pg');

const pool = new Pool({
  user: 'invoiceuser',
  host: 'localhost',
  database: 'invoicetracker',
  password: 'invoicepass',
  port: 5432,
});

async function checkInvoice() {
  try {
    // Check if this invoice appears in duplicates
    const result = await pool.query(`
      SELECT invoice_number, client, invoice_date, id
      FROM invoices
      WHERE invoice_number = '3000059398'
      ORDER BY invoice_date
    `);

    console.log('Found invoices with number 3000059398:');
    console.table(result.rows);

    // Check if they have different dates
    if (result.rows.length > 1) {
      const dates = result.rows.map(r => r.invoice_date);
      const uniqueDates = [...new Set(dates)];
      console.log('\nUnique invoice dates:', uniqueDates);
      console.log('These should NOT be flagged as duplicates because they have different dates');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkInvoice();
