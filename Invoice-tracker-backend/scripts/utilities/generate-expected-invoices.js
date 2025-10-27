require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoice_tracker',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Calculate next expected date
function calculateNextExpectedDate(lastInvoiceDate, frequency) {
  const date = new Date(lastInvoiceDate);

  switch(frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'tri-annual':
      date.setMonth(date.getMonth() + 4);
      break;
    case 'bi-annual':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return date;
}

async function generateExpectedInvoices() {
  try {
    console.log('=== Generating Expected Invoices ===\n');

    const rows = await pool.query(`
      SELECT
        client, customer_contract, invoice_type, amount_due, currency,
        invoice_date, invoice_number, frequency
      FROM invoices
      WHERE frequency != 'adhoc'
      ORDER BY client, customer_contract, invoice_date DESC
    `);

    console.log(`Found ${rows.rows.length} non-adhoc invoices to process\n`);

    const grouped = {};

    for (const row of rows.rows) {
      const key = `${row.client}-${row.customer_contract || 'none'}-${row.frequency}`;
      if (!grouped[key]) {
        grouped[key] = {
          client: row.client,
          customerContract: row.customer_contract || '',
          invoiceType: row.invoice_type,
          amountDue: row.amount_due,
          currency: row.currency,
          frequency: row.frequency,
          invoiceDate: row.invoice_date,
          invoiceNumber: row.invoice_number
        };
      }
    }

    console.log(`Grouped into ${Object.keys(grouped).length} unique client-contract-frequency combinations\n`);

    let generated = 0;
    let skipped = 0;

    for (const key in grouped) {
      const invoice = grouped[key];

      const nextDate = calculateNextExpectedDate(invoice.invoiceDate, invoice.frequency);
      if (!nextDate) continue;

      const expected_date = nextDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      if (expected_date <= today) {
        // Check if already exists
        const existing = await pool.query(
          'SELECT id FROM expected_invoices WHERE client = $1 AND customer_contract = $2 AND expected_date = $3',
          [invoice.client, invoice.customerContract, expected_date]
        );

        if (existing.rows.length === 0) {
          const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
          const created_date = new Date().toISOString().split('T')[0];

          await pool.query(`
            INSERT INTO expected_invoices (
              id, client, customer_contract, invoice_type, expected_amount,
              currency, expected_date, frequency, last_invoice_number, last_invoice_date,
              created_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            id,
            invoice.client,
            invoice.customerContract,
            invoice.invoiceType,
            invoice.amountDue,
            invoice.currency,
            expected_date,
            invoice.frequency,
            invoice.invoiceNumber,
            invoice.invoiceDate,
            created_date
          ]);

          console.log(`✓ Generated: ${invoice.client} - ${invoice.customerContract} - Expected: ${expected_date}`);
          generated++;
        } else {
          skipped++;
        }
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Generated: ${generated}`);
    console.log(`Skipped (already exists): ${skipped}`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

generateExpectedInvoices();
