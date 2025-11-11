const { pool } = require('./db-postgres');

// Define the correct schema with snake_case column names
const CORRECT_SCHEMA = {
  invoices: {
    id: { type: 'SERIAL PRIMARY KEY' },
    invoice_number: { type: 'VARCHAR(255)', nullable: false },
    customer_name: { type: 'VARCHAR(255)', nullable: true },
    customer_contract: { type: 'VARCHAR(255)', nullable: true },
    amount_due: { type: 'NUMERIC', nullable: false },
    currency: { type: 'VARCHAR(10)', default: "'USD'" },
    due_date: { type: 'DATE', nullable: true },
    invoice_date: { type: 'DATE', nullable: true },
    status: { type: 'VARCHAR(50)', default: "'Pending'" },
    frequency: { type: 'VARCHAR(50)', nullable: true },
    invoice_type: { type: 'VARCHAR(50)', default: "'Invoice'" },
    pdf_path: { type: 'VARCHAR(500)', nullable: true },
    uploaded_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    uploaded_by: { type: 'INTEGER', nullable: true },
    notes: { type: 'TEXT', nullable: true },
    is_paid: { type: 'BOOLEAN', default: 'FALSE' },
    paid_date: { type: 'DATE', nullable: true },
    additional_info: { type: 'TEXT', nullable: true },
    related_invoice_number: { type: 'VARCHAR(255)', nullable: true },
    po_number: { type: 'VARCHAR(255)', nullable: true },
    is_production: { type: 'BOOLEAN', default: 'TRUE' },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  },
  expected_invoices: {
    id: { type: 'SERIAL PRIMARY KEY' },
    invoice_number: { type: 'VARCHAR(255)', nullable: true },
    customer_name: { type: 'VARCHAR(255)', nullable: true },
    customer_contract: { type: 'VARCHAR(255)', nullable: true },
    expected_amount: { type: 'NUMERIC', nullable: true },
    expected_date: { type: 'DATE', nullable: true },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    notes: { type: 'TEXT', nullable: true }
  },
  attachments: {
    id: { type: 'SERIAL PRIMARY KEY' },
    invoice_id: { type: 'INTEGER REFERENCES invoices(id) ON DELETE CASCADE' },
    file_name: { type: 'VARCHAR(255)', nullable: false },
    file_path: { type: 'VARCHAR(500)', nullable: false },
    file_size: { type: 'INTEGER', nullable: true },
    uploaded_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  },
  users: {
    id: { type: 'SERIAL PRIMARY KEY' },
    username: { type: 'VARCHAR(100)', nullable: false },
    email: { type: 'VARCHAR(255)', nullable: false },
    password_hash: { type: 'VARCHAR(255)', nullable: false },
    role: { type: 'VARCHAR(50)', nullable: true },
    created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
    is_active: { type: 'BOOLEAN', default: 'TRUE' },
    last_login: { type: 'TIMESTAMP', nullable: true },
    first_name: { type: 'VARCHAR(100)', nullable: true },
    last_name: { type: 'VARCHAR(100)', nullable: true },
    updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  }
};

// Convert camelCase to snake_case
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Get current table columns
async function getTableColumns(tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  return result.rows.map(row => ({
    name: row.column_name,
    type: row.data_type,
    nullable: row.is_nullable === 'YES',
    default: row.column_default
  }));
}

