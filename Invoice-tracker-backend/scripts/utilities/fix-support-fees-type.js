const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixSupportFeesType() {
  try {
    console.log('\n=====================================');
    console.log('Fixing Support Fees Invoice Types');
    console.log('=====================================\n');

    // Find SW invoices with support fees/services that should be Maint
    const result = await pool.query(`
      SELECT invoice_number, client, services, invoice_type
      FROM invoices
      WHERE invoice_type != 'Maint'
        AND (
          services ILIKE '%support fee%'
          OR services ILIKE '%support service%'
          OR services ILIKE '%software support%'
          OR services ILIKE '%maintenance fee%'
        )
        AND NOT services ILIKE '%professional%'
        AND NOT services ILIKE '%managed%'
      ORDER BY client, invoice_number
    `);

    if (result.rows.length === 0) {
      console.log('✅ No invoices to fix!');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} invoice(s) with support/maintenance that should be Maint:\n`);

    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Invoice: ${row.invoice_number}`);
      console.log(`   Client: ${row.client.substring(0, 40)}`);
      console.log(`   Current Type: ${row.invoice_type}`);
      const servicesPreview = row.services.length > 80 ? row.services.substring(0, 80) + '...' : row.services;
      console.log(`   Services: ${servicesPreview}`);
      console.log('');
    });

    console.log('=====================================');
    console.log('Updating to Maint type...');
    console.log('=====================================\n');

    // Update all found invoices to Maint
    const updateResult = await pool.query(`
      UPDATE invoices
      SET invoice_type = 'Maint'
      WHERE invoice_type != 'Maint'
        AND (
          services ILIKE '%support fee%'
          OR services ILIKE '%support service%'
          OR services ILIKE '%software support%'
          OR services ILIKE '%maintenance fee%'
        )
        AND NOT services ILIKE '%professional%'
        AND NOT services ILIKE '%managed%'
    `);

    console.log(`✅ Updated ${updateResult.rowCount} invoice(s) to Maint type`);

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

fixSupportFeesType();
