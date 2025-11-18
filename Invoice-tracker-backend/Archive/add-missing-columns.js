const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Checking and adding missing columns to users table...\n');

    // Check if last_login column exists
    const checkLastLogin = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'last_login'
    `);

    if (checkLastLogin.rows.length === 0) {
      console.log('Adding last_login column...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN last_login TIMESTAMP
      `);
      console.log('✓ Added last_login column');
    } else {
      console.log('✓ last_login column already exists');
    }

    // Check if first_name column exists
    const checkFirstName = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'first_name'
    `);

    if (checkFirstName.rows.length === 0) {
      console.log('Adding first_name column...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN first_name VARCHAR(100)
      `);
      console.log('✓ Added first_name column');
    } else {
      console.log('✓ first_name column already exists');
    }

    // Check if last_name column exists
    const checkLastName = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'last_name'
    `);

    if (checkLastName.rows.length === 0) {
      console.log('Adding last_name column...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN last_name VARCHAR(100)
      `);
      console.log('✓ Added last_name column');
    } else {
      console.log('✓ last_name column already exists');
    }

    // Check if updated_at column exists
    const checkUpdatedAt = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'updated_at'
    `);

    if (checkUpdatedAt.rows.length === 0) {
      console.log('Adding updated_at column...');
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✓ Added updated_at column');
    } else {
      console.log('✓ updated_at column already exists');
    }

    console.log('\n=== Verifying users table structure ===');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\nUsers table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✓ All missing columns added successfully!');
    console.log('\nNext step: Restart the backend server');
    console.log('Run: pm2 restart invoice-tracker-backend');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
})();
