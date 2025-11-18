require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  try {
    console.log('Running migration to add dismissed columns...');

    const sql = fs.readFileSync('./migrations/add-dismissed-columns.sql', 'utf8');
    await pool.query(sql);

    console.log('✓ Migration completed successfully');

    // Verify the columns were added
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'expected_invoices'
      AND column_name IN ('dismissed', 'dismissed_date')
      ORDER BY column_name
    `);

    console.log('\nNew columns:');
    console.table(result.rows);

  } catch (error) {
    console.error('Error running migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
