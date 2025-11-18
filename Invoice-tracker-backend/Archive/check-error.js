const { hashPassword } = require('./utils/auth');
const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Testing authentication system...\n');

    // Test 1: Check if utils/auth.js works
    console.log('Test 1: Testing hashPassword function');
    try {
      const testPassword = 'TestPassword123!';
      const hash = hashPassword(testPassword);
      console.log('✓ hashPassword works');
      console.log('  Generated hash:', hash.substring(0, 30) + '...');
      console.log('  Contains period (salt.hash format):', hash.includes('.') ? 'YES' : 'NO');
      console.log('  Hash parts:', hash.split('.').length === 2 ? '2 parts (correct)' : 'INCORRECT');
    } catch (err) {
      console.error('✗ hashPassword failed:', err.message);
    }

    // Test 2: Check database connection
    console.log('\nTest 2: Testing database connection');
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✓ Database connection works');
      console.log('  Current time from DB:', result.rows[0].now);
    } catch (err) {
      console.error('✗ Database connection failed:', err.message);
    }

    // Test 3: Check users table structure
    console.log('\nTest 3: Checking users table structure');
    try {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      console.log('✓ Users table columns:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } catch (err) {
      console.error('✗ Could not check users table:', err.message);
    }

    // Test 4: Check existing admin user
    console.log('\nTest 4: Checking for existing admin user');
    try {
      const result = await pool.query(
        'SELECT id, username, email, role, is_active, LENGTH(password_hash) as hash_length FROM users WHERE username = $1',
        ['admin']
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log('✓ Admin user found:');
        console.log(`  - ID: ${user.id}`);
        console.log(`  - Username: ${user.username}`);
        console.log(`  - Email: ${user.email}`);
        console.log(`  - Role: ${user.role}`);
        console.log(`  - Active: ${user.is_active}`);
        console.log(`  - Password hash length: ${user.hash_length} characters`);
      } else {
        console.log('✗ No admin user found');
      }
    } catch (err) {
      console.error('✗ Error checking admin user:', err.message);
    }

    // Test 5: Check if auth route is working
    console.log('\nTest 5: Checking server configuration');
    try {
      const envCheck = {
        PORT: process.env.PORT || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        DB_HOST: process.env.DB_HOST || 'NOT SET',
        DB_NAME: process.env.DB_NAME || 'NOT SET',
        DB_USER: process.env.DB_USER || 'NOT SET',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET (hidden)' : 'NOT SET',
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'NOT SET'
      };
      console.log('Environment variables:');
      Object.entries(envCheck).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value}`);
      });
    } catch (err) {
      console.error('✗ Error checking environment:', err.message);
    }

    console.log('\n================================');
    console.log('Diagnostic check complete');
    console.log('================================\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\nFatal error:', err);
    await pool.end();
    process.exit(1);
  }
})();
