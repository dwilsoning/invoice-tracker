// Test login and verify endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testLoginAndVerify() {
  console.log('Testing login and verify flow...\n');

  try {
    // Step 1: Login
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@invoicetracker.local',
      password: 'AdminPass123!'
    });

    console.log('✓ Login successful');
    console.log('  User:', loginResponse.data.user);
    console.log('  Token:', loginResponse.data.token.substring(0, 30) + '...');

    const token = loginResponse.data.token;

    // Step 2: Verify token
    console.log('\n2. Testing token verification...');
    const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ Token verification successful');
    console.log('  User:', verifyResponse.data.user);

    // Step 3: Test verify without token (should fail)
    console.log('\n3. Testing verify without token (should fail)...');
    try {
      await axios.get(`${BASE_URL}/auth/verify`);
      console.log('✗ Should have failed but succeeded');
    } catch (error) {
      console.log('✓ Correctly rejected request without token');
      console.log('  Error:', error.response?.data?.error);
    }

    // Step 4: Test verify with invalid token (should fail)
    console.log('\n4. Testing verify with invalid token (should fail)...');
    try {
      await axios.get(`${BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': 'Bearer invalid-token-here'
        }
      });
      console.log('✗ Should have failed but succeeded');
    } catch (error) {
      console.log('✓ Correctly rejected invalid token');
      console.log('  Error:', error.response?.data?.error);
    }

    console.log('\n✓ All authentication tests passed!');

  } catch (error) {
    console.error('\n✗ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Check if server is running
axios.get(`${BASE_URL}/../health`)
  .then(() => {
    testLoginAndVerify();
  })
  .catch(() => {
    console.error('Server is not running. Please start the server with: npm run start:postgres');
    process.exit(1);
  });
