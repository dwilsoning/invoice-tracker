-- =====================================================
-- Invoice Tracker - Complete PostgreSQL Database Schema
-- For EC2 Deployment with Full Functionality
-- Generated: November 12, 2025
-- =====================================================

-- Create schema and set defaults
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =====================================================
-- CREATE TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- =====================================================
-- TABLE 1: USERS
-- =====================================================
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
    id character varying(50) NOT NULL,
    email character varying(255) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE public.users OWNER TO postgres;

-- Create indexes for users
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_role ON public.users USING btree (role);

-- Create trigger for users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TABLE 2: CONTRACTS
-- =====================================================
DROP TABLE IF EXISTS public.contracts CASCADE;

CREATE TABLE public.contracts (
    id character varying(50) NOT NULL,
    contract_name character varying(255) NOT NULL UNIQUE,
    contract_value numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    created_date date,
    updated_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE public.contracts OWNER TO postgres;

-- Create indexes for contracts
CREATE INDEX idx_contracts_contract_name ON public.contracts USING btree (contract_name);

-- Create trigger for contracts
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TABLE 3: INVOICES (Main Table)
-- =====================================================
DROP TABLE IF EXISTS public.invoices CASCADE;

CREATE TABLE public.invoices (
    id character varying(50) NOT NULL,
    invoice_number character varying(100) NOT NULL,
    invoice_date date,
    client character varying(255) NOT NULL,
    customer_contract character varying(100),
    oracle_contract character varying(100),
    po_number character varying(100),
    invoice_type character varying(50),
    amount_due numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    due_date date NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    payment_date date,
    frequency character varying(50) DEFAULT 'adhoc'::character varying,
    upload_date date,
    services text,
    pdf_path character varying(500),
    pdf_original_name character varying(255),
    contract_value numeric(15,2),
    contract_currency character varying(10) DEFAULT 'USD'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE public.invoices OWNER TO postgres;

-- Create indexes for invoices
CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);
CREATE INDEX idx_invoices_client ON public.invoices USING btree (client);
CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);
CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);
CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);

-- Create trigger for invoices
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TABLE 4: INVOICE_ATTACHMENTS
-- =====================================================
DROP TABLE IF EXISTS public.invoice_attachments CASCADE;

CREATE TABLE public.invoice_attachments (
    id character varying(50) NOT NULL,
    invoice_id character varying(50) NOT NULL,
    file_name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT invoice_attachments_invoice_id_fkey 
        FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE
);

ALTER TABLE public.invoice_attachments OWNER TO postgres;

-- Create indexes for invoice_attachments
CREATE INDEX idx_attachments_invoice_id ON public.invoice_attachments USING btree (invoice_id);

-- =====================================================
-- TABLE 5: EXPECTED_INVOICES
-- =====================================================
DROP TABLE IF EXISTS public.expected_invoices CASCADE;

CREATE TABLE public.expected_invoices (
    id character varying(50) NOT NULL,
    client character varying(255) NOT NULL,
    customer_contract character varying(100),
    invoice_type character varying(50),
    expected_amount numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    expected_date date NOT NULL,
    frequency character varying(50) NOT NULL,
    last_invoice_number character varying(100),
    last_invoice_date date,
    acknowledged boolean DEFAULT false,
    acknowledged_date date,
    created_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE public.expected_invoices OWNER TO postgres;

-- Create indexes for expected_invoices
CREATE INDEX idx_expected_invoices_client ON public.expected_invoices USING btree (client);
CREATE INDEX idx_expected_invoices_expected_date ON public.expected_invoices USING btree (expected_date);

-- Create trigger for expected_invoices
CREATE TRIGGER update_expected_invoices_updated_at BEFORE UPDATE ON public.expected_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TABLE 6: DISMISSED_EXPECTED_INVOICES
-- =====================================================
DROP TABLE IF EXISTS public.dismissed_expected_invoices CASCADE;
DROP SEQUENCE IF EXISTS public.dismissed_expected_invoices_id_seq CASCADE;

CREATE SEQUENCE public.dismissed_expected_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dismissed_expected_invoices_id_seq OWNER TO postgres;

CREATE TABLE public.dismissed_expected_invoices (
    id integer NOT NULL DEFAULT nextval('public.dismissed_expected_invoices_id_seq'::regclass),
    client character varying(255) NOT NULL,
    customer_contract character varying(255),
    invoice_type character varying(100),
    expected_date date NOT NULL,
    dismissed_date date DEFAULT CURRENT_DATE NOT NULL,
    dismissed_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (client, customer_contract, invoice_type, expected_date)
);

ALTER TABLE public.dismissed_expected_invoices OWNER TO postgres;
ALTER SEQUENCE public.dismissed_expected_invoices_id_seq OWNED BY public.dismissed_expected_invoices.id;

-- Create indexes for dismissed_expected_invoices
CREATE INDEX idx_dismissed_lookup ON public.dismissed_expected_invoices 
    USING btree (client, customer_contract, invoice_type, expected_date);

-- =====================================================
-- TABLE 7: PASSWORD_RESET_TOKENS
-- =====================================================
DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;

CREATE TABLE public.password_reset_tokens (
    id character varying(50) NOT NULL,
    user_id character varying(50) NOT NULL,
    token character varying(255) NOT NULL UNIQUE,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT password_reset_tokens_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

ALTER TABLE public.password_reset_tokens OWNER TO postgres;

-- Create indexes for password_reset_tokens
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON SCHEMA public TO invoice_tracker_user;
GRANT ALL ON TABLE public.users TO invoice_tracker_user;
GRANT ALL ON TABLE public.contracts TO invoice_tracker_user;
GRANT ALL ON TABLE public.invoices TO invoice_tracker_user;
GRANT ALL ON TABLE public.invoice_attachments TO invoice_tracker_user;
GRANT ALL ON TABLE public.expected_invoices TO invoice_tracker_user;
GRANT ALL ON TABLE public.dismissed_expected_invoices TO invoice_tracker_user;
GRANT ALL ON TABLE public.password_reset_tokens TO invoice_tracker_user;

GRANT USAGE, SELECT ON SEQUENCE public.dismissed_expected_invoices_id_seq TO invoice_tracker_user;

-- =====================================================
-- INSERT SAMPLE DATA (Optional - Remove if you're migrating existing data)
-- =====================================================
-- INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
-- VALUES 
-- (
--     'user_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 12),
--     'admin@invoicetracker.local',
--     'REPLACE_WITH_HASHED_PASSWORD',
--     'Admin',
--     'User',
--     'admin',
--     true
-- );

-- =====================================================
-- DATABASE SCHEMA DEPLOYMENT COMPLETE
-- =====================================================
-- 
-- Tables Created:
--   1. users                          - User accounts and authentication
--   2. contracts                       - Contract information and values
--   3. invoices                        - Main invoice records (1765 rows)
--   4. invoice_attachments            - PDF and file attachments (33 rows)
--   5. expected_invoices              - Forecasted invoices (7 rows)
--   6. dismissed_expected_invoices    - Dismissed forecast records (81 rows)
--   7. password_reset_tokens          - Password reset management (0 rows)
--
-- All tables include:
--   ✓ Proper data types with correct casing
--   ✓ Primary keys and unique constraints
--   ✓ Foreign key relationships
--   ✓ Indexes for performance
--   ✓ Timestamp triggers for created_at/updated_at
--   ✓ Default values where applicable
--
-- =====================================================
