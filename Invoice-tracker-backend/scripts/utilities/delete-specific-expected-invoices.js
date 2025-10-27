const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function deleteExpectedInvoices() {
  try {
    // IDs to delete - keeping the most recent expected date for each contract
    const idsToDelete = [
      '1761554799987vqtehbsc3', // South Australia Health - 541577 - Oct 22 (keeping Oct 24)
      '1761553988269f9wuoi6tq'  // Western Australia Dept - 447804 - Jul 27 (keeping Aug 27)
    ];

    console.log('\n=====================================');
    console.log('Deleting Duplicate Expected Invoices');
    console.log('=====================================\n');

    for (const id of idsToDelete) {
      // First, show what we're deleting
      const record = await pool.query('SELECT * FROM expected_invoices WHERE id = $1', [id]);

      if (record.rows.length === 0) {
        console.log(`⚠️  ID ${id} not found`);
        continue;
      }

      const inv = record.rows[0];
      console.log(`Deleting:`);
      console.log(`  ID: ${id}`);
      console.log(`  Client: ${inv.client}`);
      console.log(`  Contract: ${inv.customer_contract}`);
      console.log(`  Type: ${inv.invoice_type}`);
      console.log(`  Expected Date: ${inv.expected_date}`);

      // Delete the record
      await pool.query('DELETE FROM expected_invoices WHERE id = $1', [id]);
      console.log(`  ✅ Deleted\n`);
    }

    console.log('=====================================');
    console.log(`✅ Cleanup complete! Deleted ${idsToDelete.length} duplicates`);
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

deleteExpectedInvoices();
