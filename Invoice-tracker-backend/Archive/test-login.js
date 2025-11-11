const { db } = require('./db-postgres');
const { hashPassword, verifyPassword } = require('./utils/auth');

(async () => {
  try {
    console.log('=== Testing Login Flow ===\n');

    // Step 1: Create a test admin user
    console.log('Step 1: Creating test admin user...');

    // Delete existing admin
    await db.run('DELETE FROM users WHERE email = $1', 'admin@example.com');

    const password = 'Admin123!';
    const passwordHash = hashPassword(password);

    console.log('Password:', password);
    console.log('Hash format check:', passwordHash.includes('.') ? '✓ Correct (salt.hash)' : '✗ Incorrect');
    console.log('Hash length:', passwordHash.length);
    console.log('Hash sample:', passwordHash.substring(0, 40) + '...\n');

    // Insert admin user
    const insertResult = await db.run(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      'admin',
      'admin@example.com',
      passwordHash,
      'Admin',
      'User',
      'admin',
      true
    );
    console.log('✓ Admin user created\n');

    // Step 2: Retrieve the user
    console.log('Step 2: Retrieving user from database...');
    const user = await db.get(
      'SELECT * FROM users WHERE email = $1',
      'admin@example.com'
    );

    if (!user) {
      console.error('✗ User not found in database!');
      process.exit(1);
    }

    console.log('✓ User found:');
    console.log('  ID:', user.id);
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Active:', user.isActive);
    console.log('  Password Hash:', user.passwordHash?.substring(0, 40) + '...');
    console.log('  Hash has period:', user.passwordHash?.includes('.') ? 'YES' : 'NO');
    console.log('');

    // Step 3: Test password verification
    console.log('Step 3: Testing password verification...');
    const isValid = verifyPassword(password, user.passwordHash);
    console.log('Password verification result:', isValid ? '✓ PASSED' : '✗ FAILED');

    if (!isValid) {
      console.error('\n✗ PASSWORD VERIFICATION FAILED!');
      console.error('This means the login will fail with 401 Unauthorized');
      process.exit(1);
    }

    console.log('\n=== All Tests Passed ===');
    console.log('\nYou can now login with:');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!');
    console.log('\n⚠️ NOTE: Make sure your backend server is running!');
    console.log('To restart the backend: pm2 restart invoice-tracker-backend');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
