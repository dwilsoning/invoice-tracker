// Test database queries directly
const { db } = require('./db-postgres');

async function test() {
  try {
    console.log('Testing database queries...\n');

    // Get all invoices
    const allInvoices = await db.all('SELECT * FROM invoices ORDER BY invoice_date DESC LIMIT 10');
    console.log(`Total invoices (sample): ${allInvoices.length}`);
    if (allInvoices.length > 0) {
      console.log('Sample invoice:');
      console.log(`  ID: ${allInvoices[0].id}`);
      console.log(`  Number: ${allInvoices[0].invoiceNumber}`);
      console.log(`  Client: ${allInvoices[0].client}`);
      console.log(`  Contract: ${allInvoices[0].customerContract}`);
      console.log(`  Type: ${allInvoices[0].invoiceType}`);
      console.log(`  Date: ${allInvoices[0].invoiceDate}`);
      console.log(`  Amount: ${allInvoices[0].amountDue} ${allInvoices[0].currency}`);
    }

    // Test contract filter
    console.log('\n' + '='.repeat(80));
    console.log('Testing contract 516557 filter:');
    const contractInvoices = await db.all(
      'SELECT * FROM invoices WHERE LOWER(customer_contract) = $1 OR LOWER(oracle_contract) = $1',
      '516557'
    );
    console.log(`Found ${contractInvoices.length} invoices for contract 516557`);
    contractInvoices.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceNumber} - ${inv.client} - ${inv.customerContract}`);
    });

    // Test PS type filter
    console.log('\n' + '='.repeat(80));
    console.log('Testing PS invoice type filter:');
    const psInvoices = await db.all(
      'SELECT * FROM invoices WHERE invoice_type = $1 LIMIT 5',
      'PS'
    );
    console.log(`Found ${psInvoices.length} PS invoices (showing 5)`);
    psInvoices.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceNumber} - ${inv.client} - Type: ${inv.invoiceType}`);
    });

    // Test this month filter
    console.log('\n' + '='.repeat(80));
    console.log('Testing "this month" date filter:');
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthNum = String(currentMonth + 1).padStart(2, '0');
    const monthStart = `${currentYear}-${monthNum}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthEnd = `${currentYear}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    console.log(`Date range: ${monthStart} to ${monthEnd}`);

    const thisMonthInvoices = await db.all(
      'SELECT * FROM invoices WHERE invoice_date >= $1 AND invoice_date <= $2',
      monthStart,
      monthEnd
    );
    console.log(`Found ${thisMonthInvoices.length} invoices this month`);
    thisMonthInvoices.slice(0, 5).forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceNumber} - ${inv.client} - Date: ${inv.invoiceDate}`);
    });

    // Test PS invoices this month
    console.log('\n' + '='.repeat(80));
    console.log('Testing PS invoices this month:');
    const psThisMonth = await db.all(
      'SELECT * FROM invoices WHERE invoice_type = $1 AND invoice_date >= $2 AND invoice_date <= $3',
      'PS',
      monthStart,
      monthEnd
    );
    console.log(`Found ${psThisMonth.length} PS invoices this month`);
    psThisMonth.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceNumber} - ${inv.client} - Type: ${inv.invoiceType} - Date: ${inv.invoiceDate}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
