#!/usr/bin/env node

/**
 * Invoice Tracker - Complete PostgreSQL Schema Deployment Script
 * 
 * This script creates all required tables with correct column definitions
 * and casing for deploying to AWS EC2 or any PostgreSQL instance.
 * 
 * Usage:
 *   node deploy-schema-to-ec2.js
 * 
 * Prerequisites:
 *   - PostgreSQL server is running
 *   - Database 'invoice_tracker' exists
 *   - User 'invoice_tracker_user' exists
 *   - .env file with DB credentials is configured
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

// SQL Statements for each table
const tables = {
  // =====================================================
  // TRIGGER FUNCTION
  // =====================================================
  triggerFunction: `
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$
    LANGUAGE plpgsql;
  `,

  // =====================================================
  // TABLE 1: USERS
  // =====================================================
  users: `
    DROP TABLE IF EXISTS public.users CASCADE;
    
    CREATE TABLE public.users (
        id character varying(50) NOT NULL,
        email character varying(255) NOT NULL UNIQUE,
        password_hash character varying(255) NOT NULL,
        first_name character varying(100),
        last_name character varying(100),
        role character varying(50) DEFAULT 'user',
        is_active boolean DEFAULT true,
        last_login timestamp without time zone,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    );
    
    ALTER TABLE public.users OWNER TO postgres;
    CREATE INDEX idx_users_email ON public.users USING btree (email);
    CREATE INDEX idx_users_role ON public.users USING btree (role);
    
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `,

  // =====================================================
  // TABLE 2: CONTRACTS
  // =====================================================
  contracts: `
    DROP TABLE IF EXISTS public.contracts CASCADE;
    
    CREATE TABLE public.contracts (
        id character varying(50) NOT NULL,
        contract_name character varying(255) NOT NULL UNIQUE,
        contract_value numeric(15,2) NOT NULL,
        currency character varying(10) DEFAULT 'USD',
        created_date date,
        updated_date date,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    );
    
    ALTER TABLE public.contracts OWNER TO postgres;
    CREATE INDEX idx_contracts_contract_name ON public.contracts USING btree (contract_name);
    
    CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `,

  // =====================================================
  // TABLE 3: INVOICES
  // =====================================================
  invoices: `
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
        currency character varying(10) DEFAULT 'USD',
        due_date date NOT NULL,
        status character varying(50) DEFAULT 'Pending',
        payment_date date,
        frequency character varying(50) DEFAULT 'adhoc',
        upload_date date,
        services text,
        pdf_path character varying(500),
        pdf_original_name character varying(255),
        contract_value numeric(15,2),
        contract_currency character varying(10) DEFAULT 'USD',
        notes text,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    );
    
    ALTER TABLE public.invoices OWNER TO postgres;
    CREATE INDEX idx_invoices_invoice_number ON public.invoices USING btree (invoice_number);
    CREATE INDEX idx_invoices_client ON public.invoices USING btree (client);
    CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);
    CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);
    CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);
    
    CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `,

  // =====================================================
  // TABLE 4: INVOICE_ATTACHMENTS
  // =====================================================
  invoice_attachments: `
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
        PRIMARY KEY (id)
    );
    
    ALTER TABLE public.invoice_attachments OWNER TO postgres;
    CREATE INDEX idx_attachments_invoice_id ON public.invoice_attachments USING btree (invoice_id);
    
    ALTER TABLE ONLY public.invoice_attachments
        ADD CONSTRAINT invoice_attachments_invoice_id_fkey 
        FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  `,

  // =====================================================
  // TABLE 5: EXPECTED_INVOICES
  // =====================================================
  expected_invoices: `
    DROP TABLE IF EXISTS public.expected_invoices CASCADE;
    
    CREATE TABLE public.expected_invoices (
        id character varying(50) NOT NULL,
        client character varying(255) NOT NULL,
        customer_contract character varying(100),
        invoice_type character varying(50),
        expected_amount numeric(15,2),
        currency character varying(10) DEFAULT 'USD',
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
    CREATE INDEX idx_expected_invoices_client ON public.expected_invoices USING btree (client);
    CREATE INDEX idx_expected_invoices_expected_date ON public.expected_invoices USING btree (expected_date);
    
    CREATE TRIGGER update_expected_invoices_updated_at BEFORE UPDATE ON public.expected_invoices
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `,

  // =====================================================
  // TABLE 6: DISMISSED_EXPECTED_INVOICES
  // =====================================================
  dismissed_expected_invoices: `
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
    CREATE INDEX idx_dismissed_lookup ON public.dismissed_expected_invoices 
        USING btree (client, customer_contract, invoice_type, expected_date);
  `,

  // =====================================================
  // TABLE 7: PASSWORD_RESET_TOKENS
  // =====================================================
  password_reset_tokens: `
    DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
    
    CREATE TABLE public.password_reset_tokens (
        id character varying(50) NOT NULL,
        user_id character varying(50) NOT NULL,
        token character varying(255) NOT NULL UNIQUE,
        expires_at timestamp without time zone NOT NULL,
        used boolean DEFAULT false,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    );
    
    ALTER TABLE public.password_reset_tokens OWNER TO postgres;
    CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
    CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);
    
    ALTER TABLE ONLY public.password_reset_tokens
        ADD CONSTRAINT password_reset_tokens_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  `,

  // =====================================================
  // GRANT PERMISSIONS
  // =====================================================
  permissions: `
    GRANT ALL ON SCHEMA public TO invoice_tracker_user;
    GRANT ALL ON TABLE public.users TO invoice_tracker_user;
    GRANT ALL ON TABLE public.contracts TO invoice_tracker_user;
    GRANT ALL ON TABLE public.invoices TO invoice_tracker_user;
    GRANT ALL ON TABLE public.invoice_attachments TO invoice_tracker_user;
    GRANT ALL ON TABLE public.expected_invoices TO invoice_tracker_user;
    GRANT ALL ON TABLE public.dismissed_expected_invoices TO invoice_tracker_user;
    GRANT ALL ON TABLE public.password_reset_tokens TO invoice_tracker_user;
    GRANT USAGE, SELECT ON SEQUENCE public.dismissed_expected_invoices_id_seq TO invoice_tracker_user;
  `
};

// Table descriptions for logging
const tableDescriptions = [
  { name: 'triggerFunction', desc: 'Creating trigger function for updated_at timestamps' },
  { name: 'users', desc: 'Creating USERS table (authentication & accounts)' },
  { name: 'contracts', desc: 'Creating CONTRACTS table (contract data)' },
  { name: 'invoices', desc: 'Creating INVOICES table (main invoice records)' },
  { name: 'invoice_attachments', desc: 'Creating INVOICE_ATTACHMENTS table (file attachments)' },
  { name: 'expected_invoices', desc: 'Creating EXPECTED_INVOICES table (forecasted invoices)' },
  { name: 'dismissed_expected_invoices', desc: 'Creating DISMISSED_EXPECTED_INVOICES table (dismissal tracking)' },
  { name: 'password_reset_tokens', desc: 'Creating PASSWORD_RESET_TOKENS table (password resets)' },
  { name: 'permissions', desc: 'Granting permissions to invoice_tracker_user' }
];

/**
 * Deploy all tables to PostgreSQL
 */
