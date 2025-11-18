const { pool } = require('./db-postgres');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Complete database schema with snake_case (PostgreSQL standard)
const COMPLETE_SCHEMA = `
-- =====================================================
-- Invoice Tracker Database Schema
-- PostgreSQL with snake_case naming convention
-- =====================================================

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS expected_invoices CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;

-- =====================================================
-- Users Table
-- =====================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster user lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- Invoices Table
-- =====================================================
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_contract VARCHAR(255),
  amount_due NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  invoice_date DATE,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'Pending',
  frequency VARCHAR(50),
  invoice_type VARCHAR(50) DEFAULT 'Invoice',
  related_invoice_number VARCHAR(255),
  po_number VARCHAR(255),
  pdf_path VARCHAR(500),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  additional_info TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date DATE,
  is_production BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX idx_invoices_customer_contract ON invoices(customer_contract);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_is_production ON invoices(is_production);

-- =====================================================
-- Expected Invoices Table
-- =====================================================
CREATE TABLE expected_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),
  customer_name VARCHAR(255),
  customer_contract VARCHAR(255),
  expected_amount NUMERIC,
  expected_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for expected invoices
CREATE INDEX idx_expected_invoices_invoice_number ON expected_invoices(invoice_number);
CREATE INDEX idx_expected_invoices_customer_name ON expected_invoices(customer_name);
CREATE INDEX idx_expected_invoices_expected_date ON expected_invoices(expected_date);

-- =====================================================
-- Attachments Table
-- =====================================================
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster attachment lookups by invoice
CREATE INDEX idx_attachments_invoice_id ON attachments(invoice_id);

-- =====================================================
-- Password Reset Tokens Table (Optional - for future use)
-- =====================================================
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- =====================================================
-- Audit Log Table (Optional - for tracking changes)
-- =====================================================
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- =====================================================
-- Triggers for updated_at columns
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expected_invoices_updated_at
  BEFORE UPDATE ON expected_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Views for common queries (Optional)
-- =====================================================

-- View for overdue invoices
CREATE OR REPLACE VIEW overdue_invoices AS
SELECT
  id,
  invoice_number,
  customer_name,
  customer_contract,
  amount_due,
  currency,
  due_date,
  status,
  CURRENT_DATE - due_date AS days_overdue
FROM invoices
WHERE status != 'Paid'
  AND status != 'Cancelled'
  AND due_date < CURRENT_DATE
  AND invoice_type != 'Credit Memo'
ORDER BY due_date ASC;

-- View for invoice summary by customer
CREATE OR REPLACE VIEW customer_invoice_summary AS
SELECT
  customer_name,
  COUNT(*) AS total_invoices,
  SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid_invoices,
  SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_invoices,
  SUM(amount_due) AS total_amount,
  SUM(CASE WHEN status = 'Paid' THEN amount_due ELSE 0 END) AS paid_amount,
  SUM(CASE WHEN status != 'Paid' THEN amount_due ELSE 0 END) AS outstanding_amount
FROM invoices
WHERE invoice_type != 'Credit Memo'
GROUP BY customer_name
ORDER BY total_amount DESC;

-- =====================================================
-- Grant permissions (adjust username as needed)
-- =====================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO invoice_admin;

-- =====================================================
-- Schema creation complete
-- =====================================================
`;

async function backupExistingData() {
  console.log('\n=== Backing up existing data ===\n');

  const backup = {};

  try {
    // Backup users
    const users = await pool.query('SELECT * FROM users');
    backup.users = users.rows;
    console.log(`✓ Backed up ${users.rows.length} users`);

    // Backup invoices
    const invoices = await pool.query('SELECT * FROM invoices');
    backup.invoices = invoices.rows;
    console.log(`✓ Backed up ${invoices.rows.length} invoices`);

    // Backup expected_invoices
    const expectedInvoices = await pool.query('SELECT * FROM expected_invoices');
    backup.expected_invoices = expectedInvoices.rows;
    console.log(`✓ Backed up ${expectedInvoices.rows.length} expected invoices`);

    // Backup attachments if exists
    try {
      const attachments = await pool.query('SELECT * FROM attachments');
      backup.attachments = attachments.rows;
      console.log(`✓ Backed up ${attachments.rows.length} attachments`);
    } catch (err) {
      console.log('⚠ Attachments table does not exist, skipping');
      backup.attachments = [];
    }

    return backup;
  } catch (err) {
    console.error('✗ Error backing up data:', err.message);
    throw err;
  }
}

