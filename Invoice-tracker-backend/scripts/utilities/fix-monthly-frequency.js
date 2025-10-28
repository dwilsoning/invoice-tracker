const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixMonthlyFrequency() {
  try {
    console.log('\n=====================================');
    console.log('Fixing Monthly Frequency Invoices');
    console.log('=====================================\n');

    // Find invoices with "monthly" in description but not set to monthly frequency
    // Exclude those that have milestone payment indicators
    const result = await pool.query(`
      SELECT invoice_number, client, services, frequency
      FROM invoices
      WHERE frequency != 'monthly'
        AND services ILIKE '%monthly%'
        AND NOT (
          services ~* '\\d+%.*payment'
          OR services ~* 'payment.*#\\d+'
          OR services ~* 'payment#\\d+'
          OR services ~* 'milestone'
          OR services ~* 'payable upon (completion|delivery|the earlier)'
        )
      ORDER BY client, invoice_number
    `);

    if (result.rows.length === 0) {
      console.log('✅ No invoices to fix!');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} invoice(s) with monthly description:\n`);

    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Invoice: ${row.invoice_number}`);
      console.log(`   Client: ${row.client}`);
      console.log(`   Current Frequency: ${row.frequency}`);
      const servicesPreview = row.services.length > 100 ? row.services.substring(0, 100) + '...' : row.services;
      console.log(`   Services: ${servicesPreview}`);
      console.log('');
    });

    console.log('=====================================');
    console.log('Updating to monthly frequency...');
    console.log('=====================================\n');

    // Update all found invoices to monthly
    const updateResult = await pool.query(`
      UPDATE invoices
      SET frequency = 'monthly'
      WHERE frequency != 'monthly'
        AND services ILIKE '%monthly%'
        AND NOT (
          services ~* '\\d+%.*payment'
          OR services ~* 'payment.*#\\d+'
          OR services ~* 'payment#\\d+'
          OR services ~* 'milestone'
          OR services ~* 'payable upon (completion|delivery|the earlier)'
        )
    `);

    console.log(`✅ Updated ${updateResult.rowCount} invoice(s) to monthly frequency`);

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

fixMonthlyFrequency();
