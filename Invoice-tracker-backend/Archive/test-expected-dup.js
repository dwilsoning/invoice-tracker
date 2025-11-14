const { db } = require('./db-postgres');

async function testExpectedInvoiceDuplicates() {
  try {
    console.log('\n=== Testing Expected Invoice Duplicates Issue ===\n');

    // Check for contract 495893
    console.log('1. Querying all expected invoices for contract 495893:');
    const contract495893 = await db.all(`
      SELECT id, client, customer_contract, invoice_type, expected_date,
             expected_amount, acknowledged, acknowledged_date, created_date
      FROM expected_invoices
      WHERE customer_contract = $1
      ORDER BY id
    `, '495893');

    console.log(`Found ${contract495893.length} expected invoice(s):`);
    contract495893.forEach(inv => {
      console.log(`  ID: ${inv.id}`);
      console.log(`  Client: ${inv.client}`);
      console.log(`  Contract: ${inv.customerContract}`);
      console.log(`  Type: ${inv.invoiceType}`);
      console.log(`  Expected Date: ${inv.expectedDate}`);
      console.log(`  Acknowledged: ${inv.acknowledged}`);
      console.log(`  Acknowledged Date: ${inv.acknowledgedDate}`);
      console.log(`  Created Date: ${inv.createdDate}`);
      console.log('  ---');
    });

    // Check for any duplicates based on client, contract, invoice type, and expected date
    console.log('\n2. Checking for duplicate entries (same client, contract, type, expected date):');
    const duplicates = await db.all(`
      SELECT client, customer_contract, invoice_type, expected_date, COUNT(*) as count
      FROM expected_invoices
      GROUP BY client, customer_contract, invoice_type, expected_date
      HAVING COUNT(*) > 1
      ORDER BY count DESC, client
    `);

    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate group(s):`);
      for (const dup of duplicates) {
        console.log(`\n  Client: ${dup.client}`);
        console.log(`  Contract: ${dup.customerContract}`);
        console.log(`  Type: ${dup.invoiceType}`);
        console.log(`  Expected Date: ${dup.expectedDate}`);
        console.log(`  Count: ${dup.count}`);

        // Get details of each duplicate
        const details = await db.all(`
          SELECT id, acknowledged, acknowledged_date, created_date
          FROM expected_invoices
          WHERE client = $1
            AND customer_contract = $2
            AND invoice_type = $3
            AND expected_date = $4
          ORDER BY id
        `, dup.client, dup.customerContract || '', dup.invoiceType, dup.expectedDate);

        console.log('  Details:');
        details.forEach(d => {
          console.log(`    ID: ${d.id}, Acknowledged: ${d.acknowledged}, Ack Date: ${d.acknowledgedDate}, Created: ${d.createdDate}`);
        });
      }
    } else {
      console.log('No duplicate entries found.');
    }

    // Check the generateExpectedInvoices logic - see if there are multiple invoices that could generate the same expected invoice
    console.log('\n3. Checking source invoices that could generate expected invoices for contract 495893:');
    const sourceInvoices = await db.all(`
      SELECT id, client, customer_contract, invoice_type, invoice_date, invoice_number, frequency
      FROM invoices
      WHERE customer_contract = $1 AND frequency != 'adhoc'
      ORDER BY client, invoice_type, invoice_date DESC
    `, '495893');

    console.log(`Found ${sourceInvoices.length} source invoice(s) with recurring frequency:`);
    sourceInvoices.forEach(inv => {
      console.log(`  ID: ${inv.id}, Type: ${inv.invoiceType}, Date: ${inv.invoiceDate}, Number: ${inv.invoiceNumber}, Frequency: ${inv.frequency}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

testExpectedInvoiceDuplicates();
