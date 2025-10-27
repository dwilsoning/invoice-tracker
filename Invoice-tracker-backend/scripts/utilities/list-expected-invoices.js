const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function listExpectedInvoices() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        client,
        customer_contract,
        invoice_type,
        expected_date,
        expected_amount,
        currency,
        acknowledged,
        created_date
      FROM expected_invoices
      ORDER BY expected_date DESC, client, customer_contract, invoice_type
    `);

    console.log('\n=====================================');
    console.log('Expected Invoices');
    console.log('=====================================\n');

    if (result.rows.length === 0) {
      console.log('No expected invoices found.');
      await pool.end();
      return;
    }

    const unacknowledged = result.rows.filter(r => !r.acknowledged);
    const acknowledged = result.rows.filter(r => r.acknowledged);

    console.log(`UNACKNOWLEDGED (${unacknowledged.length}):\n`);
    unacknowledged.forEach(row => {
      console.log(`  ${row.client} - ${row.customer_contract || '(no contract)'}`);
      console.log(`    Type: ${row.invoice_type}`);
      console.log(`    Expected: ${row.expected_date}`);
      console.log(`    Amount: ${row.expected_amount} ${row.currency}`);
      console.log(`    Created: ${row.created_date}`);
      console.log(`    ID: ${row.id}`);
      console.log('');
    });

    console.log(`\nACKNOWLEDGED (${acknowledged.length}):\n`);
    acknowledged.forEach(row => {
      console.log(`  ${row.client} - ${row.customer_contract || '(no contract)'}`);
      console.log(`    Type: ${row.invoice_type}`);
      console.log(`    Expected: ${row.expected_date}`);
      console.log(`    Created: ${row.created_date}`);
      console.log('');
    });

    // Check for potential duplicates
    console.log('\n=====================================');
    console.log('Checking for Duplicates');
    console.log('=====================================\n');

    const groupKey = {};
    let foundDuplicates = false;

    result.rows.forEach(row => {
      const key = `${row.client.toLowerCase().trim()}-${(row.customer_contract || '').toLowerCase().trim()}-${row.invoice_type.toLowerCase().trim()}-${row.expected_date}`;
      if (!groupKey[key]) {
        groupKey[key] = [];
      }
      groupKey[key].push(row);
    });

    Object.entries(groupKey).forEach(([key, rows]) => {
      if (rows.length > 1) {
        foundDuplicates = true;
        console.log(`⚠️  DUPLICATE FOUND:`);
        console.log(`    Client: ${rows[0].client}`);
        console.log(`    Contract: ${rows[0].customer_contract || '(no contract)'}`);
        console.log(`    Type: ${rows[0].invoice_type}`);
        console.log(`    Expected Date: ${rows[0].expected_date}`);
        console.log(`    Count: ${rows.length}`);
        console.log(`    IDs: ${rows.map(r => r.id).join(', ')}`);
        console.log('');
      }
    });

    if (!foundDuplicates) {
      console.log('✅ No duplicates found!');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

listExpectedInvoices();
