const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function findContractDuplicates() {
  try {
    console.log('\n=====================================');
    console.log('Finding Contract Duplicates');
    console.log('=====================================\n');

    // Group by client and contract only (ignoring type and date)
    const result = await pool.query(`
      SELECT
        LOWER(TRIM(client)) as client_key,
        LOWER(TRIM(customer_contract)) as contract_key,
        array_agg(id ORDER BY created_date DESC, expected_date DESC) as ids,
        array_agg(invoice_type ORDER BY created_date DESC, expected_date DESC) as types,
        array_agg(expected_date ORDER BY created_date DESC, expected_date DESC) as dates,
        array_agg(created_date ORDER BY created_date DESC, expected_date DESC) as created_dates,
        COUNT(*) as count
      FROM expected_invoices
      WHERE acknowledged = false
      GROUP BY
        LOWER(TRIM(client)),
        LOWER(TRIM(customer_contract))
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (result.rows.length === 0) {
      console.log('✅ No contracts with multiple expected invoices found!');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} contracts with multiple expected invoices:\n`);

    result.rows.forEach(row => {
      console.log(`Contract: ${row.contract_key}`);
      console.log(`  Client: ${row.client_key}`);
      console.log(`  Total entries: ${row.count}`);
      console.log(`  IDs:`);

      for (let i = 0; i < row.ids.length; i++) {
        console.log(`    ${i + 1}. ID: ${row.ids[i]}`);
        console.log(`       Type: ${row.types[i]}`);
        console.log(`       Expected: ${row.dates[i]}`);
        console.log(`       Created: ${row.created_dates[i]}`);
      }
      console.log('');
    });

    console.log('=====================================');
    console.log('Analysis Complete');
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

findContractDuplicates();
