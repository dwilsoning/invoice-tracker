/**
 * Test Script for MatchaAI Chatbot Integration
 *
 * This script tests the chatbot services without starting the full server
 */

require('dotenv').config();
const { testConnection, sendSimpleQuery } = require('../services/matchaAI');
const { generateAnalyticsContext } = require('../services/chatbotContext');

async function runTests() {
  console.log('🧪 Testing MatchaAI Chatbot Integration\n');

  // Test 1: Environment variables
  console.log('1️⃣ Checking environment variables...');
  const hasApiKey = !!process.env.MATCHA_API_KEY;
  const hasApiUrl = !!process.env.MATCHA_API_URL;
  const hasMissionId = !!process.env.MATCHA_MISSION_ID;

  console.log(`   ✓ MATCHA_API_KEY: ${hasApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ✓ MATCHA_API_URL: ${hasApiUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ✓ MATCHA_MISSION_ID: ${hasMissionId ? '✅ Set' : '❌ Missing'}`);

  if (!hasApiKey || !hasApiUrl || !hasMissionId) {
    console.log('\n❌ Missing required environment variables. Please check .env file.');
    process.exit(1);
  }

  console.log();

  // Test 2: Generate analytics context
  console.log('2️⃣ Testing analytics context generation...');
  try {
    const context = await generateAnalyticsContext();
    console.log(`   ✅ Context generated successfully`);
    console.log(`   📊 Total Invoices: ${context.summary.totalInvoices}`);
    console.log(`   💵 Total Pending: $${context.summary.totalPendingAmountUSD.toLocaleString()}`);
    console.log(`   📅 DSI: ${context.summary.daysInvoicesOutstanding} days`);
  } catch (error) {
    console.log(`   ❌ Failed to generate context: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  console.log();

  // Test 3: Test MatchaAI connection
  console.log('3️⃣ Testing MatchaAI connection...');
  try {
    const connectionTest = await testConnection();
    if (connectionTest.success) {
      console.log(`   ✅ Connection successful`);
      console.log(`   💬 Response: ${connectionTest.details.message.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ Connection failed: ${connectionTest.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`   ❌ Connection test error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  console.log();

  // Test 4: Send a test query
  console.log('4️⃣ Sending test query...');
  try {
    const response = await sendSimpleQuery('What is the current DSI?');
    if (response.success) {
      console.log(`   ✅ Query successful`);
      console.log(`   💬 Response: ${response.message}`);
    } else {
      console.log(`   ❌ Query failed: ${response.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Query error: ${error.message}`);
    console.error(error);
  }

  console.log();
  console.log('🎉 All tests completed!');
  console.log();
  console.log('Next steps:');
  console.log('1. Start the backend server: npm start');
  console.log('2. Start the frontend: cd ../invoice-tracker-frontend && npm run dev');
  console.log('3. Click the chatbot button (💬) in the bottom-right corner');
  console.log();
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
