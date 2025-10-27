const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sqliteDbPath = path.join(__dirname, 'invoices.db');

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

async function migrateSQLiteToPostgres() {
  try {
    console.log('Starting migration from SQLite to PostgreSQL...\n');

    // Check if SQLite database exists
    if (!fs.existsSync(sqliteDbPath)) {
      console.error('❌ SQLite database not found at:', sqliteDbPath);
      console.log('Please ensure invoices.db exists before running migration.');
      process.exit(1);
    }

    // Load SQLite database
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(sqliteDbPath);
    const sqliteDb = new SQL.Database(buffer);
    console.log('✓ Loaded SQLite database');

    // Test PostgreSQL connection
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL database\n');

    // Migrate invoices table
    console.log('Migrating invoices table...');
    const invoicesStmt = sqliteDb.prepare('SELECT * FROM invoices');
    const invoices = [];
    while (invoicesStmt.step()) {
      invoices.push(invoicesStmt.getAsObject());
    }
    invoicesStmt.free();

    for (const invoice of invoices) {
      await pool.query(`
        INSERT INTO invoices (
          id, invoice_number, invoice_date, client, customer_contract,
          oracle_contract, po_number, invoice_type, amount_due, currency,
          due_date, status, payment_date, frequency, upload_date,
          services, pdf_path, pdf_original_name, contract_value,
          contract_currency, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (id) DO UPDATE SET
          invoice_number = EXCLUDED.invoice_number,
          invoice_date = EXCLUDED.invoice_date,
          client = EXCLUDED.client,
          customer_contract = EXCLUDED.customer_contract,
          oracle_contract = EXCLUDED.oracle_contract,
          po_number = EXCLUDED.po_number,
          invoice_type = EXCLUDED.invoice_type,
          amount_due = EXCLUDED.amount_due,
          currency = EXCLUDED.currency,
          due_date = EXCLUDED.due_date,
          status = EXCLUDED.status,
          payment_date = EXCLUDED.payment_date,
          frequency = EXCLUDED.frequency,
          upload_date = EXCLUDED.upload_date,
          services = EXCLUDED.services,
          pdf_path = EXCLUDED.pdf_path,
          pdf_original_name = EXCLUDED.pdf_original_name,
          contract_value = EXCLUDED.contract_value,
          contract_currency = EXCLUDED.contract_currency,
          notes = EXCLUDED.notes
      `, [
        invoice.id,
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.client,
        invoice.customerContract,
        invoice.oracleContract,
        invoice.poNumber,
        invoice.invoiceType,
        invoice.amountDue,
        invoice.currency,
        invoice.dueDate,
        invoice.status,
        invoice.paymentDate,
        invoice.frequency,
        invoice.uploadDate,
        invoice.services,
        invoice.pdfPath,
        invoice.pdfOriginalName,
        invoice.contractValue,
        invoice.contractCurrency,
        invoice.notes
      ]);
    }
    console.log(`✓ Migrated ${invoices.length} invoices`);

    // Migrate expected_invoices table
    console.log('\nMigrating expected_invoices table...');
    const expectedStmt = sqliteDb.prepare('SELECT * FROM expected_invoices');
    const expectedInvoices = [];
    while (expectedStmt.step()) {
      expectedInvoices.push(expectedStmt.getAsObject());
    }
    expectedStmt.free();

    for (const exp of expectedInvoices) {
      await pool.query(`
        INSERT INTO expected_invoices (
          id, client, customer_contract, invoice_type, expected_amount,
          currency, expected_date, frequency, last_invoice_number,
          last_invoice_date, acknowledged, acknowledged_date, created_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          client = EXCLUDED.client,
          customer_contract = EXCLUDED.customer_contract,
          invoice_type = EXCLUDED.invoice_type,
          expected_amount = EXCLUDED.expected_amount,
          currency = EXCLUDED.currency,
          expected_date = EXCLUDED.expected_date,
          frequency = EXCLUDED.frequency,
          last_invoice_number = EXCLUDED.last_invoice_number,
          last_invoice_date = EXCLUDED.last_invoice_date,
          acknowledged = EXCLUDED.acknowledged,
          acknowledged_date = EXCLUDED.acknowledged_date,
          created_date = EXCLUDED.created_date
      `, [
        exp.id,
        exp.client,
        exp.customerContract,
        exp.invoiceType,
        exp.expectedAmount,
        exp.currency,
        exp.expectedDate,
        exp.frequency,
        exp.lastInvoiceNumber,
        exp.lastInvoiceDate,
        exp.acknowledged === 1,
        exp.acknowledgedDate,
        exp.createdDate
      ]);
    }
    console.log(`✓ Migrated ${expectedInvoices.length} expected invoices`);

    // Migrate contracts table
    console.log('\nMigrating contracts table...');
    const contractsStmt = sqliteDb.prepare('SELECT * FROM contracts');
    const contracts = [];
    while (contractsStmt.step()) {
      contracts.push(contractsStmt.getAsObject());
    }
    contractsStmt.free();

    for (const contract of contracts) {
      await pool.query(`
        INSERT INTO contracts (
          id, contract_name, contract_value, currency, created_date, updated_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          contract_name = EXCLUDED.contract_name,
          contract_value = EXCLUDED.contract_value,
          currency = EXCLUDED.currency,
          created_date = EXCLUDED.created_date,
          updated_date = EXCLUDED.updated_date
      `, [
        contract.id,
        contract.contractName,
        contract.contractValue,
        contract.currency,
        contract.createdDate,
        contract.updatedDate
      ]);
    }
    console.log(`✓ Migrated ${contracts.length} contracts`);

    sqliteDb.close();
    await pool.end();

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Stop your current server');
    console.log('2. Update your server to use server-postgres.js');
    console.log('3. Restart the server with: node server-postgres.js');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
console.log('=====================================');
console.log('SQLite to PostgreSQL Migration Tool');
console.log('=====================================\n');

migrateSQLiteToPostgres();
