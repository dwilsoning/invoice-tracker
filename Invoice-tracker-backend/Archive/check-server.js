const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/invoices',
  method: 'GET',
  timeout: 5000
};

console.log('Checking if server is running on http://localhost:3001...\n');

const req = http.request(options, (res) => {
  console.log('✅ Server is responding!');
  console.log(`Status: ${res.statusCode}`);
  res.on('data', () => {}); // drain response
  res.on('end', () => {
    console.log('\nServer is ready for testing.');
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.log('❌ Cannot connect to server');
  console.log(`Error: ${err.message}`);
  console.log('\nPlease verify:');
  console.log('1. The backend server is running (node server-postgres.js)');
  console.log('2. It started successfully without errors');
  console.log('3. It shows "Server running on port 3001"');
  process.exit(1);
});

req.on('timeout', () => {
  console.log('❌ Connection timed out');
  req.destroy();
  process.exit(1);
});

req.end();
