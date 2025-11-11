#!/usr/bin/env node

/**
 * Invoice Tracker - Data Migration Script
 * 
 * Migrates all data from local PostgreSQL database to EC2 instance
 * Preserves all records including invoices, contracts, users, etc.
 * 
 * Usage:
 *   node migrate-data-to-ec2.js
 * 
 * Prerequisites:
 *   - Local database has data to migrate
 *   - Target EC2 database has schema deployed (deploy-schema-to-ec2.js)
 *   - .env file configured with SOURCE_DB and TARGET_DB credentials
 */

const { Pool } = require('pg');
require('dotenv').config();

// Source database (local)
const sourcePool = new Pool({
  host: process.env.SOURCE_DB_HOST || 'localhost',
  port: process.env.SOURCE_DB_PORT || 5432,
  database: process.env.SOURCE_DB_NAME || 'invoice_tracker',
  user: process.env.SOURCE_DB_USER || 'invoice_tracker_user',
  password: process.env.SOURCE_DB_PASSWORD,
});

// Target database (EC2)
const targetPool = new Pool({
  host: process.env.DB_HOST || 'ec2-instance-ip',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

/**
 * Migrate data from source to target database
 */
async function migrateData() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Invoice Tracker - Data Migration to EC2               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Test connections
  try {
    const sourceClient = await sourcePool.connect();
    console.log('✓ Connected to source database (local)');
    sourceClient.release();
  } catch (error) {
    console.error('✗ Failed to connect to source database:', error.message);
    process.exit(1);
  }

  try {
    const targetClient = await targetPool.connect();
    console.log('✓ Connected to target database (EC2)');
    targetClient.release();
  } catch (error) {
    console.error('✗ Failed to connect to target database:', error.message);
    process.exit(1);
  }

  console.log('\n');

  const tables = [
    { name: 'users', count: 0 },
    { name: 'contracts', count: 0 },
    { name: 'invoices', count: 0 },
    { name: 'invoice_attachments', count: 0 },
    { name: 'expected_invoices', count: 0 },
    { name: 'dismissed_expected_invoices', count: 0 },
    { name: 'password_reset_tokens', count: 0 }
  ];

  let totalMigrated = 0;
  let failureCount = 0;

  // Migrate each table
  for (const table of tables) {
    try {
      console.log(`⏳ Migrating ${table.name}...`);

      // Get data from source
      const sourceResult = await sourcePool.query(`SELECT * FROM ${table.name}`);
      const rows = sourceResult.rows;
      table.count = rows.length;

      if (rows.length === 0) {
        console.log(`   ℹ  No data to migrate\n`);
        continue;
      }

      // Disable foreign key checks temporarily
      await targetPool.query('SET session_replication_role = replica');

      // Insert data into target
      if (table.name === 'users') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, last_login, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.email, row.password_hash, row.first_name, row.last_name, row.role, row.is_active, row.last_login, row.created_at, row.updated_at]
          );
        }
      } else if (table.name === 'contracts') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO contracts (id, contract_name, contract_value, currency, created_date, updated_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.contract_name, row.contract_value, row.currency, row.created_date, row.updated_date, row.created_at, row.updated_at]
          );
        }
      } else if (table.name === 'invoices') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO invoices 
             (id, invoice_number, invoice_date, client, customer_contract, oracle_contract, po_number, invoice_type, 
              amount_due, currency, due_date, status, payment_date, frequency, upload_date, services, 
              pdf_path, pdf_original_name, contract_value, contract_currency, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.invoice_number, row.invoice_date, row.client, row.customer_contract, row.oracle_contract, 
             row.po_number, row.invoice_type, row.amount_due, row.currency, row.due_date, row.status, row.payment_date, 
             row.frequency, row.upload_date, row.services, row.pdf_path, row.pdf_original_name, row.contract_value, 
             row.contract_currency, row.notes, row.created_at, row.updated_at]
          );
        }
      } else if (table.name === 'invoice_attachments') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO invoice_attachments (id, invoice_id, file_name, original_name, file_path, file_size, mime_type, uploaded_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.invoice_id, row.file_name, row.original_name, row.file_path, row.file_size, row.mime_type, row.uploaded_at]
          );
        }
      } else if (table.name === 'expected_invoices') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO expected_invoices 
             (id, client, customer_contract, invoice_type, expected_amount, currency, expected_date, frequency, 
              last_invoice_number, last_invoice_date, acknowledged, acknowledged_date, created_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.client, row.customer_contract, row.invoice_type, row.expected_amount, row.currency, 
             row.expected_date, row.frequency, row.last_invoice_number, row.last_invoice_date, row.acknowledged, 
             row.acknowledged_date, row.created_date, row.created_at, row.updated_at]
          );
        }
      } else if (table.name === 'dismissed_expected_invoices') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO dismissed_expected_invoices (id, client, customer_contract, invoice_type, expected_date, dismissed_date, dismissed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.client, row.customer_contract, row.invoice_type, row.expected_date, row.dismissed_date, row.dismissed_by, row.created_at]
          );
        }
      } else if (table.name === 'password_reset_tokens') {
        for (const row of rows) {
          await targetPool.query(
            `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [row.id, row.user_id, row.token, row.expires_at, row.used, row.created_at]
          );
        }
      }

      // Re-enable foreign key checks
      await targetPool.query('SET session_replication_role = default');

      console.log(`✓ Migrated ${table.name}: ${rows.length} rows\n`);
      totalMigrated += rows.length;
    } catch (error) {
      console.error(`✗ Failed to migrate ${table.name}:`, error.message);
      console.log('');
      failureCount++;
      
      try {
        await targetPool.query('SET session_replication_role = default');
      } catch (e) {
        // Ignore re-enable errors
      }
    }
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    MIGRATION SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  tables.forEach(table => {
    console.log(`✓ ${table.name.padEnd(30)} : ${table.count} rows`);
  });

  console.log('\n');
  console.log(`Total rows migrated: ${totalMigrated}`);
  console.log(`Failed tables: ${failureCount}\n`);

  if (failureCount === 0) {
    console.log('✓ Migration COMPLETE! All data successfully migrated to EC2.\n');
  } else {
    console.log('⚠ Migration completed with errors. Review the errors above.\n');
  }

  await sourcePool.end();
  await targetPool.end();
}

// Run migration
migrateData().catch(error => {
  console.error('Fatal error during migration:', error);
  process.exit(1);
});
