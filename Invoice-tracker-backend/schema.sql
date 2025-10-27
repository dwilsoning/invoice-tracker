-- PostgreSQL Schema for Invoice Tracker
-- Run this file to create the database schema

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE,
    client VARCHAR(255) NOT NULL,
    customer_contract VARCHAR(100),
    oracle_contract VARCHAR(100),
    po_number VARCHAR(100),
    invoice_type VARCHAR(50),
    amount_due DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    payment_date DATE,
    frequency VARCHAR(50) DEFAULT 'adhoc',
    upload_date DATE,
    services TEXT,
    pdf_path VARCHAR(500),
    pdf_original_name VARCHAR(255),
    contract_value DECIMAL(15, 2),
    contract_currency VARCHAR(10) DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on invoice_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Create expected_invoices table
CREATE TABLE IF NOT EXISTS expected_invoices (
    id VARCHAR(50) PRIMARY KEY,
    client VARCHAR(255) NOT NULL,
    customer_contract VARCHAR(100),
    invoice_type VARCHAR(50),
    expected_amount DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    expected_date DATE NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    last_invoice_number VARCHAR(100),
    last_invoice_date DATE,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_date DATE,
    created_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on expected_date for faster lookups
CREATE INDEX IF NOT EXISTS idx_expected_invoices_expected_date ON expected_invoices(expected_date);
CREATE INDEX IF NOT EXISTS idx_expected_invoices_client ON expected_invoices(client);

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(50) PRIMARY KEY,
    contract_name VARCHAR(255) NOT NULL UNIQUE,
    contract_value DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    created_date DATE,
    updated_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on contract_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_contract_name ON contracts(contract_name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expected_invoices_updated_at BEFORE UPDATE ON expected_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_tracker_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO invoice_tracker_user;
