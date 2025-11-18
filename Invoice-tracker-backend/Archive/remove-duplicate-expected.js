require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    console.log('=== Removing Duplicate Expected Invoices ===\n');

    // Get all expected invoices
    const result = await pool.query(`
      SELECT id, client, customer_contract, invoice_type, expected_date, frequency
      FROM expected_invoices
      ORDER BY client, customer_contract, invoice_type, expected_date
    `);

    console.log(`Found ${result.rows.length} expected invoices\n`);

    // Group by client, contract, type, frequency to find duplicates
    const groups = {};

    for (const invoice of result.rows) {
      const key = `${invoice.client}-${invoice.customer_contract || 'none'}-${invoice.invoice_type}-${invoice.frequency}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(invoice);
    }

    let removed = 0;
    let kept = 0;

    // For each group, keep only the earliest date and remove others
    for (const key in groups) {
      const invoices = groups[key];

      if (invoices.length > 1) {
        // Sort by expected_date
        invoices.sort((a, b) => new Date(a.expected_date) - new Date(b.expected_date));

        // Keep the first one (earliest date)
        kept++;
        console.log(`✓ Keeping: ${invoices[0].client} - Contract ${invoices[0].customer_contract}`);
        console.log(`  Expected Date: ${invoices[0].expected_date}`);

        // Remove the rest
        for (let i = 1; i < invoices.length; i++) {
          console.log(`  ✗ Removing duplicate with date: ${invoices[i].expected_date}`);
          await pool.query('DELETE FROM expected_invoices WHERE id = $1', [invoices[i].id]);
          removed++;
        }
        console.log('');
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total expected invoices kept: ${result.rows.length - removed}`);
    console.log(`Duplicates removed: ${removed}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
