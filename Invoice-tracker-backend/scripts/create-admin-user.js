const readline = require('readline');
const { db } = require('../db-postgres');
const { hashPassword, generateUserId, isValidEmail, validatePasswordStrength } = require('../utils/auth');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log('\n=== Create Admin User for Invoice Tracker ===\n');

  try {
    // Get user details
    const email = await question('Email address: ');

    if (!isValidEmail(email)) {
      console.error('❌ Invalid email format');
      rl.close();
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = $1', email.toLowerCase());
    if (existingUser) {
      console.error('❌ User with this email already exists');
      rl.close();
      process.exit(1);
    }

    const firstName = await question('First name (optional): ');
    const lastName = await question('Last name (optional): ');

    let password;
    let passwordValid = false;

    while (!passwordValid) {
      password = await question('Password: ');
      const validation = validatePasswordStrength(password);

      if (validation.valid) {
        passwordValid = true;
      } else {
        console.error(`❌ ${validation.message}`);
        console.log('Password requirements:');
        console.log('  - At least 8 characters');
        console.log('  - At least one uppercase letter');
        console.log('  - At least one lowercase letter');
        console.log('  - At least one number');
      }
    }

    const confirmPassword = await question('Confirm password: ');

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      rl.close();
      process.exit(1);
    }

    // Create user
    const userId = generateUserId();
    const passwordHash = hashPassword(password);

    await db.run(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)`,
      userId,
      email.toLowerCase(),
      passwordHash,
      firstName || null,
      lastName || null
    );

    console.log('\n✅ Admin user created successfully!');
    console.log('\nUser details:');
    console.log(`  ID: ${userId}`);
    console.log(`  Email: ${email}`);
    console.log(`  Name: ${firstName} ${lastName}`.trim() || '  (No name provided)');
    console.log('  Role: admin');
    console.log('\nYou can now log in with these credentials.');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await db.close();
  }
}

// Check if users table exists
async function checkSetup() {
  try {
    await db.get('SELECT 1 FROM users LIMIT 1');
    return true;
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.error('\n❌ Users table does not exist!');
      console.error('Please run the authentication migration first:');
      console.error('  psql -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql\n');
      return false;
    }
    throw error;
  }
}

async function main() {
  const setupComplete = await checkSetup();
  if (!setupComplete) {
    process.exit(1);
  }
  await createAdminUser();
}

main();
