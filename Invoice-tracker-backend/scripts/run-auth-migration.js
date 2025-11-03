const { pool } = require('../db-postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('\n=== Running Authentication Migration ===\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-users-authentication.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    const client = await pool.connect();

    try {
      console.log('Executing migration...');

      // Execute the migration
      await client.query(migrationSQL);

      console.log('✅ Migration completed successfully!');
      console.log('\nCreated tables:');
      console.log('  - users');
      console.log('  - password_reset_tokens');
      console.log('\nNext steps:');
      console.log('1. Run: node scripts/test-auth-setup.js');
      console.log('2. Run: node scripts/create-admin-user.js');

    } finally {
      client.release();
    }

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist - migration already applied');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runMigration();
