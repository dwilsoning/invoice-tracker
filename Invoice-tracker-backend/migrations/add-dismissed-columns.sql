-- Add dismissed tracking columns to expected_invoices
ALTER TABLE expected_invoices ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT false;
ALTER TABLE expected_invoices ADD COLUMN IF NOT EXISTS dismissed_date DATE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expected_invoices_dismissed ON expected_invoices(dismissed);
