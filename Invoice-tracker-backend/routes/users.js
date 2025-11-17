const express = require('express');
const crypto = require('crypto');
const { db } = require('../db-postgres');
const {
  hashPassword,
  isValidEmail,
  validatePasswordStrength
} = require('../utils/auth');

const router = express.Router();

// All routes in this file require admin access
// Apply requireAdmin middleware when importing in main server

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', async (req, res) => {
  try {
    const users = await db.all(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id
 * Get specific user by ID (admin only)
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await db.get(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users
       WHERE id = $1`,
      req.params.id
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Validate role
    const validRoles = ['admin', 'user'];
    const userRole = role || 'user';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
    }

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE email = $1',
      email.toLowerCase()
    );

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = hashPassword(password);

    // Generate unique user ID
    const userId = `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create user with explicit ID
    const result = await db.get(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      userId,
      email.toLowerCase(),
      passwordHash,
      firstName || null,
      lastName || null,
      userRole
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
router.put('/:id', async (req, res) => {
  try {
    const { email, firstName, lastName, role, isActive, password } = req.body;

    // Check if user exists
    const user = await db.get('SELECT id FROM users WHERE id = $1', req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already taken by another user
      const existingUser = await db.get(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        email.toLowerCase(),
        req.params.id
      );

      if (existingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(email.toLowerCase());
    }

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName || null);
    }

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName || null);
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'user'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or user' });
      }
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (password !== undefined) {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      const passwordHash = hashPassword(password);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add user ID to values
    values.push(req.params.id);

    // Execute update
    await db.run(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
      ...values
    );

    // Fetch updated user
    const updatedUser = await db.get(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users
       WHERE id = $1`,
      req.params.id
    );

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.user && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = await db.get('SELECT id FROM users WHERE id = $1', req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (cascade will delete password reset tokens)
    await db.run('DELETE FROM users WHERE id = $1', req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/users/profile/me
 * Get current user's profile
 */
router.get('/profile/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.get(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users
       WHERE id = $1`,
      req.user.id
    );

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/users/profile/me
 * Update current user's profile
 */
router.put('/profile/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { firstName, lastName, email } = req.body;

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already taken
      const existingUser = await db.get(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        email.toLowerCase(),
        req.user.id
      );

      if (existingUser) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(email.toLowerCase());
    }

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName || null);
    }

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);

    await db.run(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
      ...values
    );

    // Fetch updated user
    const updatedUser = await db.get(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users
       WHERE id = $1`,
      req.user.id
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
