const { db } = require('./db-postgres.js');

async function testCashflowCalculation() {
  console.log('=== Testing Cashflow Calculation ===\n');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const days30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const days60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`Today: ${todayStr}`);
  console.log(`30 days from now: ${days30}`);
  console.log(`60 days from now: ${days60}\n`);

  // Test 1: Get all pending invoices
  console.log('1. All Pending Invoices:');
  const allPending = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
  `);
  console.log(`   Count: ${allPending[0].count}`);
  console.log(`   Total: $${allPending[0].totalAmount?.toLocaleString() || 0}\n`);

  // Test 2: Pending invoices with due dates in next 60 days
  console.log('2. Pending Invoices Due in Next 60 Days (No Production Filter):');
  const next60NoProd = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date <= $1
  `, days60);
  console.log(`   Count: ${next60NoProd[0].count}`);
  console.log(`   Total: $${next60NoProd[0].totalAmount?.toLocaleString() || 0}\n`);

  // Test 3: Pending invoices with due dates >= Nov 1, 2025 AND in next 60 days (Production Mode)
  console.log('3. Pending Invoices Due in Next 60 Days (WITH Production Filter >= Nov 1, 2025):');
  const next60WithProd = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date >= '2025-11-01'
      AND due_date <= $1
  `, days60);
  console.log(`   Count: ${next60WithProd[0].count}`);
  console.log(`   Total: $${next60WithProd[0].totalAmount?.toLocaleString() || 0}\n`);

  // Test 4: Break down by time periods (No Production Filter)
  console.log('4. Breakdown by Time Periods (No Production Filter):');

  const next30 = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date <= $1
  `, days30);

  const days31to60 = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date > $1
      AND due_date <= $2
  `, days30, days60);

  console.log(`   Next 30 days: ${next30[0].count} invoices, $${next30[0].totalAmount?.toLocaleString() || 0}`);
  console.log(`   31-60 days: ${days31to60[0].count} invoices, $${days31to60[0].totalAmount?.toLocaleString() || 0}`);
  console.log(`   Total: $${((next30[0].totalAmount || 0) + (days31to60[0].totalAmount || 0)).toLocaleString()}\n`);

  // Test 5: Break down by time periods (WITH Production Filter)
  console.log('5. Breakdown by Time Periods (WITH Production Filter >= Nov 1, 2025):');

  const next30Prod = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date >= '2025-11-01'
      AND due_date <= $1
  `, days30);

  const days31to60Prod = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date >= '2025-11-01'
      AND due_date > $1
      AND due_date <= $2
  `, days30, days60);

  console.log(`   Next 30 days: ${next30Prod[0].count} invoices, $${next30Prod[0].totalAmount?.toLocaleString() || 0}`);
  console.log(`   31-60 days: ${days31to60Prod[0].count} invoices, $${days31to60Prod[0].totalAmount?.toLocaleString() || 0}`);
  console.log(`   Total: $${((next30Prod[0].totalAmount || 0) + (days31to60Prod[0].totalAmount || 0)).toLocaleString()}\n`);

  // Test 6: Show sample invoices being excluded by production filter
  console.log('6. Sample Invoices Being EXCLUDED by Production Filter (due before Nov 1, 2025):');
  const excludedSample = await db.all(`
    SELECT
      invoice_number,
      client,
      amount_due,
      currency,
      due_date,
      status
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date < '2025-11-01'
      AND due_date <= $1
    ORDER BY amount_due DESC
    LIMIT 10
  `, days60);

  if (excludedSample.length > 0) {
    console.log('   Top 10 excluded invoices:');
    excludedSample.forEach(inv => {
      console.log(`   - ${inv.invoiceNumber}: ${inv.client}, $${inv.amountDue?.toLocaleString() || 0} ${inv.currency}, Due: ${inv.dueDate}`);
    });
  } else {
    console.log('   No invoices excluded\n');
  }

  // Test 7: Current month unpaid
  console.log('\n7. Current Month Unpaid Analysis:');
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const currentMonthUnpaid = await db.all(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount_due), 0) as total_amount
    FROM invoices
    WHERE status = 'Pending'
      AND due_date IS NOT NULL
      AND due_date >= $1
      AND due_date <= $2
  `, currentMonthStart, currentMonthEnd);

  console.log(`   Current month (${currentMonthStart} to ${currentMonthEnd}):`);
  console.log(`   Count: ${currentMonthUnpaid[0].count} invoices`);
  console.log(`   Total: $${currentMonthUnpaid[0].totalAmount?.toLocaleString() || 0}\n`);

  await db.close();
  console.log('Done!');
}

testCashflowCalculation().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
