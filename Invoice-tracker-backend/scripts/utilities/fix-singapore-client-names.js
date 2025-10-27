const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixClientNames() {
  try {
    console.log('\n=====================================');
    console.log('Fixing Singapore Client Names');
    console.log('=====================================\n');

    const correctName = 'Singapore General Health Services Pte Ltd';
    const incorrectNames = [
      'Singapore Health Services Pte Ltd',
      'Singapore General Hospital Pte Ltd'
    ];

    // Update invoices table
    console.log('Updating invoices table...');
    for (const incorrectName of incorrectNames) {
      const result = await pool.query(
        'UPDATE invoices SET client = $1 WHERE client = $2',
        [correctName, incorrectName]
      );
      console.log(`  ✅ Updated ${result.rowCount} invoices from "${incorrectName}"`);
    }

    // Update expected_invoices table
    console.log('\nUpdating expected_invoices table...');
    for (const incorrectName of incorrectNames) {
      const result = await pool.query(
        'UPDATE expected_invoices SET client = $1 WHERE client = $2',
        [correctName, incorrectName]
      );
      console.log(`  ✅ Updated ${result.rowCount} expected invoices from "${incorrectName}"`);
    }

    // Now check for duplicate expected invoices with the same client+contract
    console.log('\nChecking for duplicates after merge...');
    const duplicates = await pool.query(`
      SELECT
        client,
        customer_contract,
        array_agg(id ORDER BY expected_date DESC) as ids,
        array_agg(expected_date ORDER BY expected_date DESC) as dates,
        COUNT(*) as cnt
      FROM expected_invoices
      WHERE acknowledged = false
        AND customer_contract = '485753'
      GROUP BY client, customer_contract
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log(`  Found ${duplicates.rows.length} duplicate(s)`);

      for (const dup of duplicates.rows) {
        console.log(`\n  Contract: ${dup.customer_contract}`);
        console.log(`  Client: ${dup.client}`);
        console.log(`  Entries: ${dup.cnt}`);

        // Keep the first one (most recent date), delete the rest
        const keepId = dup.ids[0];
        const deleteIds = dup.ids.slice(1);

        console.log(`  Keeping: ${keepId} (${dup.dates[0]})`);
        console.log(`  Deleting: ${deleteIds.join(', ')}`);

        for (const deleteId of deleteIds) {
          await pool.query('DELETE FROM expected_invoices WHERE id = $1', [deleteId]);
        }
        console.log(`  ✅ Deleted ${deleteIds.length} duplicate(s)`);
      }
    } else {
      console.log('  ✅ No duplicates found!');
    }

    console.log('\n=====================================');
    console.log('✅ Client names fixed!');
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixClientNames();
