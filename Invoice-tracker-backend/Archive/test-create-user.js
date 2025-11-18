const { db } = require('./db-postgres');
const { hashPassword, generateUserId, validatePasswordStrength, isValidEmail } = require('./utils/auth');

(async () => {
  try {
    console.log('Testing user creation process...\n');

    const testUser = {
      email: 'test@example.com',
      password: 'Test123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    };

    // Test 1: Validate email
    console.log('Test 1: Validating email...');
    if (!isValidEmail(testUser.email)) {
      console.error('✗ Invalid email format');
      process.exit(1);
    }
    console.log('✓ Email valid\n');

    // Test 2: Validate password
    console.log('Test 2: Validating password...');
    const passwordValidation = validatePasswordStrength(testUser.password);
    if (!passwordValidation.valid) {
      console.error('✗ Password validation failed:', passwordValidation.message);
      process.exit(1);
    }
    console.log('✓ Password valid\n');

    // Test 3: Check for existing user
    console.log('Test 3: Checking for existing user...');
    const existingUser = await db.get(
      'SELECT id FROM users WHERE email = $1',
      testUser.email.toLowerCase()
    );
    if (existingUser) {
      console.log('⚠ User already exists, deleting...');
      await db.run('DELETE FROM users WHERE email = $1', testUser.email.toLowerCase());
      console.log('✓ Deleted existing test user\n');
    } else {
      console.log('✓ No existing user\n');
    }

    // Test 4: Generate user ID
    console.log('Test 4: Generating user ID...');
    const userId = generateUserId();
    console.log('✓ Generated ID:', userId, '\n');

    // Test 5: Hash password
    console.log('Test 5: Hashing password...');
    const passwordHash = hashPassword(testUser.password);
    console.log('✓ Password hashed');
    console.log('  Hash format:', passwordHash.includes('.') ? 'Correct (salt.hash)' : 'INCORRECT');
    console.log('');

    // Test 6: Check users table structure
    console.log('Test 6: Checking users table structure...');
    const columns = await db.all(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('Users table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.columnName}: ${col.dataType} (nullable: ${col.isNullable})`);
    });
    console.log('');

    // Test 7: Attempt to create user
    console.log('Test 7: Creating user...');
    try {
      // Check if username column exists
      const hasUsername = columns.some(col => col.columnName === 'username');

      if (hasUsername) {
        console.log('  Note: Username column exists, generating username from email...');
        const username = testUser.email.split('@')[0];

        await db.run(
          `INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
          userId,
          username,
          testUser.email.toLowerCase(),
          passwordHash,
          testUser.firstName,
          testUser.lastName,
          testUser.role
        );
      } else {
        console.log('  Note: Username column does not exist, creating without it...');

        await db.run(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
          userId,
          testUser.email.toLowerCase(),
          passwordHash,
          testUser.firstName,
          testUser.lastName,
          testUser.role
        );
      }

      console.log('✓ User created successfully!\n');

      // Verify user was created
      const createdUser = await db.get(
        'SELECT * FROM users WHERE email = $1',
        testUser.email.toLowerCase()
      );

      console.log('Verification - User details:');
      console.log('  ID:', createdUser.id);
      console.log('  Username:', createdUser.username || 'N/A');
      console.log('  Email:', createdUser.email);
      console.log('  First Name:', createdUser.firstName || 'N/A');
      console.log('  Last Name:', createdUser.lastName || 'N/A');
      console.log('  Role:', createdUser.role);
      console.log('  Active:', createdUser.isActive);

      console.log('\n✓ All tests passed!');
      console.log('\nThe user creation system is working correctly.');

    } catch (insertError) {
      console.error('✗ Failed to create user:', insertError.message);
      console.error('\nFull error:');
      console.error(insertError);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
