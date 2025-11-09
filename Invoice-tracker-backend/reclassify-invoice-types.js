require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Classify invoice type (same logic as server-postgres.js)
function classifyInvoiceType(services, invoice_number, amount) {
  // Check if amount is negative - credit memos have negative amounts
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

  if (!services) return 'PS';

  const lower = services.toLowerCase();

  // Check in order of specificity
  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  // Check for Managed Services - handle various formats (check this FIRST before subscription)
  // Also catches concatenated versions like "ManagedServices" or "AllscriptsManagedServices"
  if (lower.includes('managed services') ||
      lower.includes('managedservices') ||  // catches concatenated versions
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  // Professional Services - check BEFORE maintenance/support to avoid false positives
  if (lower.includes('consulting') ||
      lower.includes('professional services') ||
      lower.includes('professional service fee') ||
      lower.includes('professionalservicesfee') ||
      lower.includes('penetration testing')) return 'PS';

  // Software licenses (ad-hoc) - check BEFORE subscription
  // If it has "license/licence" with software-related terms but NO subscription indicators, it's SW
  if ((lower.includes('license') || lower.includes('licence')) &&
      !lower.includes('subscription') &&
      !lower.includes('annual') &&
      !lower.includes('yearly') &&
      !lower.includes('recurring')) {
    // Ad-hoc licenses are typically software purchases
    if (lower.includes('software') ||
        lower.includes('connectivity') ||
        lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time')) {
      return 'SW';
    }
    // Default ad-hoc licenses to SW unless proven otherwise
    return 'SW';
  }

  // Subscription - only if NOT managed services
  // Now only catches explicit subscriptions with recurring patterns
  if (lower.includes('subscription') ||
      (lower.includes('license') && (lower.includes('annual') || lower.includes('yearly'))) ||
      lower.includes('saas')) return 'Sub';

  // Maintenance and Support - but NOT if it's managed services or professional services
  if ((lower.includes('maintenance') ||
       lower.includes('annual maintenance') ||
       lower.includes('software support services') ||
       lower.includes('support services')) &&
      !lower.includes('managed') &&
      !lower.includes('professional')) {
    return 'Maint';
  }

  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application') || lower.includes('program')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

(async () => {
  try {
    console.log('=== Reclassifying Invoice Types ===\n');

    // Get all invoices
    const result = await pool.query(`
      SELECT id, invoice_number, invoice_type, services, amount_due, client
      FROM invoices
      ORDER BY invoice_number
    `);

    console.log(`Found ${result.rows.length} invoices to check\n`);

    let checked = 0;
    let reclassified = 0;
    const changes = [];

    for (const invoice of result.rows) {
      checked++;

      if (checked % 100 === 0) {
        console.log(`Progress: ${checked}/${result.rows.length} invoices checked...`);
      }

      // Reclassify based on services text
      const newType = classifyInvoiceType(invoice.services, invoice.invoice_number, invoice.amount_due);

      if (newType !== invoice.invoice_type) {
        // Update database
        await pool.query(
          'UPDATE invoices SET invoice_type = $1 WHERE id = $2',
          [newType, invoice.id]
        );

        changes.push({
          invoice_number: invoice.invoice_number,
          client: invoice.client,
          old_type: invoice.invoice_type,
          new_type: newType,
          services: invoice.services
        });

        reclassified++;
      }
    }

    console.log(`\n\n=== RESULTS ===`);
    console.log(`Total invoices checked: ${checked}`);
    console.log(`Invoices reclassified: ${reclassified}\n`);

    if (reclassified > 0) {
      console.log('Changes made:\n');
      changes.forEach(c => {
        console.log(`Invoice: ${c.invoice_number} (${c.client})`);
        console.log(`  ${c.old_type} → ${c.new_type}`);
        console.log(`  Services: ${c.services ? c.services.substring(0, 100) : 'N/A'}...`);
        console.log('');
      });

      // Save to JSON file for reference
      fs.writeFileSync(
        'invoice-type-changes.json',
        JSON.stringify(changes, null, 2)
      );
      console.log('Changes saved to invoice-type-changes.json');
    } else {
      console.log('✅ No changes needed - all invoice types are correct!');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
