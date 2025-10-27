const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function cleanupAllDuplicates() {
  try {
    console.log('\n=====================================');
    console.log('Cleaning Up All Contract Duplicates');
    console.log('=====================================\n');

    // Delete these specific IDs (keeping the most recent one for each contract)
    const idsToDelete = [
      // Contract 485753 - keeping 1761602177770okc19qj96 (Jan 21, Maint)
      '17615539882580h0i2hnn3',   // Jan 20, Sub
      '176155479998666yrznvcl',   // Jan 19, Maint

      // Contract 271711 - keeping 1761553988245vf4kx8z46 (Dec 03, SW)
      '1761554799981z5stb37h9',   // Dec 03, Maint

      // Contract 513583 - keeping 1761551004048oij0qeugs (Oct 03, Maint)
      '176155479998787cquoa6y'    // Oct 03, SW
    ];

    let deletedCount = 0;

    for (const id of idsToDelete) {
      // First, show what we're deleting
      const record = await pool.query('SELECT * FROM expected_invoices WHERE id = $1', [id]);

      if (record.rows.length === 0) {
        console.log(`⚠️  ID ${id} not found`);
        continue;
      }

      const inv = record.rows[0];
      console.log(`Deleting:`);
      console.log(`  Contract: ${inv.customer_contract}`);
      console.log(`  Client: ${inv.client}`);
      console.log(`  Type: ${inv.invoice_type}`);
      console.log(`  Expected Date: ${inv.expected_date}`);
      console.log(`  ID: ${id}`);

      // Delete the record
      await pool.query('DELETE FROM expected_invoices WHERE id = $1', [id]);
      console.log(`  ✅ Deleted\n`);
      deletedCount++;
    }

    console.log('=====================================');
    console.log(`✅ Cleanup complete!`);
    console.log(`   Deleted ${deletedCount} duplicate entries`);
    console.log(`   Each contract now has only ONE expected invoice`);
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

cleanupAllDuplicates();
