const crypto = require('crypto');

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {string} Hash in format: salt.hash
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}.${hash}`;
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} storedHash - Stored hash in format: salt.hash
 * @returns {boolean} True if password matches
 */
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split('.');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Generate a random token for password reset
 * @returns {string} Random token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a unique user ID
 * @returns {string} Unique ID
 */
function generateUserId() {
  return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a unique token ID
 * @returns {string} Unique ID
 */
function generateTokenId() {
  return `token_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, message: string }
 */
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
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

  return { valid: true, message: 'Password is strong' };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateResetToken,
  generateUserId,
  generateTokenId,
  isValidEmail,
  validatePasswordStrength
};
