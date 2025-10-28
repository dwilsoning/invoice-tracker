const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Frequency detection logic (same as server)
function detectFrequency(services) {
  if (!services) return 'adhoc';
  const lower = services.toLowerCase();

  if (lower.includes('monthly')) return 'monthly';
  if (lower.includes('quarterly') || lower.includes('quarter')) return 'quarterly';
  if (lower.includes('bi-annual') || lower.includes('semi-annual') || lower.includes('6 month')) return 'bi-annual';
  if (lower.includes('tri-annual') || lower.includes('4 month')) return 'tri-annual';
  if ((lower.includes('annual') || lower.includes('yearly')) && !lower.includes('bi-annual') && !lower.includes('semi-annual')) return 'annual';

  return 'adhoc';
}

// Type classification logic (same as server)
function classifyInvoiceType(services, amount) {
  if (amount && amount < 0) return 'Credit Memo';
  if (!services) return 'PS';

  const lower = services.toLowerCase();

  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';
  if (lower.includes('managed services') || lower.includes('managed/outsourcing')) return 'MS';
  if (lower.includes('professional services') || lower.includes('consulting')) return 'PS';

  // Maintenance/Support - should be checked before software
  if ((lower.includes('maintenance') || lower.includes('software support') ||
       lower.includes('support services') || lower.includes('support fee')) &&
      !lower.includes('managed') && !lower.includes('professional')) {
    return 'Maint';
  }

  if (lower.includes('subscription') || lower.includes('saas')) return 'Sub';
  if (lower.includes('hosting') || lower.includes('cloud services')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

async function validateInvoices() {
  try {
    console.log('\n=====================================');
    console.log('Validating All Invoices');
    console.log('=====================================\n');

    const invoices = await pool.query(`
      SELECT id, invoice_number, services, frequency, invoice_type, amount_due, pdf_path
      FROM invoices
      ORDER BY invoice_number
    `);

    console.log(`Checking ${invoices.rows.length} invoices...\n`);

    const issues = {
      frequency: [],
      type: [],
      total: 0
    };

    for (const invoice of invoices.rows) {
      const expectedFreq = detectFrequency(invoice.services);
      const expectedType = classifyInvoiceType(invoice.services, invoice.amount_due);

      if (invoice.frequency !== expectedFreq) {
        issues.frequency.push({
          invoice_number: invoice.invoice_number,
          current: invoice.frequency,
          expected: expectedFreq,
          services: invoice.services.substring(0, 80)
        });
        issues.total++;
      }

      if (invoice.invoice_type !== expectedType) {
        issues.type.push({
          invoice_number: invoice.invoice_number,
          current: invoice.invoice_type,
          expected: expectedType,
          services: invoice.services.substring(0, 80)
        });
        issues.total++;
      }
    }

    // Report findings
    if (issues.frequency.length > 0) {
      console.log('=====================================');
      console.log(`Frequency Mismatches (${issues.frequency.length})`);
      console.log('=====================================\n');

      issues.frequency.slice(0, 20).forEach(issue => {
        console.log(`Invoice: ${issue.invoice_number}`);
        console.log(`  Current: ${issue.current} → Should be: ${issue.expected}`);
        console.log(`  Services: ${issue.services}...`);
        console.log('');
      });

      if (issues.frequency.length > 20) {
        console.log(`... and ${issues.frequency.length - 20} more\n`);
      }
    }

    if (issues.type.length > 0) {
      console.log('=====================================');
      console.log(`Type Mismatches (${issues.type.length})`);
      console.log('=====================================\n');

      issues.type.slice(0, 20).forEach(issue => {
        console.log(`Invoice: ${issue.invoice_number}`);
        console.log(`  Current: ${issue.current} → Should be: ${issue.expected}`);
        console.log(`  Services: ${issue.services}...`);
        console.log('');
      });

      if (issues.type.length > 20) {
        console.log(`... and ${issues.type.length - 20} more\n`);
      }
    }

    if (issues.total === 0) {
      console.log('✅ All invoices are correctly classified!');
    } else {
      console.log('=====================================');
      console.log(`Summary: ${issues.total} issues found`);
      console.log(`  Frequency: ${issues.frequency.length}`);
      console.log(`  Type: ${issues.type.length}`);
      console.log('=====================================');

      // Ask if user wants to fix them
      console.log('\nTo fix these issues, run:');
      console.log('  node scripts/utilities/apply-validation-fixes.js');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

validateInvoices();
