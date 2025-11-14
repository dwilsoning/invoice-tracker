const { db } = require('./db-postgres');

async function checkExpectedRevenue() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const days30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log('Today:', today);
    console.log('30 days from now:', days30);
    console.log('\n--- Pending Invoices Analysis ---\n');

    // Get all pending invoices
    const allPending = await db.all(`
      SELECT COUNT(*) as count, SUM(amount_due) as total, currency
      FROM invoices
      WHERE status = 'Pending'
      GROUP BY currency
    `);

    console.log('All Pending Invoices by Currency:');
    allPending.forEach(row => {
      console.log(`  ${row.currency}: ${row.count} invoices, $${Number(row.total).toLocaleString()}`);
    });

    // Get overdue
    const overdue = await db.all(`
      SELECT COUNT(*) as count, SUM(amount_due) as total, currency
      FROM invoices
      WHERE status = 'Pending' AND due_date < $1
      GROUP BY currency
    `, today);

    console.log('\nOverdue Invoices (due before today):');
    overdue.forEach(row => {
      console.log(`  ${row.currency}: ${row.count} invoices, $${Number(row.total).toLocaleString()}`);
    });

    // Get due in next 30 days (not including overdue)
    const next30 = await db.all(`
      SELECT COUNT(*) as count, SUM(amount_due) as total, currency
      FROM invoices
      WHERE status = 'Pending' AND due_date >= $1 AND due_date <= $2
      GROUP BY currency
    `, today, days30);

    console.log('\nDue in Next 30 Days (today to +30 days, excluding overdue):');
    next30.forEach(row => {
      console.log(`  ${row.currency}: ${row.count} invoices, $${Number(row.total).toLocaleString()}`);
    });

    // Get combined (overdue + next 30) - this is what the current code calculates
    const combined = await db.all(`
      SELECT COUNT(*) as count, SUM(amount_due) as total, currency
      FROM invoices
      WHERE status = 'Pending' AND due_date <= $1
      GROUP BY currency
    `, days30);

    // Get combined excluding credit memos - NEW CALCULATION
    const combinedNoCredit = await db.all(`
      SELECT COUNT(*) as count, SUM(amount_due) as total, currency
      FROM invoices
      WHERE status = 'Pending' AND due_date <= $1 AND invoice_type != 'Credit Memo'
      GROUP BY currency
    `, days30);

    console.log('\nCombined (Overdue + Next 30 Days) - OLD CALCULATION (includes credit memos):');
    combined.forEach(row => {
      console.log(`  ${row.currency}: ${row.count} invoices, $${Number(row.total).toLocaleString()}`);
    });

    // Total in USD (approximate conversion)
    const totalCombined = combined.reduce((sum, row) => {
      const rate = row.currency === 'USD' ? 1 : row.currency === 'AUD' ? 0.65 : 1;
      return sum + (Number(row.total) * rate);
    }, 0);

    console.log(`Total Combined in USD (approx): $${Math.round(totalCombined).toLocaleString()}`);

    console.log('\nCombined (Overdue + Next 30 Days) - NEW CALCULATION (excludes credit memos):');
    combinedNoCredit.forEach(row => {
      console.log(`  ${row.currency}: ${row.count} invoices, $${Number(row.total).toLocaleString()}`);
    });

    const totalCombinedNoCredit = combinedNoCredit.reduce((sum, row) => {
      const rate = row.currency === 'USD' ? 1 : row.currency === 'AUD' ? 0.65 : 1;
      return sum + (Number(row.total) * rate);
    }, 0);

    console.log(`Total Combined in USD (approx): $${Math.round(totalCombinedNoCredit).toLocaleString()}`);

    await db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkExpectedRevenue();
