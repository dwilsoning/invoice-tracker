require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function createDismissalTable() {
  try {
    console.log('Creating dismissed_expected_invoices table...');

    // Create table to track dismissed expected invoices
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dismissed_expected_invoices (
        id SERIAL PRIMARY KEY,
        client VARCHAR(255) NOT NULL,
        customer_contract VARCHAR(255),
        invoice_type VARCHAR(100),
        expected_date DATE NOT NULL,
        dismissed_date DATE NOT NULL DEFAULT CURRENT_DATE,
        dismissed_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client, customer_contract, invoice_type, expected_date)
      )
    `);

    console.log('✓ dismissed_expected_invoices table created successfully');

    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_dismissed_lookup
      ON dismissed_expected_invoices(client, customer_contract, invoice_type, expected_date)
    `);

    console.log('✓ Index created successfully');

    // Verify table was created
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dismissed_expected_invoices'
      ORDER BY ordinal_position
    `);

    console.log('\nTable structure:');
    console.table(result.rows);

  } catch (error) {
    console.error('Error creating dismissal table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createDismissalTable();
