const { Pool } = require('pg');
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

async function applyFixes() {
  try {
    console.log('\n=====================================');
    console.log('Applying Validation Fixes');
    console.log('=====================================\n');

    const invoices = await pool.query(`
      SELECT id, invoice_number, services, frequency, invoice_type, amount_due
      FROM invoices
      ORDER BY invoice_number
    `);

    console.log(`Processing ${invoices.rows.length} invoices...\n`);

    let frequencyFixed = 0;
    let typeFixed = 0;

    for (const invoice of invoices.rows) {
      const expectedFreq = detectFrequency(invoice.services);
      const expectedType = classifyInvoiceType(invoice.services, invoice.amount_due);

      const updates = [];
      const values = [];
      let valueIndex = 1;

      if (invoice.frequency !== expectedFreq) {
        updates.push(`frequency = $${valueIndex++}`);
        values.push(expectedFreq);
        frequencyFixed++;
      }

      if (invoice.invoice_type !== expectedType) {
        updates.push(`invoice_type = $${valueIndex++}`);
        values.push(expectedType);
        typeFixed++;
      }

      if (updates.length > 0) {
        values.push(invoice.id);
        await pool.query(`
          UPDATE invoices
          SET ${updates.join(', ')}
          WHERE id = $${valueIndex}
        `, values);
      }
    }

    console.log('=====================================');
    console.log('✅ Fixes Applied');
    console.log('=====================================');
    console.log(`  Frequency corrections: ${frequencyFixed}`);
    console.log(`  Type corrections: ${typeFixed}`);
    console.log(`  Total corrections: ${frequencyFixed + typeFixed}`);
    console.log('=====================================\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

applyFixes();
