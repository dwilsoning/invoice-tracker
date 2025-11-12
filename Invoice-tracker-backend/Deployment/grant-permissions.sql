-- Grant Permissions Script for invoice_tracker_user
-- Run this as the postgres superuser BEFORE deploying the schema
--
-- Usage:
--   psql -h your-ec2-ip -U postgres -d invoice_tracker -f grant-permissions.sql

-- Grant all privileges on the public schema
GRANT ALL ON SCHEMA public TO invoice_tracker_user;

-- Grant permission to create objects in the public schema
GRANT CREATE ON SCHEMA public TO invoice_tracker_user;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO invoice_tracker_user;

-- Grant default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO invoice_tracker_user;

-- Grant default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO invoice_tracker_user;

-- Grant privileges on existing tables (if any exist)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'GRANT ALL ON TABLE public.' || quote_ident(r.tablename) || ' TO invoice_tracker_user';
    END LOOP;
END $$;

-- Grant privileges on existing sequences (if any exist)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    LOOP
        EXECUTE 'GRANT ALL ON SEQUENCE public.' || quote_ident(r.sequencename) || ' TO invoice_tracker_user';
    END LOOP;
END $$;

-- Grant privileges on existing functions (if any exist)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT proname FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public'
    LOOP
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || quote_ident(r.proname) || ' TO invoice_tracker_user';
    END LOOP;
END $$;

-- Confirm permissions granted
SELECT 'Permissions granted successfully to invoice_tracker_user' AS status;
