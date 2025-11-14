const { db } = require('./db-postgres');

async function cleanupExpectedDuplicates() {
  try {
    console.log('\n=== Cleaning Up Expected Invoice Duplicates ===\n');

    // Find all duplicate groups
    const duplicateGroups = await db.all(`
      SELECT client, customer_contract, invoice_type, expected_date
      FROM expected_invoices
      GROUP BY client, customer_contract, invoice_type, expected_date
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicateGroups.length} duplicate groups to clean up.\n`);

    let totalDeleted = 0;

    for (const group of duplicateGroups) {
      // Get all records in this group, ordered by:
      // 1. Keep acknowledged ones first (in case we need to keep one)
      // 2. Then by created_date descending (keep most recent)
      const records = await db.all(`
        SELECT id, acknowledged, acknowledged_date, created_date
        FROM expected_invoices
        WHERE client = $1
          AND customer_contract = $2
          AND invoice_type = $3
          AND expected_date = $4
        ORDER BY
          acknowledged DESC,
          created_date DESC
      `, group.client, group.customerContract || '', group.invoiceType, group.expectedDate);

      console.log(`Group: ${group.client} - ${group.customerContract} - ${group.invoiceType} - ${group.expectedDate}`);
      console.log(`  Found ${records.length} records`);

      // Keep the first one (most recently acknowledged or most recently created)
      const toKeep = records[0];
      const toDelete = records.slice(1);

      console.log(`  Keeping: ID ${toKeep.id} (Acknowledged: ${toKeep.acknowledged}, Created: ${toKeep.createdDate})`);

      // Delete the rest
      for (const record of toDelete) {
        console.log(`  Deleting: ID ${record.id} (Acknowledged: ${record.acknowledged}, Created: ${record.createdDate})`);
        await db.run('DELETE FROM expected_invoices WHERE id = $1', record.id);
        totalDeleted++;
      }
      console.log('');
    }

    console.log(`\nCleanup complete! Deleted ${totalDeleted} duplicate records.\n`);

    // Verify no more duplicates
    const remainingDuplicates = await db.all(`
      SELECT client, customer_contract, invoice_type, expected_date, COUNT(*) as count
      FROM expected_invoices
      GROUP BY client, customer_contract, invoice_type, expected_date
      HAVING COUNT(*) > 1
    `);

    if (remainingDuplicates.length === 0) {
      console.log('✓ All duplicates have been removed successfully!\n');
    } else {
      console.log(`⚠ Warning: Still have ${remainingDuplicates.length} duplicate groups remaining.\n`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

cleanupExpectedDuplicates();