// Check if table exists
async function tableExists(tableName) {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    )
  `, [tableName]);

  return result.rows[0].exists;
}

// Create table if it doesn't exist
async function createTable(tableName, schema) {
  console.log(`\nCreating table: ${tableName}`);

  const columns = Object.entries(schema).map(([colName, colDef]) => {
    let sql = `${colName} ${colDef.type}`;
    if (colDef.nullable === false) {
      sql += ' NOT NULL';
    }
    if (colDef.default) {
      sql += ` DEFAULT ${colDef.default}`;
    }
    return sql;
  }).join(',\n  ');

  const createSQL = `CREATE TABLE ${tableName} (\n  ${columns}\n)`;

  try {
    await pool.query(createSQL);
    console.log(`✓ Created table ${tableName}`);
    return true;
  } catch (err) {
    console.error(`✗ Error creating table ${tableName}:`, err.message);
    return false;
  }
}

// Rename column if needed
async function renameColumn(tableName, oldName, newName) {
  try {
    await pool.query(`
      ALTER TABLE ${tableName}
      RENAME COLUMN "${oldName}" TO ${newName}
    `);
    console.log(`  ✓ Renamed ${oldName} -> ${newName}`);
    return true;
  } catch (err) {
    console.error(`  ✗ Error renaming ${oldName}:`, err.message);
    return false;
  }
}

// Add missing column
async function addColumn(tableName, colName, colDef) {
  try {
    let sql = `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef.type}`;
    if (colDef.nullable === false) {
      sql += ' NOT NULL';
    }
    if (colDef.default) {
      sql += ` DEFAULT ${colDef.default}`;
    }

    await pool.query(sql);
    console.log(`  ✓ Added column ${colName}`);
    return true;
  } catch (err) {
    if (err.code === '42701') {
      console.log(`  ⚠ Column ${colName} already exists`);
      return true;
    }
    console.error(`  ✗ Error adding column ${colName}:`, err.message);
    return false;
  }
}

// Main function
async function checkAndFixSchema() {
  console.log('=================================================');
  console.log('Database Schema Check and Fix Tool');
  console.log('=================================================\n');

  const results = {
    tablesChecked: 0,
    tablesCreated: 0,
    columnsRenamed: 0,
    columnsAdded: 0,
    errors: []
  };

  for (const [tableName, expectedSchema] of Object.entries(CORRECT_SCHEMA)) {
    results.tablesChecked++;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Checking table: ${tableName}`);
    console.log('='.repeat(50));

    // Check if table exists
    const exists = await tableExists(tableName);

    if (!exists) {
      console.log(`⚠ Table ${tableName} does not exist`);
      const created = await createTable(tableName, expectedSchema);
      if (created) {
        results.tablesCreated++;
      } else {
        results.errors.push(`Failed to create table ${tableName}`);
      }
      continue;
    }

    console.log(`✓ Table ${tableName} exists`);

    // Get current columns
    const currentColumns = await getTableColumns(tableName);
    const currentColNames = currentColumns.map(c => c.name);
    const expectedColNames = Object.keys(expectedSchema);

    console.log(`\nCurrent columns: ${currentColNames.length}`);
    console.log(`Expected columns: ${expectedColNames.length}`);

    // Check for columns that need renaming (camelCase -> snake_case)
    console.log('\n--- Checking for camelCase columns ---');
    let foundCamelCase = false;

    for (const currentCol of currentColumns) {
      const snakeCaseName = camelToSnake(currentCol.name);

      // Skip if already in snake_case
      if (currentCol.name === snakeCaseName) {
        continue;
      }

      // Check if the snake_case version is in our expected schema
      if (expectedColNames.includes(snakeCaseName)) {
        foundCamelCase = true;
        console.log(`Found camelCase column: ${currentCol.name} -> should be ${snakeCaseName}`);
        const renamed = await renameColumn(tableName, currentCol.name, snakeCaseName);
        if (renamed) {
          results.columnsRenamed++;
          // Update currentColNames for further checks
          const idx = currentColNames.indexOf(currentCol.name);
          if (idx !== -1) {
            currentColNames[idx] = snakeCaseName;
          }
        } else {
          results.errors.push(`Failed to rename ${tableName}.${currentCol.name}`);
        }
      }
    }

    if (!foundCamelCase) {
      console.log('✓ No camelCase columns found');
    }

    // Check for missing columns
    console.log('\n--- Checking for missing columns ---');
    const missingColumns = expectedColNames.filter(col => !currentColNames.includes(col));

    if (missingColumns.length === 0) {
      console.log('✓ All expected columns present');
    } else {
      console.log(`Found ${missingColumns.length} missing column(s):`);
      for (const colName of missingColumns) {
        console.log(`Missing: ${colName}`);
        const added = await addColumn(tableName, colName, expectedSchema[colName]);
        if (added) {
          results.columnsAdded++;
        } else {
          results.errors.push(`Failed to add ${tableName}.${colName}`);
        }
      }
    }

    // Check for extra columns (informational only)
    console.log('\n--- Checking for extra columns ---');
    const extraColumns = currentColNames.filter(col => !expectedColNames.includes(col));

    if (extraColumns.length === 0) {
      console.log('✓ No unexpected columns found');
    } else {
      console.log(`⚠ Found ${extraColumns.length} extra column(s) (not removed):`);
      extraColumns.forEach(col => console.log(`  - ${col}`));
    }
  }

  // Final summary
  console.log('\n\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`Tables checked: ${results.tablesChecked}`);
  console.log(`Tables created: ${results.tablesCreated}`);
  console.log(`Columns renamed: ${results.columnsRenamed}`);
  console.log(`Columns added: ${results.columnsAdded}`);

  if (results.errors.length > 0) {
    console.log(`\n⚠ Errors encountered: ${results.errors.length}`);
    results.errors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('\n✓ All checks passed!');
  }

  // Verify final state
  console.log('\n\n' + '='.repeat(50));
  console.log('VERIFICATION - Final Table Structures');
  console.log('='.repeat(50));

  for (const tableName of Object.keys(CORRECT_SCHEMA)) {
    const exists = await tableExists(tableName);
    if (!exists) {
      console.log(`\n✗ ${tableName}: DOES NOT EXIST`);
      continue;
    }

    const columns = await getTableColumns(tableName);
    console.log(`\n✓ ${tableName} (${columns.length} columns):`);
    columns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}`);
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log('Database schema check complete!');
  console.log('='.repeat(50));

  if (results.columnsRenamed > 0 || results.columnsAdded > 0 || results.tablesCreated > 0) {
    console.log('\n⚠ CHANGES WERE MADE - Restart your backend:');
    console.log('   pm2 restart invoice-tracker-backend');
  } else {
    console.log('\n✓ No changes needed - database schema is correct');
  }

  return results;
}

// Run the check
(async () => {
  try {
    await checkAndFixSchema();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
