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
  GBP: 1.27
};

function convertToUSD(amount, currency) {
  return amount * (exchangeRates[currency] || 1);
}

async function testCashflow() {
  try {
    const today = new Date();
    const days30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log('\n=== Cash Flow Analysis ===');
    console.log('Today:', today.toISOString().split('T')[0]);
    console.log('Next 30 days cutoff:', days30);

    // Get ALL pending invoices with due dates in next 30 days
    const result = await pool.query(
      `SELECT invoice_number, client, invoice_date, due_date, amount_due, currency, status
       FROM invoices
       WHERE status = $1
       AND due_date IS NOT NULL
       AND due_date <= $2
       ORDER BY due_date`,
      ['Pending', days30]
    );

    console.log(`\nTotal pending invoices with due date <= ${days30}: ${result.rows.length}`);

    // Group by currency and calculate totals
    const byCurrency = {};
    let totalUSD = 0;

    result.rows.forEach(inv => {
      if (!byCurrency[inv.currency]) {
        byCurrency[inv.currency] = { count: 0, total: 0, totalUSD: 0 };
      }
      byCurrency[inv.currency].count++;
      byCurrency[inv.currency].total += inv.amount_due;
      const usdAmount = convertToUSD(inv.amount_due, inv.currency);
      byCurrency[inv.currency].totalUSD += usdAmount;
      totalUSD += usdAmount;
    });

    console.log('\nBreakdown by currency:');
    Object.keys(byCurrency).sort().forEach(curr => {
      const data = byCurrency[curr];
      console.log(`  ${curr}: ${data.count} invoices, ${curr} ${Math.round(data.total).toLocaleString()} = USD $${Math.round(data.totalUSD).toLocaleString()}`);
    });

    console.log(`\n*** TOTAL in USD: $${Math.round(totalUSD).toLocaleString()} ***`);

    // Show first 10 invoices as examples
    console.log('\nFirst 10 invoices:');
    result.rows.slice(0, 10).forEach(inv => {
      const usdAmount = convertToUSD(inv.amount_due, inv.currency);
      console.log(`  ${inv.invoice_number} | ${inv.client.substring(0, 30).padEnd(30)} | Due: ${inv.due_date} | ${inv.currency} ${Math.round(inv.amount_due).toLocaleString().padStart(10)} = USD $${Math.round(usdAmount).toLocaleString()}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

testCashflow();
