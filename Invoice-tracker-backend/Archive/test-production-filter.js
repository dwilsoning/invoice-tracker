const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'invoice_tracker',
  password: 'Post2020',
  port: 5432,
});

const exchangeRates = {
  USD: 1,
  AUD: 0.65,
  SGD: 0.74,
  EUR: 1.08,
  GBP: 1.27,
  NZD: 0.61
};

function convertToUSD(amount, currency) {
  return amount * (exchangeRates[currency] || 1);
}

async function testProductionFilter() {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE status = $1', ['Pending']);
    const allPendingInvoices = result.rows;

    const today = new Date();
    const days30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Calculate WITH production filter (invoice_date >= 2025-11-01)
    const productionInvoices = allPendingInvoices.filter(inv =>
      inv.due_date &&
      inv.due_date <= days30 &&
      inv.invoice_date >= '2025-11-01'
    );

    let productionTotal = 0;
    productionInvoices.forEach(inv => {
      productionTotal += convertToUSD(inv.amount_due, inv.currency);
    });

    // Calculate WITHOUT production filter (all invoices)
    const allInvoices = allPendingInvoices.filter(inv =>
      inv.due_date &&
      inv.due_date <= days30
    );

    let allTotal = 0;
    allInvoices.forEach(inv => {
      allTotal += convertToUSD(inv.amount_due, inv.currency);
    });

    console.log('\n=== Cash Flow Projection Analysis ===\n');
    console.log('Today:', today.toISOString().split('T')[0]);
    console.log('Next 30 days cutoff:', days30);
    console.log('\nWITH Production Filter (invoice_date >= 2025-11-01):');
    console.log(`  Invoices: ${productionInvoices.length}`);
    console.log(`  Total USD: $${Math.round(productionTotal).toLocaleString()}`);

    console.log('\nWITHOUT Production Filter (ALL pending invoices):');
    console.log(`  Invoices: ${allInvoices.length}`);
    console.log(`  Total USD: $${Math.round(allTotal).toLocaleString()}`);

    console.log('\nDifference:', Math.round(allTotal - productionTotal).toLocaleString());

    // Show invoices before production date
    const preProductionInvoices = allInvoices.filter(inv => inv.invoice_date < '2025-11-01');
    if (preProductionInvoices.length > 0) {
      console.log('\n=== Invoices BEFORE Nov 1, 2025 (being incorrectly included) ===');
      let preProductionTotal = 0;
      preProductionInvoices.forEach(inv => {
        const amountUSD = convertToUSD(inv.amount_due, inv.currency);
        preProductionTotal += amountUSD;
        console.log(`Invoice: ${inv.invoice_number}, Client: ${inv.client}, Date: ${inv.invoice_date}, Amount: $${Math.round(amountUSD).toLocaleString()} USD`);
      });
      console.log(`\nTotal from pre-production invoices: $${Math.round(preProductionTotal).toLocaleString()}`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

testProductionFilter();
