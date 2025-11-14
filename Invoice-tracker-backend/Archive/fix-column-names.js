const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Fixing column names to match application expectations...\n');

    // Column mappings: current name -> expected name
    const invoicesColumnMap = {
      'invoiceNumber': 'invoice_number',
      'customerName': 'customer_name',
      'customerContract': 'customer_contract',
      'amountDue': 'amount_due',
      'dueDate': 'due_date',
      'invoiceDate': 'invoice_date',
      'pdfPath': 'pdf_path',
      'uploadedAt': 'uploaded_at',
      'uploadedBy': 'uploaded_by',
      'invoiceType': 'invoice_type',
      'isPaid': 'is_paid',
      'paidDate': 'paid_date',
      'additionalInfo': 'additional_info'
    };

    console.log('=== Renaming columns in invoices table ===\n');

    for (const [oldName, newName] of Object.entries(invoicesColumnMap)) {
      try {
        console.log(`Renaming ${oldName} -> ${newName}...`);
        await pool.query(`
          ALTER TABLE invoices
          RENAME COLUMN "${oldName}" TO ${newName}
        `);
        console.log(`✓ Renamed ${oldName} to ${newName}`);
      } catch (err) {
        if (err.code === '42703') {
          console.log(`⚠ Column ${oldName} doesn't exist, skipping`);
        } else if (err.code === '42P01') {
          console.log(`⚠ Table doesn't exist, skipping`);
        } else {
          console.error(`✗ Error renaming ${oldName}:`, err.message);
        }
      }
    }

    // Add missing columns
    console.log('\n=== Adding missing columns ===\n');

    const missingColumns = [
      { name: 'related_invoice_number', type: 'VARCHAR(255)', nullable: true },
      { name: 'po_number', type: 'VARCHAR(255)', nullable: true },
      { name: 'is_production', type: 'BOOLEAN', default: 'TRUE' }
    ];

    for (const col of missingColumns) {
      try {
        console.log(`Adding ${col.name}...`);
        let sql = `ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type}`;
        if (col.default) {
          sql += ` DEFAULT ${col.default}`;
        }
        await pool.query(sql);
        console.log(`✓ Added ${col.name}`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`⚠ Column ${col.name} already exists, skipping`);
        } else {
          console.error(`✗ Error adding ${col.name}:`, err.message);
        }
      }
    }

    // Fix expected_invoices table
    console.log('\n=== Fixing expected_invoices table ===\n');

    const expectedInvoicesMap = {
      'invoiceNumber': 'invoice_number',
      'customerName': 'customer_name',
      'customerContract': 'customer_contract',
      'expectedAmount': 'expected_amount',
      'expectedDate': 'expected_date',
      'createdAt': 'created_at'
    };

    for (const [oldName, newName] of Object.entries(expectedInvoicesMap)) {
      try {
        console.log(`Renaming ${oldName} -> ${newName}...`);
        await pool.query(`
          ALTER TABLE expected_invoices
          RENAME COLUMN "${oldName}" TO ${newName}
        `);
        console.log(`✓ Renamed ${oldName} to ${newName}`);
      } catch (err) {
        if (err.code === '42703') {
          console.log(`⚠ Column ${oldName} doesn't exist, skipping`);
        } else if (err.code === '42P01') {
          console.log(`⚠ Table doesn't exist, skipping`);
        } else {
          console.error(`✗ Error renaming ${oldName}:`, err.message);
        }
      }
    }

    // Create attachments table if missing
    console.log('\n=== Creating attachments table if missing ===\n');

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attachments (
          id SERIAL PRIMARY KEY,
          invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size INTEGER,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Attachments table created or already exists');
    } catch (err) {
      console.error('✗ Error creating attachments table:', err.message);
    }

    console.log('\n=== Verification ===\n');

    // Verify invoices columns
    const invoicesCols = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);

    console.log('Invoices table columns:');
    invoicesCols.rows.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

    console.log('\n✓ Column name fixes complete!');
    console.log('\nNext steps:');
    console.log('1. Restart backend: pm2 restart invoice-tracker-backend');
    console.log('2. Try uploading an invoice again');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
