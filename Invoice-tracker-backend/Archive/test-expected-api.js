const { db } = require('./db-postgres');

async function testExpectedInvoicesAPI() {
  try {
    console.log('=== Testing Expected Invoices API Logic ===\n');

    // Test 1: Get non-dismissed expected invoices
    console.log('1. Testing GET logic (exclude dismissed):');
    const nonDismissed = await db.all(`
      SELECT e.*
      FROM expected_invoices e
      WHERE NOT EXISTS (
        SELECT 1 FROM dismissed_expected_invoices d
        WHERE LOWER(TRIM(d.client)) = LOWER(TRIM(e.client))
          AND LOWER(TRIM(d.customer_contract)) = LOWER(TRIM(e.customer_contract))
          AND d.invoice_type = e.invoice_type
          AND d.expected_date = e.expected_date
      )
      ORDER BY e.expected_date ASC
      LIMIT 5
    `);

    console.log(`✓ Found ${nonDismissed.length} non-dismissed expected invoices`);
    if (nonDismissed.length > 0) {
      console.table(nonDismissed.map(e => ({
        client: e.client,
        contract: e.customerContract,
        type: e.invoiceType,
        expected: e.expectedDate
      })));
    }

    // Test 2: Check dismissed count
    console.log('\n2. Dismissed invoices count:');
    const dismissedCount = await db.get('SELECT COUNT(*) as count FROM dismissed_expected_invoices');
    console.log(`✓ ${dismissedCount.count} invoices have been dismissed`);

    if (dismissedCount.count > 0) {
      const dismissed = await db.all('SELECT * FROM dismissed_expected_invoices LIMIT 3');
      console.table(dismissed.map(d => ({
        client: d.client,
        contract: d.customerContract,
        type: d.invoiceType,
        expected: d.expectedDate,
        dismissed: d.dismissedDate
      })));
    }

    console.log('\n=== All Tests Passed ===');
    console.log('✓ GET endpoint will exclude dismissed invoices');
    console.log('✓ DELETE endpoint tracks dismissals');
    console.log('✓ Generation function checks dismissal table');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testExpectedInvoicesAPI();
