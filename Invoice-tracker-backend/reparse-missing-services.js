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

// Classification functions (same as server-postgres.js)
function classifyInvoiceType(services, invoice_number, amount) {
  if (amount && amount < 0) return 'Credit Memo';
  if (!services) return 'PS';
  const lower = services.toLowerCase();

  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  if (lower.includes('managed services') ||
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  if (lower.includes('consulting') ||
      lower.includes('professional services') ||
      lower.includes('professional service fee') ||
      lower.includes('professionalservicesfee') ||
      lower.includes('penetration testing')) return 'PS';

  if ((lower.includes('license') || lower.includes('licence')) &&
      !lower.includes('subscription') &&
      !lower.includes('annual') &&
      !lower.includes('yearly') &&
      !lower.includes('recurring')) {
    if (lower.includes('software') ||
        lower.includes('connectivity') ||
        lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time')) {
      return 'SW';
    }
    return 'SW';
  }

  if (lower.includes('subscription') ||
      (lower.includes('license') && (lower.includes('annual') || lower.includes('yearly'))) ||
      lower.includes('saas')) return 'Sub';

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

function detectFrequency(services, amount) {
  if (!services) return 'adhoc';
  const lower = services.toLowerCase();

  if (lower.includes('monthly')) return 'monthly';
  if (lower.includes('quarterly') || lower.includes('quarter')) return 'quarterly';
  if (lower.includes('tri-annual') || lower.includes('triannual')) return 'tri-annual';
  if (lower.includes('bi-annual') || lower.includes('biannual') || lower.includes('semi-annual') || lower.includes('semiannual')) return 'bi-annual';
  if (lower.includes('annual') || lower.includes('yearly')) return 'annual';

  return 'adhoc';
}

async function extractServicesFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    let text = data.text;

    // Look for the Description column content
    const lines = text.split('\n');
    let services = '';
    let inDescriptionSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Start capturing after "Description" header
      if (line.match(/^Description\s*Taxable/i) || line.match(/^Quantity\s*Description/i)) {
        inDescriptionSection = true;
        continue;
      }

      // Stop at certain markers
      if (inDescriptionSection && (
        line.match(/^Subtotal/i) ||
        line.match(/^Tax/i) ||
        line.match(/^Total/i) ||
        line.match(/^Amount Due/i) ||
        line.match(/^Page \d+ of \d+/i)
      )) {
        break;
      }

      // Capture service description lines
      if (inDescriptionSection && line.length > 10) {
        // Skip lines that are just numbers or currency
        if (!line.match(/^\$?[\d,]+\.?\d*$/)) {
          services += line + ' ';
        }
      }
    }

    // Clean up
    services = services.replace(/\s+/g, ' ').trim();

    if (services.length > 10) {
      return services.substring(0, 500);
    }

    return null;
  } catch (error) {
    console.error(`Error parsing PDF: ${error.message}`);
    return null;
  }
}

(async () => {
  try {
    console.log('=== Re-parsing Invoices with Missing Services ===\n');

    // Get invoices with missing services (excluding credit memos)
    const result = await pool.query(`
      SELECT id, invoice_number, client, invoice_type, frequency, services, amount_due, pdf_original_name
      FROM invoices
      WHERE (services IS NULL OR services = '' OR services = 'No service description found')
        AND invoice_type != 'Credit Memo'
        AND amount_due > 0
      ORDER BY invoice_number
    `);

    console.log(`Found ${result.rows.length} invoices to re-parse\n`);

    let reparsed = 0;
    let updated = 0;
    const changes = [];

    for (const invoice of result.rows) {
      console.log(`Processing ${invoice.invoice_number}...`);

      // Find PDF file
      const pdfDir = path.join(__dirname, 'invoice_pdfs');
      const files = fs.readdirSync(pdfDir);
      const pdfFile = files.find(f => f.includes(invoice.pdf_original_name.replace('.pdf', '')));

      if (!pdfFile) {
        console.log(`  ⚠️  PDF not found`);
        continue;
      }

      const pdfPath = path.join(pdfDir, pdfFile);

      // Re-extract services
      const services = await extractServicesFromPDF(pdfPath);

      if (services) {
        reparsed++;

        // Re-classify type and frequency
        const newType = classifyInvoiceType(services, invoice.invoice_number, invoice.amount_due);
        const newFrequency = detectFrequency(services, invoice.amount_due);

        // Update database
        await pool.query(
          `UPDATE invoices
           SET services = $1, invoice_type = $2, frequency = $3
           WHERE id = $4`,
          [services, newType, newFrequency, invoice.id]
        );

        changes.push({
          invoice_number: invoice.invoice_number,
          client: invoice.client,
          old_type: invoice.invoice_type,
          new_type: newType,
          old_frequency: invoice.frequency,
          new_frequency: newFrequency,
          services: services.substring(0, 100)
        });

        console.log(`  ✓ Services extracted`);
        console.log(`    Type: ${invoice.invoice_type} → ${newType}`);
        console.log(`    Frequency: ${invoice.frequency} → ${newFrequency}`);
        console.log(`    Services: ${services.substring(0, 80)}...`);
        updated++;
      } else {
        console.log(`  ⚠️  Could not extract services`);
      }

      console.log('');
    }

    console.log('\n=== RESULTS ===');
    console.log(`Invoices processed: ${result.rows.length}`);
    console.log(`Successfully re-parsed: ${reparsed}`);
    console.log(`Database updated: ${updated}`);

    if (changes.length > 0) {
      fs.writeFileSync(
        'reparse-changes.json',
        JSON.stringify(changes, null, 2)
      );
      console.log('\nChanges saved to reparse-changes.json');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
