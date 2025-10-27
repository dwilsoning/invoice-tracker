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

    // Patterns that indicate milestone payments
    const milestonePatterns = [
      'payment #',
      'payment#',
      'milestone',
      '% payment',
      '%payment',
      '% -',
      'upon completion',
      'payable upon',
      'first payment',
      'second payment',
      'third payment',
      'final payment',
      'initial payment',
      'deposit payment'
    ];

    // Build SQL query to find invoices with milestone keywords
    const patternConditions = milestonePatterns.map(() => 'LOWER(services) LIKE ?').join(' OR ');
    const patternValues = milestonePatterns.map(p => `%${p.toLowerCase()}%`);

    // For PostgreSQL, use $1, $2, etc. and ILIKE instead of LIKE
    const pgPatternConditions = milestonePatterns.map((_, i) => `services ILIKE $${i + 1}`).join(' OR ');

    const query = `
      SELECT invoice_number, client, services, frequency
      FROM invoices
      WHERE frequency != 'adhoc'
        AND (${pgPatternConditions})
      ORDER BY client, invoice_number
    `;

    const result = await pool.query(query, patternValues);

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
      console.log(`   Services: ${row.services.substring(0, 100)}...`);
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
        AND (${pgPatternConditions})
    `;

    const updateResult = await pool.query(updateQuery, patternValues);

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
