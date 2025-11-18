const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Checking invoices table structure...\n');

    // Check if invoices table exists
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'invoices'
    `);

    if (tableCheck.rows.length === 0) {
      console.error('✗ invoices table does not exist!');
      console.log('\nYou need to run the database schema creation script.');
      console.log('See DEPLOYMENT-GUIDE.md for the complete schema.');
      process.exit(1);
    }

    console.log('✓ invoices table exists\n');

    // Get all columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);

    console.log('Current invoices table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check for required columns
    const columnNames = columns.rows.map(c => c.column_name);
    const requiredColumns = [
      'id',
      'invoice_number',
      'invoice_date',
      'due_date',
      'amount_due',
      'currency',
      'customer_name',
      'customer_contract',
      'status',
      'pdf_path',
      'uploaded_at',
      'invoice_type',
      'related_invoice_number',
      'po_number',
      'notes',
      'is_production'
    ];

    console.log('\n=== Required Columns Check ===');
    const missingColumns = [];
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      if (exists) {
        console.log(`✓ ${col}`);
      } else {
        console.log(`✗ ${col} - MISSING!`);
        missingColumns.push(col);
      }
    });

    if (missingColumns.length > 0) {
      console.log('\n⚠️  WARNING: Missing columns detected!');
      console.log('Missing columns:', missingColumns.join(', '));
      console.log('\nThe invoices table is incomplete.');
      console.log('You need to add these columns or recreate the table.');
      console.log('\nRefer to DEPLOYMENT-GUIDE.md for the complete schema.');
    } else {
      console.log('\n✓ All required columns exist');
    }

    // Check for other important tables
    console.log('\n=== Checking Other Tables ===');

    const tableSchemas = {
      'expected_invoices': ['id', 'invoice_number', 'customer_name', 'customer_contract', 'expected_amount', 'expected_date', 'created_at', 'notes'],
      'attachments': ['id', 'invoice_id', 'file_name', 'file_path', 'file_size', 'uploaded_at'],
      'users': ['id', 'username', 'email', 'password_hash', 'role', 'created_at', 'is_active', 'last_login', 'first_name', 'last_name', 'updated_at']
    };

    for (const [tableName, requiredCols] of Object.entries(tableSchemas)) {
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (result.rows.length > 0) {
        console.log(`\n✓ ${tableName} exists`);

        // Check columns
        const tableCols = await pool.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        const existingCols = tableCols.rows.map(c => c.column_name);
        const missingCols = requiredCols.filter(col => !existingCols.includes(col));

        if (missingCols.length > 0) {
          console.log(`  ⚠️  Missing columns: ${missingCols.join(', ')}`);
        } else {
          console.log(`  ✓ All required columns present`);
        }
      } else {
        console.log(`\n✗ ${tableName} - TABLE MISSING!`);
      }
    }

    console.log('\n=== Summary ===');
    if (missingColumns.length > 0) {
      console.log('⚠️  Action required: Add missing columns to invoices table');
      console.log('Run the fix script or refer to DEPLOYMENT-GUIDE.md');
    } else {
      console.log('✓ Database schema looks good!');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
