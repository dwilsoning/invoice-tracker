// Simple authentication test script
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAuth() {
  console.log('Testing authentication system...\n');

  try {
    // Test 1: Login with admin credentials
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@invoicetracker.local',
      password: 'AdminPass123!'
    });

    console.log('✓ Login successful');
    console.log('  User:', loginResponse.data.user);
    console.log('  Token:', loginResponse.data.token.substring(0, 20) + '...');

    const token = loginResponse.data.token;

    // Test 2: Verify token
    console.log('\n2. Testing token verification...');
    const verifyResponse = await axios.get(`${BASE_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ Token verification successful');
    console.log('  User:', verifyResponse.data.user);

    // Test 3: List users (admin only)
    console.log('\n3. Testing user list (admin endpoint)...');
    const usersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ User list retrieved successfully');
    console.log('  Total users:', usersResponse.data.users.length);

    // Test 4: Create a new user
    console.log('\n4. Testing user creation...');
    const newUserResponse = await axios.post(`${BASE_URL}/api/users`, {
      email: 'testuser@invoicetracker.local',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ User created successfully');
    console.log('  User:', newUserResponse.data.user);

    const newUserId = newUserResponse.data.user.id;

    // Test 5: Update user
    console.log('\n5. Testing user update...');
    const updateResponse = await axios.put(`${BASE_URL}/api/users/${newUserId}`, {
      firstName: 'Updated',
      isActive: true
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ User updated successfully');
    console.log('  Updated user:', updateResponse.data.user);

    // Test 6: Login with new user
    console.log('\n6. Testing login with new user...');
    const newUserLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'testuser@invoicetracker.local',
      password: 'TestPass123!'
    });

    console.log('✓ New user login successful');
    console.log('  User:', newUserLoginResponse.data.user);

    const newUserToken = newUserLoginResponse.data.token;

    // Test 7: Change password
    console.log('\n7. Testing password change...');
    const changePasswordResponse = await axios.post(`${BASE_URL}/api/auth/change-password`, {
      currentPassword: 'TestPass123!',
      newPassword: 'NewTestPass456!'
    }, {
      headers: {
        'Authorization': `Bearer ${newUserToken}`
      }
    });

    console.log('✓ Password changed successfully');

    // Test 8: Login with new password
    console.log('\n8. Testing login with new password...');
    const newPasswordLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'testuser@invoicetracker.local',
      password: 'NewTestPass456!'
    });

    console.log('✓ Login with new password successful');

    // Test 9: Delete user
    console.log('\n9. Testing user deletion...');
    await axios.delete(`${BASE_URL}/api/users/${newUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✓ User deleted successfully');

    console.log('\n✓ All authentication tests passed!');

  } catch (error) {
    console.error('\n✗ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Check if server is running
axios.get(`${BASE_URL}/api/health`)
  .then(() => {
    testAuth();
  })
  .catch(() => {
    console.error('Server is not running. Please start the server with: npm run start:postgres');
    process.exit(1);
  });
