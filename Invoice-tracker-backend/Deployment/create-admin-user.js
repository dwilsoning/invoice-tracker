#!/usr/bin/env node

/**
 * Create Admin User Script for EC2 Deployment
 *
 * This script creates an admin user for the Invoice Tracker application.
 * Designed to work with the deployed PostgreSQL schema on EC2.
 *
 * Usage:
 *   Interactive: node create-admin-user.js
 *   With args:   node create-admin-user.js admin@example.com SecurePassword123 Admin User
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Hash password using SHA-256
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Generate unique user ID
 */
function generateUserId() {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(6).toString('hex');
  return `user_${timestamp}_${randomStr}`;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

/**
 * Create admin user in database
 */
async function createAdmin(email, password, firstName, lastName) {
  const client = await pool.connect();

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
    const existingUser = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.role === 'admin') {
        throw new Error(`User with email ${email} already exists as an admin`);
      } else {
        // Upgrade existing user to admin
        await client.query(
          'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
          ['admin', email.toLowerCase()]
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
    await client.query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,
        email.toLowerCase(),
        passwordHash,
        firstName || null,
        lastName || null,
        'admin'
      ]
    );

    console.log('\n✓ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role: admin`);
    console.log('\nPlease change this password after first login for security.');

  } catch (error) {
    console.error('\n✗ Error creating admin user:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Interactive mode - prompt user for input
 */
async function interactiveMode() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Invoice Tracker - Create Admin User                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Password requirements:');
  console.log('  - At least 8 characters');
  console.log('  - At least one uppercase letter');
  console.log('  - At least one lowercase letter');
  console.log('  - At least one number\n');

  const email = await question('Email address: ');
  const password = await question('Password: ');
  const firstName = await question('First name (optional): ');
  const lastName = await question('Last name (optional): ');

  await createAdmin(
    email,
    password,
    firstName || null,
    lastName || null
  );
}

/**
 * Main function
 */
async function main() {
  try {
    // Test database connection
    const testClient = await pool.connect();
    console.log('✓ Connected to database');
    testClient.release();

    // Check if arguments were provided
    const args = process.argv.slice(2);

    if (args.length >= 2) {
      // Command-line mode
      const [email, password, firstName, lastName] = args;
      console.log('\nCreating admin user...');
      await createAdmin(email, password, firstName || null, lastName || null);
    } else if (args.length === 0) {
      // Interactive mode
      await interactiveMode();
    } else {
      console.error('\nUsage:');
      console.error('  Interactive: node create-admin-user.js');
      console.error('  With args:   node create-admin-user.js <email> <password> [firstName] [lastName]');
      console.error('\nExample:');
      console.error('  node create-admin-user.js admin@example.com MySecurePass123 John Doe');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Failed to create admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createAdmin, hashPassword, generateUserId };
