const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function cleanDuplicateExpectedInvoices() {
  try {
    console.log('Starting cleanup of duplicate expected invoices...\n');

    // Find all expected invoices grouped by client, contract, invoice_type, and expected_date
    const result = await pool.query(`
      SELECT
        LOWER(TRIM(client)) as client_key,
        LOWER(TRIM(customer_contract)) as contract_key,
        LOWER(TRIM(invoice_type)) as type_key,
        expected_date,
        COUNT(*) as count,
        array_agg(id ORDER BY created_date DESC) as ids,
        array_agg(acknowledged ORDER BY created_date DESC) as ack_status
      FROM expected_invoices
      WHERE acknowledged = false
      GROUP BY
        LOWER(TRIM(client)),
        LOWER(TRIM(customer_contract)),
        LOWER(TRIM(invoice_type)),
        expected_date
      HAVING COUNT(*) > 1
    `);

    if (result.rows.length === 0) {
      console.log('✅ No duplicate expected invoices found!');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} sets of duplicate expected invoices:\n`);

    let totalDeleted = 0;

    for (const row of result.rows) {
      const ids = row.ids;
      const keepId = ids[0]; // Keep the most recent one
      const deleteIds = ids.slice(1); // Delete the rest

      console.log(`Contract: ${row.contract_key}`);
      console.log(`  Client: ${row.client_key}`);
      console.log(`  Type: ${row.type_key}`);
      console.log(`  Expected Date: ${row.expected_date}`);
      console.log(`  Total Count: ${row.count}`);
      console.log(`  Keeping ID: ${keepId}`);
      console.log(`  Deleting IDs: ${deleteIds.join(', ')}`);

      // Delete the duplicate records
      for (const deleteId of deleteIds) {
        await pool.query('DELETE FROM expected_invoices WHERE id = $1', [deleteId]);
        totalDeleted++;
      }

      console.log('  ✅ Deleted ' + deleteIds.length + ' duplicate(s)\n');
    }

    console.log(`\n========================================`);
    console.log(`✅ Cleanup complete!`);
    console.log(`   Total duplicates deleted: ${totalDeleted}`);
    console.log(`========================================`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error cleaning duplicate expected invoices:', error);
    await pool.end();
    process.exit(1);
  }
}

cleanDuplicateExpectedInvoices();