async function deploySchema() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Invoice Tracker - Complete PostgreSQL Schema Deployment      ║');
  console.log('║   For AWS EC2 and Production Environments                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log(`📊 Database Configuration:`);
  console.log(`   Host:     ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port:     ${process.env.DB_PORT || 5432}`);
  console.log(`   Database: ${process.env.DB_NAME || 'invoice_tracker'}`);
  console.log(`   User:     ${process.env.DB_USER || 'invoice_tracker_user'}`);
  console.log('\n');

  // Test connection
  try {
    const testClient = await pool.connect();
    console.log('✓ Database connection successful\n');
    testClient.release();
  } catch (error) {
    console.error('✗ Failed to connect to database:', error.message);
    console.error('\nPlease check your .env configuration and ensure:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. Database exists: invoice_tracker');
    console.error('  3. User exists: invoice_tracker_user');
    console.error('  4. .env file has correct credentials');
    process.exit(1);
  }

  let successCount = 0;
  let failureCount = 0;

  // Execute each table creation
  for (const { name, desc } of tableDescriptions) {
    try {
      console.log(`⏳ ${desc}...`);
      await pool.query(tables[name]);
      console.log(`✓ ${desc} - SUCCESS\n`);
      successCount++;
    } catch (error) {
      console.error(`✗ ${desc} - FAILED`);
      console.error(`   Error: ${error.message}\n`);
      failureCount++;
    }
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                       DEPLOYMENT SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`✓ Successful Operations: ${successCount}`);
  console.log(`✗ Failed Operations:     ${failureCount}\n`);

  if (failureCount === 0) {
    console.log('✓ Schema deployment COMPLETE! All tables created successfully.\n');
    console.log('📋 Tables Created:');
    console.log('   1. users                        (4 columns + timestamps)');
    console.log('   2. contracts                    (8 columns + timestamps)');
    console.log('   3. invoices                     (24 columns + timestamps)');
    console.log('   4. invoice_attachments          (8 columns + timestamps)');
    console.log('   5. expected_invoices            (15 columns + timestamps)');
    console.log('   6. dismissed_expected_invoices  (8 columns + id sequence)');
    console.log('   7. password_reset_tokens        (6 columns)');
    console.log('\n✓ All indexes created');
    console.log('✓ All triggers configured');
    console.log('✓ Foreign key relationships established');
    console.log('✓ Permissions granted to invoice_tracker_user\n');
    console.log('🚀 Ready for Invoice Tracker deployment on EC2!\n');
  } else {
    console.log('⚠ Deployment completed with errors. Review the errors above.\n');
    process.exit(1);
  }

  await pool.end();
}

// Run deployment
deploySchema().catch(error => {
  console.error('Fatal error during deployment:', error);
  process.exit(1);
});
