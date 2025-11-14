-- =====================================================
-- Invoice Tracker Complete Database Schema
-- Exported from local database
-- PostgreSQL with snake_case naming convention
-- =====================================================

-- =====================================================
-- CONTRACTS Table
-- =====================================================
DROP TABLE IF EXISTS contracts CASCADE;

CREATE TABLE contracts (
  id VARCHAR(50) NOT NULL,
  contract_name VARCHAR(255) NOT NULL,
  contract_value NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD'::character varying,
  created_date DATE,
  updated_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for contracts
CREATE UNIQUE INDEX contracts_contract_name_key ON public.contracts USING btree (contract_name);
CREATE INDEX idx_contracts_contract_name ON public.contracts USING btree (contract_name);

-- =====================================================
-- DISMISSED_EXPECTED_INVOICES Table
-- =====================================================
DROP TABLE IF EXISTS dismissed_expected_invoices CASCADE;

CREATE TABLE dismissed_expected_invoices (
  id INTEGER NOT NULL DEFAULT nextval('dismissed_expected_invoices_id_seq'::regclass),
  client VARCHAR(255) NOT NULL,
  customer_contract VARCHAR(255),
  invoice_type VARCHAR(100),
  expected_date DATE NOT NULL,
  dismissed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dismissed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for dismissed_expected_invoices
CREATE UNIQUE INDEX dismissed_expected_invoices_client_customer_contract_invoic_key ON public.dismissed_expected_invoices USING btree (client, customer_contract, invoice_type, expected_date);
CREATE INDEX idx_dismissed_lookup ON public.dismissed_expected_invoices USING btree (client, customer_contract, invoice_type, expected_date);

-- =====================================================
-- EXPECTED_INVOICES Table
-- =====================================================
DROP TABLE IF EXISTS expected_invoices CASCADE;

CREATE TABLE expected_invoices (
  id VARCHAR(50) NOT NULL,
  client VARCHAR(255) NOT NULL,
  customer_contract VARCHAR(100),
  invoice_type VARCHAR(50),
  expected_amount NUMERIC,
  currency VARCHAR(10) DEFAULT 'USD'::character varying,
  expected_date DATE NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  last_invoice_number VARCHAR(100),
  last_invoice_date DATE,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_date DATE,
  created_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for expected_invoices
CREATE INDEX idx_expected_invoices_client ON public.expected_invoices USING btree (client);
CREATE INDEX idx_expected_invoices_expected_date ON public.expected_invoices USING btree (expected_date);

-- =====================================================
-- INVOICE_ATTACHMENTS Table
-- =====================================================
DROP TABLE IF EXISTS invoice_attachments CASCADE;

CREATE TABLE invoice_attachments (
  id VARCHAR(50) NOT NULL,
  invoice_id VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invoice_attachments
CREATE INDEX idx_attachments_invoice_id ON public.invoice_attachments USING btree (invoice_id);

-- =====================================================
-- INVOICES Table
-- =====================================================
DROP TABLE IF EXISTS invoices CASCADE;

CREATE TABLE invoices (
  id VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE,
  client VARCHAR(255) NOT NULL,
  customer_contract VARCHAR(100),
  oracle_contract VARCHAR(100),
  po_number VARCHAR(100),
  invoice_type VARCHAR(50),
  amount_due NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD'::character varying,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending'::character varying,
  payment_date DATE,
  frequency VARCHAR(50) DEFAULT 'adhoc'::character varying,
  upload_date DATE,
  services TEXT,
  pdf_path VARCHAR(500),
  pdf_original_name VARCHAR(255),
  contract_value NUMERIC,
  contract_currency VARCHAR(10) DEFAULT 'USD'::character varying,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invoices
CREATE INDEX idx_invoices_client ON public.invoices USING btree (client);
CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);
CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);
CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);

-- =====================================================
-- PASSWORD_RESET_TOKENS Table
-- =====================================================
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

CREATE TABLE password_reset_tokens (
  id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for password_reset_tokens
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);
CREATE UNIQUE INDEX password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);

-- Foreign keys for password_reset_tokens
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- =====================================================
-- USERS Table
-- =====================================================
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user'::character varying,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

-- =====================================================
-- Triggers
-- =====================================================

-- Trigger: update_contracts_updated_at
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE
  ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_expected_invoices_updated_at
CREATE TRIGGER update_expected_invoices_updated_at
  BEFORE UPDATE
  ON expected_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_invoices_updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE
  ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_users_updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Functions
-- =====================================================

-- Function: update_updated_at_column
-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO invoice_admin;
