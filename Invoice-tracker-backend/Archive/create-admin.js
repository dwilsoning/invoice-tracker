const { hashPassword } = require('./utils/auth');
const { pool } = require('./db-postgres');

(async () => {
  try {
    console.log('Creating admin user...');

    // Delete existing admin user if it exists
    await pool.query('DELETE FROM users WHERE username = $1', ['admin']);
    console.log('Deleted any existing admin user');

    const password = 'Admin123!';
    const passwordHash = hashPassword(password); // Uses PBKDF2 with salt.hash format

    console.log('Generated password hash:', passwordHash.substring(0, 20) + '...');
    console.log('Hash format check:', passwordHash.includes('.') ? 'CORRECT (salt.hash format)' : 'INCORRECT FORMAT');

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, is_active',
      ['admin', 'admin@example.com', passwordHash, 'admin', true]
    );

    console.log('\n✓ Admin user created successfully!');
    console.log('================================');
    console.log('User ID:', result.rows[0].id);
    console.log('Username:', result.rows[0].username);
    console.log('Email:', result.rows[0].email);
    console.log('Role:', result.rows[0].role);
    console.log('Active:', result.rows[0].is_active);
    console.log('================================');
    console.log('\nLogin Credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!');
    console.log('\n⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin user:', err);
    await pool.end();
    process.exit(1);
  }
})();