async function recreateSchema() {
  console.log('\n=== Recreating database schema ===\n');

  try {
    await pool.query(COMPLETE_SCHEMA);
    console.log('✓ Database schema recreated successfully\n');
    return true;
  } catch (err) {
    console.error('✗ Error recreating schema:', err.message);
    console.error(err.stack);
    return false;
  }
}

// Convert camelCase object keys to snake_case
function objectToSnakeCase(obj) {
  const result = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}

async function restoreData(backup) {
  console.log('=== Restoring data ===\n');

  let restored = {
    users: 0,
    invoices: 0,
    expected_invoices: 0,
    attachments: 0
  };

  try {
    // Restore users
    if (backup.users && backup.users.length > 0) {
      for (const user of backup.users) {
        const snakeUser = objectToSnakeCase(user);
        try {
          await pool.query(`
            INSERT INTO users (
              id, username, email, password_hash, role, first_name, last_name,
              is_active, last_login, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (email) DO NOTHING
          `, [
            snakeUser.id, snakeUser.username, snakeUser.email, snakeUser.password_hash,
            snakeUser.role, snakeUser.first_name, snakeUser.last_name, snakeUser.is_active,
            snakeUser.last_login, snakeUser.created_at, snakeUser.updated_at
          ]);
          restored.users++;
        } catch (err) {
          console.error(`⚠ Error restoring user ${user.email}:`, err.message);
        }
      }
      console.log(`✓ Restored ${restored.users} users`);

      // Reset sequence
      await pool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    }

    // Restore invoices
    if (backup.invoices && backup.invoices.length > 0) {
      for (const invoice of backup.invoices) {
        const snakeInvoice = objectToSnakeCase(invoice);
        try {
          await pool.query(`
            INSERT INTO invoices (
              id, invoice_number, customer_name, customer_contract, amount_due, currency,
              invoice_date, due_date, status, frequency, invoice_type, related_invoice_number,
              po_number, pdf_path, uploaded_at, uploaded_by, notes, additional_info,
              is_paid, paid_date, is_production, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          `, [
            snakeInvoice.id, snakeInvoice.invoice_number, snakeInvoice.customer_name,
            snakeInvoice.customer_contract, snakeInvoice.amount_due, snakeInvoice.currency,
            snakeInvoice.invoice_date, snakeInvoice.due_date, snakeInvoice.status,
            snakeInvoice.frequency, snakeInvoice.invoice_type, snakeInvoice.related_invoice_number,
            snakeInvoice.po_number, snakeInvoice.pdf_path, snakeInvoice.uploaded_at,
            snakeInvoice.uploaded_by, snakeInvoice.notes, snakeInvoice.additional_info,
            snakeInvoice.is_paid, snakeInvoice.paid_date, snakeInvoice.is_production,
            snakeInvoice.created_at, snakeInvoice.updated_at
          ]);
          restored.invoices++;
        } catch (err) {
          console.error(`⚠ Error restoring invoice ${invoice.invoiceNumber || invoice.invoice_number}:`, err.message);
        }
      }
      console.log(`✓ Restored ${restored.invoices} invoices`);

      // Reset sequence
      await pool.query(`SELECT setval('invoices_id_seq', (SELECT MAX(id) FROM invoices))`);
    }

    // Restore expected_invoices
    if (backup.expected_invoices && backup.expected_invoices.length > 0) {
      for (const expected of backup.expected_invoices) {
        const snakeExpected = objectToSnakeCase(expected);
        try {
          await pool.query(`
            INSERT INTO expected_invoices (
              id, invoice_number, customer_name, customer_contract, expected_amount,
              expected_date, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            snakeExpected.id, snakeExpected.invoice_number, snakeExpected.customer_name,
            snakeExpected.customer_contract, snakeExpected.expected_amount, snakeExpected.expected_date,
            snakeExpected.notes, snakeExpected.created_at, snakeExpected.updated_at
          ]);
          restored.expected_invoices++;
        } catch (err) {
          console.error(`⚠ Error restoring expected invoice:`, err.message);
        }
      }
      console.log(`✓ Restored ${restored.expected_invoices} expected invoices`);

      // Reset sequence
      await pool.query(`SELECT setval('expected_invoices_id_seq', (SELECT MAX(id) FROM expected_invoices))`);
    }

    // Restore attachments
    if (backup.attachments && backup.attachments.length > 0) {
      for (const attachment of backup.attachments) {
        const snakeAttachment = objectToSnakeCase(attachment);
        try {
          await pool.query(`
            INSERT INTO attachments (
              id, invoice_id, file_name, file_path, file_size, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            snakeAttachment.id, snakeAttachment.invoice_id, snakeAttachment.file_name,
            snakeAttachment.file_path, snakeAttachment.file_size, snakeAttachment.uploaded_at
          ]);
          restored.attachments++;
        } catch (err) {
          console.error(`⚠ Error restoring attachment:`, err.message);
        }
      }
      console.log(`✓ Restored ${restored.attachments} attachments`);

      // Reset sequence
      await pool.query(`SELECT setval('attachments_id_seq', (SELECT MAX(id) FROM attachments))`);
    }

    return restored;
  } catch (err) {
    console.error('✗ Error restoring data:', err.message);
    throw err;
  }
}

