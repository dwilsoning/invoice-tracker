const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function testQuery(query) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: "${query}"`);
  console.log('='.repeat(80));

  try {
    const response = await axios.post(`${API_URL}/api/query`, { query });
    const data = response.data;

    // Handle different response formats
    const invoices = data.invoices || data;
    const count = data.count !== undefined ? data.count : (Array.isArray(invoices) ? invoices.length : 0);

    console.log(`✅ Success: Found ${count} results`);
    console.log(`Response type: ${data.type || 'unknown'}`);

    if (count > 0 && Array.isArray(invoices)) {
      console.log('Sample results:');
      invoices.slice(0, 3).forEach((inv, i) => {
        console.log(`  ${i + 1}. Invoice: ${inv.invoiceNumber}, Client: ${inv.client}, Contract: ${inv.customerContract || 'N/A'}, Date: ${inv.invoiceDate}, Type: ${inv.invoiceType}`);
      });
    } else {
      console.log('❌ NO RESULTS RETURNED');
    }

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function runTests() {
  console.log('Testing Ask about invoices functionality...\n');

  // Test contract number queries
  await testQuery('invoices for contract 516557');
  await testQuery('show me invoices for contract 516557');
  await testQuery('contract 516557');
  await testQuery('invoices on contract 516557');

  // Test date filtering
  await testQuery('Type invoices this month');
  await testQuery('invoices this month');
  await testQuery('PS invoices this month');

  // Test invoice type
  await testQuery('Type invoices');
  await testQuery('PS invoices');
  await testQuery('Maint invoices');

  console.log('\n' + '='.repeat(80));
  console.log('Testing complete');
  console.log('='.repeat(80));
}

runTests();
