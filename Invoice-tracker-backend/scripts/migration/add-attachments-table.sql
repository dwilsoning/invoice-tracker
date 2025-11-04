-- Add attachments table for invoice file attachments
CREATE TABLE IF NOT EXISTS invoice_attachments (
    id VARCHAR(50) PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create index on invoice_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_attachments_invoice_id ON invoice_attachments(invoice_id);