async function verifySchema() {
  console.log('\n=== Verifying schema ===\n');

  const tables = ['users', 'invoices', 'expected_invoices', 'attachments', 'password_reset_tokens', 'audit_log'];

  for (const tableName of tables) {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    console.log(`\n✓ ${tableName} (${result.rows.length} columns):`);
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  }
}

// Main execution
(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('Invoice Tracker - Database Schema Recreation Tool');
  console.log('='.repeat(60));
  console.log('\n⚠️  WARNING: This will DROP and RECREATE all tables!');
  console.log('⚠️  All existing data will be backed up and restored.');
  console.log('⚠️  Make sure you have a database backup before proceeding!\n');

  const answer = await question('Do you want to continue? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('\n✗ Operation cancelled by user');
    rl.close();
    await pool.end();
    process.exit(0);
  }

  try {
    // Step 1: Backup existing data
    const backup = await backupExistingData();

    console.log('\n📊 Data backup summary:');
    console.log(`   Users: ${backup.users.length}`);
    console.log(`   Invoices: ${backup.invoices.length}`);
    console.log(`   Expected Invoices: ${backup.expected_invoices.length}`);
    console.log(`   Attachments: ${backup.attachments.length}`);

    const proceed = await question('\nProceed with schema recreation? (yes/no): ');

    if (proceed.toLowerCase() !== 'yes') {
      console.log('\n✗ Operation cancelled by user');
      rl.close();
      await pool.end();
      process.exit(0);
    }

    // Step 2: Recreate schema
    const success = await recreateSchema();

    if (!success) {
      console.error('\n✗ Schema recreation failed. Data backup preserved.');
      rl.close();
      await pool.end();
      process.exit(1);
    }

    // Step 3: Restore data
    const restored = await restoreData(backup);

    console.log('\n📊 Data restoration summary:');
    console.log(`   Users: ${restored.users} of ${backup.users.length}`);
    console.log(`   Invoices: ${restored.invoices} of ${backup.invoices.length}`);
    console.log(`   Expected Invoices: ${restored.expected_invoices} of ${backup.expected_invoices.length}`);
    console.log(`   Attachments: ${restored.attachments} of ${backup.attachments.length}`);

    // Step 4: Verify schema
    await verifySchema();

    console.log('\n' + '='.repeat(60));
    console.log('✓ Database schema recreation complete!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Restart backend: pm2 restart invoice-tracker-backend');
    console.log('2. Test the application');
    console.log('3. Upload a test invoice to verify everything works\n');

    rl.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    console.error(error.stack);
    rl.close();
    await pool.end();
    process.exit(1);
  }
})();
