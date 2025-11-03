const { Pool, types } = require('pg');
require('dotenv').config();

// Override the default DATE type parser to return strings instead of Date objects
// This prevents timezone conversion issues (type ID 1082 is DATE)
types.setTypeParser(1082, val => val);

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_tracker',
  user: process.env.DB_USER || 'invoice_tracker_user',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client can remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to wait for a connection (10 seconds)
  // Add keepalive to prevent idle connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // 10 seconds
});

// Test database connection
pool.on('connect', (client) => {
  console.log('✓ Connected to PostgreSQL database');
  // Set statement timeout to prevent long-running queries
  client.query('SET statement_timeout = 30000'); // 30 seconds
});

// Handle pool errors without crashing the application
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  // Log the error but don't exit - the pool will handle reconnection
  console.log('Pool will attempt to reconnect automatically');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await pool.end();
  process.exit(0);
});

// Convert snake_case to camelCase
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert row object from snake_case to camelCase and fix types
function convertRowToCamelCase(row) {
  if (!row) return row;
  const converted = {};

  // Fields that should be numbers
  const numericFields = ['amountDue', 'expectedAmount', 'contractValue'];

  // Fields that should be dates (YYYY-MM-DD format)
  const dateFields = ['invoiceDate', 'dueDate', 'paymentDate', 'uploadDate',
                      'expectedDate', 'lastInvoiceDate', 'acknowledgedDate',
                      'createdDate', 'updatedDate'];

  for (const key in row) {
    const camelKey = snakeToCamel(key);
    let value = row[key];

    // Convert numeric strings to numbers
    if (numericFields.includes(camelKey) && value !== null && value !== undefined) {
      value = parseFloat(value);
    }

    // Convert date timestamps to YYYY-MM-DD format
    if (dateFields.includes(camelKey) && value !== null && value !== undefined) {
      // With the type parser override above, DATE columns now return strings
      // So we just need to handle the rare case of Date objects (from TIMESTAMP columns)
      if (value instanceof Date) {
        if (!isNaN(value.getTime())) {
          value = value.toISOString().split('T')[0];
        }
      } else if (typeof value === 'string') {
        // Already a string - ensure it's in YYYY-MM-DD format
        value = value.split('T')[0].split(' ')[0];
      }
    }

    converted[camelKey] = value;
  }
  return converted;
}

// Convert array of rows from snake_case to camelCase
function convertRowsToCamelCase(rows) {
  if (!rows) return rows;
  return rows.map(convertRowToCamelCase);
}

// Database wrapper for compatibility with existing code
const db = {
  // Execute a query and return all results
  async all(sql, ...params) {
    const client = await pool.connect();
    try {
      // If first param is an array, use it as params array (for backward compatibility)
      const paramsArray = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
      const result = await client.query(sql, paramsArray);
      return convertRowsToCamelCase(result.rows);
    } catch (error) {
      // Handle connection errors gracefully
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error('Database connection error, will retry on next request:', error.message);
        throw new Error('Database connection lost. Please try again.');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  // Execute a query and return first result
  async get(sql, ...params) {
    const client = await pool.connect();
    try {
      // If first param is an array, use it as params array (for backward compatibility)
      const paramsArray = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
      const result = await client.query(sql, paramsArray);
      return convertRowToCamelCase(result.rows[0] || null);
    } catch (error) {
      // Handle connection errors gracefully
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error('Database connection error, will retry on next request:', error.message);
        throw new Error('Database connection lost. Please try again.');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  // Execute a query (INSERT, UPDATE, DELETE)
  async run(sql, ...params) {
    const client = await pool.connect();
    try {
      // If first param is an array, use it as params array (for backward compatibility)
      const paramsArray = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
      const result = await client.query(sql, paramsArray);
      return {
        changes: result.rowCount,
        rowCount: result.rowCount,
        rows: convertRowsToCamelCase(result.rows)
      };
    } catch (error) {
      // Handle connection errors gracefully
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error('Database connection error, will retry on next request:', error.message);
        throw new Error('Database connection lost. Please try again.');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  // Execute raw SQL (for CREATE TABLE, etc.)
  async exec(sql) {
    const client = await pool.connect();
    try {
      await client.query(sql);
    } catch (error) {
      // Handle connection errors gracefully
      if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error('Database connection error, will retry on next request:', error.message);
        throw new Error('Database connection lost. Please try again.');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  // Prepare statement (returns object with query methods)
  prepare(sql) {
    return {
      all: (...params) => db.all(sql, params),
      get: (...params) => db.get(sql, params),
      run: (...params) => db.run(sql, params)
    };
  },

  // Get pool for advanced operations
  getPool() {
    return pool;
  },

  // Close all connections
  async close() {
    await pool.end();
  }
};

module.exports = { db, pool };
