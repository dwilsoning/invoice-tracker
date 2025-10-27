// Test setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

// Set longer timeout for all tests
jest.setTimeout(30000);

// Global test setup
beforeAll(() => {
  console.log('🚀 Starting test suite...');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Test suite completed!');
});
