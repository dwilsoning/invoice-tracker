-- Grant ALTER permission on expected_invoices to invoice_tracker_user
-- Run this on your PostgreSQL server as the postgres superuser

GRANT ALL PRIVILEGES ON TABLE expected_invoices TO invoice_tracker_user;

-- Then run the migration:
ALTER TABLE expected_invoices ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT false;
ALTER TABLE expected_invoices ADD COLUMN IF NOT EXISTS dismissed_date DATE;
CREATE INDEX IF NOT EXISTS idx_expected_invoices_dismissed ON expected_invoices(dismissed);
