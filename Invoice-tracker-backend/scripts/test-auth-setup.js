const { db } = require('../db-postgres');
const { testEmailConfig } = require('../utils/email');
const { hashPassword, verifyPassword } = require('../utils/auth');
const { createToken, verifyToken } = require('../utils/jwt');

async function testAuthSetup() {
  console.log('\n=== Invoice Tracker Authentication Setup Test ===\n');

  let allPassed = true;

  // Test 1: Database connection
  console.log('1. Testing database connection...');
  try {
    await db.get('SELECT 1');
    console.log('   ✅ Database connection successful');
  } catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
    allPassed = false;
  }

  // Test 2: Users table exists
  console.log('\n2. Checking users table...');
  try {
    await db.get('SELECT COUNT(*) as count FROM users');
    console.log('   ✅ Users table exists');
  } catch (error) {
    console.log('   ❌ Users table not found:', error.message);
    console.log('   Run: psql -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql');
    allPassed = false;
  }

  // Test 3: Password reset tokens table exists
  console.log('\n3. Checking password_reset_tokens table...');
  try {
    await db.get('SELECT COUNT(*) as count FROM password_reset_tokens');
    console.log('   ✅ Password reset tokens table exists');
  } catch (error) {
    console.log('   ❌ Password reset tokens table not found:', error.message);
    allPassed = false;
  }

  // Test 4: Password hashing
  console.log('\n4. Testing password hashing...');
  try {
    const testPassword = 'TestPassword123!';
    const hash = hashPassword(testPassword);
    const isValid = verifyPassword(testPassword, hash);
    const isInvalid = verifyPassword('WrongPassword', hash);

    if (isValid && !isInvalid) {
      console.log('   ✅ Password hashing works correctly');
    } else {
      console.log('   ❌ Password hashing verification failed');
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Password hashing error:', error.message);
    allPassed = false;
  }

  // Test 5: JWT token creation and verification
  console.log('\n5. Testing JWT tokens...');
  try {
    const secret = process.env.JWT_SECRET || 'test-secret';
    const payload = { userId: 'test123', email: 'test@example.com' };
    const token = createToken(payload, secret, 3600);
    const decoded = verifyToken(token, secret);

    if (decoded && decoded.userId === payload.userId) {
      console.log('   ✅ JWT token creation and verification works');
    } else {
      console.log('   ❌ JWT token verification failed');
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ JWT token error:', error.message);
    allPassed = false;
  }

  // Test 6: JWT secret configuration
  console.log('\n6. Checking JWT secret configuration...');
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
    console.log('   ⚠️  WARNING: JWT_SECRET not set or using default value');
    console.log('   Set a secure JWT_SECRET in your .env file for production');
  } else if (jwtSecret.length < 32) {
    console.log('   ⚠️  WARNING: JWT_SECRET is too short (should be at least 32 characters)');
  } else {
    console.log('   ✅ JWT_SECRET is configured');
  }

  // Test 7: Email configuration
  console.log('\n7. Testing email configuration...');
  try {
    const emailConfigured = await testEmailConfig();
    if (emailConfigured) {
      console.log('   ✅ Email service is configured and working');
    } else {
      console.log('   ⚠️  Email service not configured or not working');
      console.log('   Configure email settings in .env to enable password reset emails');
      console.log('   (This is optional for development)');
    }
  } catch (error) {
    console.log('   ⚠️  Email configuration test skipped:', error.message);
    console.log('   (Email is optional for development)');
  }

  // Test 8: Check for admin users
  console.log('\n8. Checking for admin users...');
  try {
    const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = $1', 'admin');
    if (adminCount && adminCount.count > 0) {
      console.log(`   ✅ Found ${adminCount.count} admin user(s)`);
    } else {
      console.log('   ⚠️  No admin users found');
      console.log('   Create an admin user: node scripts/create-admin-user.js');
    }
  } catch (error) {
    console.log('   ❌ Error checking admin users:', error.message);
  }

  // Test 9: Environment variables
  console.log('\n9. Checking environment variables...');
  const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USER'];
  const optionalVars = ['JWT_SECRET', 'FRONTEND_URL', 'EMAIL_SERVICE'];

  let envVarsOk = true;
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.log(`   ❌ Missing required env var: ${varName}`);
      envVarsOk = false;
      allPassed = false;
    }
  }

  if (envVarsOk) {
    console.log('   ✅ Required environment variables are set');
  }

  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      console.log(`   ℹ️  Optional env var not set: ${varName}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All critical tests passed!');
    console.log('\nNext steps:');
    console.log('1. Create an admin user if you haven\'t already:');
    console.log('   node scripts/create-admin-user.js');
    console.log('2. Configure email settings in .env (optional)');
    console.log('3. Start the server: npm run start:postgres');
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.');
  }
  console.log('='.repeat(50) + '\n');

  await db.close();
}

testAuthSetup().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
