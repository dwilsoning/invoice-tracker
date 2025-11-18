const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Checking users table structure...\n');

    // Check table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('Current users table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'}, nullable: ${col.is_nullable})`);
    });

    const hasUsernameCol = columns.rows.some(col => col.column_name === 'username');
    const idColumn = columns.rows.find(col => col.column_name === 'id');
    const isIdAutoIncrement = idColumn?.column_default?.includes('nextval');

    console.log('\nAnalysis:');
    console.log('  - Username column exists:', hasUsernameCol);
    console.log('  - ID is auto-increment:', isIdAutoIncrement);

    if (!hasUsernameCol) {
      console.log('\n⚠ WARNING: username column is missing!');
      console.log('The routes/users.js expects a username column.');
      console.log('\nAdding username column...');

      await pool.query(`
        ALTER TABLE users
        ADD COLUMN username VARCHAR(100)
      `);

      console.log('✓ Added username column');

      // Populate existing users with username from email
      await pool.query(`
        UPDATE users
        SET username = split_part(email, '@', 1)
        WHERE username IS NULL
      `);

      console.log('✓ Populated username for existing users from email');
    }

    // Make username unique if not already
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
    `);

    const hasUsernameUnique = constraints.rows.some(c => c.constraint_name.includes('username'));

    if (hasUsernameCol && !hasUsernameUnique) {
      console.log('\nAdding unique constraint to username...');
      try {
        await pool.query(`
          ALTER TABLE users
          ADD CONSTRAINT users_username_unique UNIQUE (username)
        `);
        console.log('✓ Added unique constraint to username');
      } catch (err) {
        if (err.code === '23505') {
          console.log('⚠ Duplicate usernames exist, cannot add unique constraint');
          console.log('  You may need to manually fix duplicate usernames');
        } else {
          throw err;
        }
      }
    }

    console.log('\n✓ Users table structure is ready for user creation');
    console.log('\nNext step: Restart backend server');
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
