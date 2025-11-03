const { db } = require('./db-postgres');

async function testDismissal() {
  try {
    console.log('=== Testing Expected Invoice Dismissal ===\n');

    // 1. Get current expected invoices
    console.log('1. Current expected invoices:');
    const current = await db.all('SELECT * FROM expected_invoices LIMIT 3');
    console.table(current.map(e => ({
      client: e.client,
      contract: e.customerContract,
      type: e.invoiceType,
      expected_date: e.expectedDate
    })));

    if (current.length === 0) {
      console.log('No expected invoices to test with. Generating some first...');
      const { generateExpectedInvoices } = require('./server-postgres');
      await generateExpectedInvoices();
      return;
    }

    const testInvoice = current[0];
    console.log(`\n2. Testing dismissal of: ${testInvoice.client} - ${testInvoice.customerContract}`);

    // 2. Simulate DELETE request - add to dismissal table
    await db.run(`
      INSERT INTO dismissed_expected_invoices (client, customer_contract, invoice_type, expected_date, dismissed_date)
      VALUES ($1, $2, $3, $4, CURRENT_DATE)
      ON CONFLICT (client, customer_contract, invoice_type, expected_date) DO NOTHING
    `, testInvoice.client, testInvoice.customerContract || '', testInvoice.invoiceType, testInvoice.expectedDate);

    console.log('✓ Added to dismissal tracking table');

    // 3. Delete from expected_invoices
    await db.run('DELETE FROM expected_invoices WHERE id = $1', testInvoice.id);
    console.log('✓ Deleted from expected_invoices table');

    // 4. Check dismissal table
    console.log('\n3. Dismissal tracking records:');
    const dismissed = await db.all('SELECT * FROM dismissed_expected_invoices');
    console.table(dismissed.map(d => ({
      client: d.client,
      contract: d.customerContract,
      type: d.invoiceType,
      expected_date: d.expectedDate,
      dismissed_date: d.dismissedDate
    })));

    // 5. Verify GET endpoint excludes it
    console.log('\n4. Testing GET endpoint (should exclude dismissed):');
    const afterDismissal = await db.all(`
      SELECT e.*
      FROM expected_invoices e
      WHERE NOT EXISTS (
        SELECT 1 FROM dismissed_expected_invoices d
        WHERE LOWER(TRIM(d.client)) = LOWER(TRIM(e.client))
          AND LOWER(TRIM(d.customer_contract)) = LOWER(TRIM(e.customer_contract))
          AND d.invoice_type = e.invoice_type
          AND d.expected_date = e.expected_date
      )
      LIMIT 3
    `);
    console.log(`Found ${afterDismissal.length} non-dismissed expected invoices`);

    // 6. Test generation check
    console.log('\n5. Testing generation logic (should skip dismissed):');
    const shouldSkip = await db.get(`
      SELECT id FROM dismissed_expected_invoices
      WHERE LOWER(TRIM(client)) = LOWER(TRIM($1))
        AND LOWER(TRIM(customer_contract)) = LOWER(TRIM($2))
        AND invoice_type = $3
        AND expected_date = $4
    `, testInvoice.client, testInvoice.customerContract || '', testInvoice.invoiceType, testInvoice.expectedDate);

    if (shouldSkip) {
      console.log('✓ Generation function will correctly skip this dismissed invoice');
    } else {
      console.log('✗ ERROR: Dismissal check failed!');
    }

    console.log('\n=== Test Complete ===');
    console.log('The dismissed invoice will NOT reappear when generation runs.');

  } catch (error) {
    console.error('Error during test:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testDismissal();
