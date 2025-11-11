-- =====================================================
-- Invoice Tracker Database Schema Recreation
-- Run this as postgres superuser: sudo -u postgres psql -d invoice_tracker -f recreate-schema-superuser.sql
-- =====================================================

-- First, backup existing data to temp tables
CREATE TEMP TABLE backup_users AS SELECT * FROM users;
CREATE TEMP TABLE backup_invoices AS SELECT * FROM invoices;
CREATE TEMP TABLE backup_expected_invoices AS SELECT * FROM expected_invoices;
CREATE TEMP TABLE backup_attachments AS SELECT * FROM attachments WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments');

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
-- Password Reset Tokens Table
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
-- Audit Log Table
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
-- Restore data from backup tables
-- =====================================================

-- Restore users
INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, is_active, last_login, created_at, updated_at)
SELECT id, username, email, password_hash, role, first_name, last_name, is_active, last_login, created_at, updated_at
FROM backup_users
ON CONFLICT (email) DO NOTHING;

-- Reset users sequence
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

-- Restore invoices (converting camelCase to snake_case if needed)
INSERT INTO invoices (
  id, invoice_number, customer_name, customer_contract, amount_due, currency,
  invoice_date, due_date, status, frequency, invoice_type, related_invoice_number,
  po_number, pdf_path, uploaded_at, uploaded_by, notes, additional_info,
  is_paid, paid_date, is_production, created_at, updated_at
)
SELECT
  id,
  COALESCE("invoiceNumber", invoice_number),
  COALESCE("customerName", customer_name),
  COALESCE("customerContract", customer_contract),
  COALESCE("amountDue", amount_due),
  currency,
  COALESCE("invoiceDate", invoice_date),
  COALESCE("dueDate", due_date),
  status,
  frequency,
  COALESCE("invoiceType", invoice_type),
  COALESCE("relatedInvoiceNumber", related_invoice_number),
  COALESCE("poNumber", po_number),
  COALESCE("pdfPath", pdf_path),
  COALESCE("uploadedAt", uploaded_at),
  COALESCE("uploadedBy", uploaded_by),
  notes,
  COALESCE("additionalInfo", additional_info),
  COALESCE("isPaid", is_paid, FALSE),
  COALESCE("paidDate", paid_date),
  COALESCE("isProduction", is_production, TRUE),
  created_at,
  updated_at
FROM backup_invoices;

-- Reset invoices sequence
SELECT setval('invoices_id_seq', COALESCE((SELECT MAX(id) FROM invoices), 1));

-- Restore expected_invoices
INSERT INTO expected_invoices (id, invoice_number, customer_name, customer_contract, expected_amount, expected_date, notes, created_at, updated_at)
SELECT
  id,
  COALESCE("invoiceNumber", invoice_number),
  COALESCE("customerName", customer_name),
  COALESCE("customerContract", customer_contract),
  COALESCE("expectedAmount", expected_amount),
  COALESCE("expectedDate", expected_date),
  notes,
  COALESCE(created_at, CURRENT_TIMESTAMP),
  COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM backup_expected_invoices;

-- Reset expected_invoices sequence
SELECT setval('expected_invoices_id_seq', COALESCE((SELECT MAX(id) FROM expected_invoices), 1));

-- Restore attachments if table existed
INSERT INTO attachments (id, invoice_id, file_name, file_path, file_size, uploaded_at)
SELECT
  id,
  COALESCE("invoiceId", invoice_id),
  COALESCE("fileName", file_name),
  COALESCE("filePath", file_path),
  COALESCE("fileSize", file_size),
  COALESCE("uploadedAt", uploaded_at)
FROM backup_attachments
WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'backup_attachments');

-- Reset attachments sequence if data was restored
SELECT setval('attachments_id_seq', COALESCE((SELECT MAX(id) FROM attachments), 1));

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO invoice_admin;

-- =====================================================
-- Verification
-- =====================================================
\echo '======================================'
\echo 'Schema Recreation Complete!'
\echo '======================================'
\echo ''
\echo 'Data restoration summary:'
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Invoices: ' || COUNT(*) FROM invoices;
SELECT 'Expected Invoices: ' || COUNT(*) FROM expected_invoices;
SELECT 'Attachments: ' || COUNT(*) FROM attachments;
\echo ''
\echo 'Tables created:'
\dt
\echo ''
\echo 'Next step: Restart backend with: pm2 restart invoice-tracker-backend'
