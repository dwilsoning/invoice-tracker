const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection - use environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

async function fixCreditMemoDates() {
  console.log('🔧 Starting Credit Memo Date Correction...\n');
  console.log('='.repeat(80));

  try {
    // First, get all credit memos
    console.log('\n📋 Fetching all credit memos...');
    const result = await pool.query(`
      SELECT id, invoice_number, invoice_date, due_date, client
      FROM invoices
      WHERE invoice_type = 'Credit Memo'
      ORDER BY invoice_date DESC
    `);

    const creditMemos = result.rows;
    console.log(`Found ${creditMemos.length} credit memos\n`);

    if (creditMemos.length === 0) {
      console.log('No credit memos found. Nothing to update.');
      await pool.end();
      return;
    }

    // Display current state
    console.log('Current Credit Memo Dates:');
    console.log('='.repeat(80));
    console.log('Invoice Number'.padEnd(20) + 'Client'.padEnd(30) + 'Invoice Date'.padEnd(15) + 'Due Date');
    console.log('-'.repeat(80));

    let needsUpdate = 0;
    for (const memo of creditMemos) {
      // Convert dates to strings if they're Date objects
      let invoiceDate = memo.invoice_date;
      let dueDate = memo.due_date;

      if (invoiceDate instanceof Date) {
        invoiceDate = invoiceDate.toISOString().split('T')[0];
      } else if (invoiceDate) {
        invoiceDate = String(invoiceDate);
      } else {
        invoiceDate = 'NULL';
      }

      if (dueDate instanceof Date) {
        dueDate = dueDate.toISOString().split('T')[0];
      } else if (dueDate) {
        dueDate = String(dueDate);
      } else {
        dueDate = 'NULL';
      }

      const match = invoiceDate === dueDate ? '✓' : '✗';

      console.log(
        `${match} ${memo.invoice_number.padEnd(17)}`.padEnd(20) +
        (memo.client || 'N/A').substring(0, 28).padEnd(30) +
        invoiceDate.padEnd(15) +
        dueDate
      );

      if (invoiceDate !== dueDate) {
        needsUpdate++;
      }
    }

    console.log('='.repeat(80));
    console.log(`\n${needsUpdate} credit memo(s) need date correction\n`);

    if (needsUpdate === 0) {
      console.log('✓ All credit memo dates are already synchronized!');
      await pool.end();
      return;
    }

    // Update credit memos where dates don't match
    console.log('🔄 Updating credit memo dates...\n');

    const updateResult = await pool.query(`
      UPDATE invoices
      SET due_date = invoice_date
      WHERE invoice_type = 'Credit Memo'
        AND (due_date IS NULL OR due_date != invoice_date)
      RETURNING id, invoice_number, invoice_date, due_date
    `);

    console.log(`✓ Updated ${updateResult.rows.length} credit memo(s)\n`);

    // Display updated records
    if (updateResult.rows.length > 0) {
      console.log('Updated Credit Memos:');
      console.log('='.repeat(80));
      console.log('Invoice Number'.padEnd(20) + 'Invoice Date'.padEnd(15) + 'Due Date'.padEnd(15) + 'Status');
      console.log('-'.repeat(80));

      for (const memo of updateResult.rows) {
        // Convert dates to strings if they're Date objects
        let invoiceDate = memo.invoice_date;
        let dueDate = memo.due_date;

        if (invoiceDate instanceof Date) {
          invoiceDate = invoiceDate.toISOString().split('T')[0];
        } else if (invoiceDate) {
          invoiceDate = String(invoiceDate);
        } else {
          invoiceDate = 'NULL';
        }

        if (dueDate instanceof Date) {
          dueDate = dueDate.toISOString().split('T')[0];
        } else if (dueDate) {
          dueDate = String(dueDate);
        } else {
          dueDate = 'NULL';
        }

        const match = invoiceDate === dueDate ? '✓ Match' : '✗ Mismatch';
        console.log(
          memo.invoice_number.padEnd(20) +
          invoiceDate.padEnd(15) +
          dueDate.padEnd(15) +
          match
        );
      }
      console.log('='.repeat(80));
    }

    // Verify the changes
    console.log('\n🔍 Verifying changes...\n');

    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_credit_memos,
        COUNT(CASE WHEN invoice_date = due_date THEN 1 END) as matching_dates,
        COUNT(CASE WHEN invoice_date != due_date OR due_date IS NULL THEN 1 END) as mismatched_dates
      FROM invoices
      WHERE invoice_type = 'Credit Memo'
    `);

    const stats = verifyResult.rows[0];
    console.log('Final Statistics:');
    console.log('='.repeat(80));
    console.log(`Total Credit Memos:        ${stats.total_credit_memos}`);
    console.log(`Matching Dates:            ${stats.matching_dates}`);
    console.log(`Mismatched Dates:          ${stats.mismatched_dates}`);
    console.log('='.repeat(80));

    if (parseInt(stats.mismatched_dates) === 0) {
      console.log('\n✓ SUCCESS: All credit memo dates are now synchronized!');
    } else {
      console.log('\n⚠️  WARNING: Some credit memos still have mismatched dates.');
      console.log('   This may be due to NULL invoice_date values.');
    }

    console.log('\n✓ Credit Memo Date Correction Complete!\n');

  } catch (error) {
    console.error('\n❌ Error fixing credit memo dates:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixCreditMemoDates();
