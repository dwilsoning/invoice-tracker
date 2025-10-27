const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixMilestoneInvoices() {
  try {
    console.log('\n=====================================');
    console.log('Finding Milestone Payment Invoices');
    console.log('=====================================\n');

    // More specific patterns that indicate milestone payments
    // Using regex to be more precise
    const query = `
      SELECT invoice_number, client, services, frequency
      FROM invoices
      WHERE frequency != 'adhoc'
        AND (
          services ~* '\\d+%.*payment'
          OR services ~* 'payment.*#\\d+'
          OR services ~* 'payment#\\d+'
          OR services ~* 'milestone.*\\d+'
          OR services ~* '\\d+.*milestone'
          OR services ~* 'payable upon (completion|delivery|the earlier)'
          OR services ~* 'first payment|second payment|third payment|final payment'
          OR services ~* '\\(\\d+%'
          OR services ~* 'payment \\d+ of \\d+'
        )
      ORDER BY client, invoice_number
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('✅ No milestone payment invoices found with non-adhoc frequency!');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} invoice(s) with milestone payments:\n`);

    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Invoice: ${row.invoice_number}`);
      console.log(`   Client: ${row.client}`);
      console.log(`   Current Frequency: ${row.frequency}`);
      const servicesPreview = row.services.length > 120 ? row.services.substring(0, 120) + '...' : row.services;
      console.log(`   Services: ${servicesPreview}`);
      console.log('');
    });

    console.log('=====================================');
    console.log('Updating to adhoc frequency...');
    console.log('=====================================\n');

    // Update all found invoices to adhoc
    const updateQuery = `
      UPDATE invoices
      SET frequency = 'adhoc'
      WHERE frequency != 'adhoc'
        AND (
          services ~* '\\d+%.*payment'
          OR services ~* 'payment.*#\\d+'
          OR services ~* 'payment#\\d+'
          OR services ~* 'milestone.*\\d+'
          OR services ~* '\\d+.*milestone'
          OR services ~* 'payable upon (completion|delivery|the earlier)'
          OR services ~* 'first payment|second payment|third payment|final payment'
          OR services ~* '\\(\\d+%'
          OR services ~* 'payment \\d+ of \\d+'
        )
    `;

    const updateResult = await pool.query(updateQuery);

    console.log(`✅ Updated ${updateResult.rowCount} invoice(s) to adhoc frequency`);

    console.log('\n=====================================');
    console.log('✅ Complete!');
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixMilestoneInvoices();
