#!/usr/bin/env node

/**
 * Create Admin User Script
 *
 * This script creates an admin user for the Invoice Tracker application.
 * It can be run interactively or with command-line arguments.
 *
 * Usage:
 *   Interactive: node scripts/create-admin.js
 *   With args:   node scripts/create-admin.js admin@example.com SecurePassword123! Admin User
 */

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

async function createAdmin(email, password, firstName, lastName) {
  try {
    // Validate email
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id, email, role FROM users WHERE email = $1',
      email.toLowerCase()
    );

    if (existingUser) {
      if (existingUser.role === 'admin') {
        throw new Error(`User with email ${email} already exists as an admin`);
      } else {
        // Upgrade existing user to admin
        await db.run(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
          'admin',
          email.toLowerCase()
        );
        console.log(`\n✓ Existing user ${email} has been upgraded to admin role`);
        return;
      }
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Generate user ID
    const userId = generateUserId();

    // Create admin user
    await db.run(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      userId,
      email.toLowerCase(),
      passwordHash,
      firstName || null,
      lastName || null,
      'admin'
    );

    console.log('\n✓ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('\nPlease change this password after first login for security.');

  } catch (error) {
    console.error('\n✗ Error creating admin user:', error.message);
    throw error;
  }
}

async function interactiveMode() {
  console.log('=== Create Admin User ===\n');

  const email = await question('Email address: ');
  const password = await question('Password: ');
  const firstName = await question('First name (optional): ');
  const lastName = await question('Last name (optional): ');

  await createAdmin(email, password, firstName, lastName);
}

async function main() {
  try {
    // Check if arguments were provided
    const args = process.argv.slice(2);

    if (args.length >= 2) {
      // Command-line mode
      const [email, password, firstName, lastName] = args;
      await createAdmin(email, password, firstName, lastName);
    } else if (args.length === 0) {
      // Interactive mode
      await interactiveMode();
    } else {
      console.error('Usage: node scripts/create-admin.js [email] [password] [firstName] [lastName]');
      process.exit(1);
    }

  } catch (error) {
    console.error('Failed to create admin user');
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createAdmin };
