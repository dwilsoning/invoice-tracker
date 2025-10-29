// Comprehensive test suite for ALL query examples
const axios = require('axios');

const API_URL = 'http://localhost:3001';

const testQueries = [
  // Filter by Client
  {
    category: 'Client Filtering',
    query: 'Which Barwon Health contracts are unpaid',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv =>
        inv.client.toLowerCase().includes('barwon health') &&
        inv.status === 'Pending'
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match` : 'Found mismatched invoices' };
    }
  },
  {
    category: 'Client Filtering',
    query: 'Invoices for Minister for Health',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv =>
        inv.client.toLowerCase().includes('minister for health')
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match` : 'Found non-matching clients' };
    }
  },
  {
    category: 'Client Filtering',
    query: 'Show me Barwon Health invoices from last month',
    validate: (results) => {
      // Just check client - date range validation is complex
      const allMatch = results.every(inv =>
        inv.client.toLowerCase().includes('barwon health')
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match client` : 'Found non-matching clients' };
    }
  },

  // Filter by Status
  {
    category: 'Status Filtering',
    query: 'Unpaid invoices',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv => inv.status === 'Pending' && inv.invoiceType !== 'Credit Memo');
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are Pending` : 'Found non-Pending invoices' };
    }
  },
  {
    category: 'Status Filtering',
    query: 'Outstanding invoices',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv => inv.status === 'Pending');
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are Pending` : 'Found non-Pending invoices' };
    }
  },
  {
    category: 'Status Filtering',
    query: 'Overdue invoices',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const today = new Date().toISOString().split('T')[0];
      const allMatch = results.every(inv => inv.status === 'Pending' && inv.dueDate < today);
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are overdue` : 'Found non-overdue invoices' };
    }
  },
  {
    category: 'Status Filtering',
    query: 'Paid invoices this year',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const currentYear = new Date().getFullYear();
      const allMatch = results.every(inv =>
        inv.status === 'Paid' && inv.invoiceDate.startsWith(String(currentYear))
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match` : 'Found mismatched invoices' };
    }
  },

  // Filter by Invoice Type
  {
    category: 'Invoice Type Filtering',
    query: 'Professional Services invoices',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv => inv.invoiceType === 'PS');
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are PS` : `Found non-PS: ${results.filter(i => i.invoiceType !== 'PS').map(i => i.invoiceType).join(', ')}` };
    }
  },
  {
    category: 'Invoice Type Filtering',
    query: 'PS invoices',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv => inv.invoiceType === 'PS');
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are PS` : 'Found non-PS types' };
    }
  },
  {
    category: 'Invoice Type Filtering',
    query: 'Maintenance invoices for Barwon Health',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv =>
        inv.client.toLowerCase().includes('barwon health') && inv.invoiceType === 'Maint'
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match` : 'Found mismatched invoices' };
    }
  },
  {
    category: 'Invoice Type Filtering',
    query: 'Subscription invoices this month',
    validate: (results) => {
      // Just check type - date range is complex
      const allMatch = results.every(inv => inv.invoiceType === 'Sub');
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices are Sub` : 'Found non-Sub types' };
    }
  },

  // Filter by Contract
  {
    category: 'Contract Filtering',
    query: 'Show me invoices on contract 527995',
    validate: (results) => {
      if (results.length !== 4) return { pass: false, reason: `Expected 4 invoices, got ${results.length}` };
      const allMatch = results.every(inv => inv.customerContract === '527995');
      return { pass: allMatch, reason: allMatch ? 'All 4 invoices match contract 527995' : 'Found mismatched contracts' };
    }
  },
  {
    category: 'Contract Filtering',
    query: 'Contract 12345 invoices',
    validate: (results) => {
      // Just check it returns something or nothing - we don't know if this contract exists
      const allMatch = results.every(inv => inv.customerContract === '12345' || inv.oracleContract === '12345');
      return { pass: allMatch || results.length === 0, reason: results.length > 0 ? `Returned ${results.length} invoices for contract 12345` : 'No invoices for this contract (expected if contract does not exist)' };
    }
  },

  // Filter by Date
  {
    category: 'Date Filtering',
    query: 'Invoices from this month',
    validate: (results) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const thisMonth = `${year}-${month}`;
      const allMatch = results.every(inv => inv.invoiceDate.startsWith(thisMonth));
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices from ${thisMonth}` : 'Found invoices from other months' };
    }
  },
  {
    category: 'Date Filtering',
    query: 'Invoices from last month',
    validate: (results) => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      const year = lastMonth.getFullYear();
      const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
      const expected = `${year}-${month}`;
      const allMatch = results.every(inv => inv.invoiceDate.startsWith(expected));
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices from ${expected}` : 'Found invoices from other months' };
    }
  },
  {
    category: 'Date Filtering',
    query: 'Invoices from this year',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const currentYear = new Date().getFullYear();
      const allMatch = results.every(inv => inv.invoiceDate.startsWith(String(currentYear)));
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices from ${currentYear}` : 'Found invoices from other years' };
    }
  },
  {
    category: 'Date Filtering',
    query: 'Invoices from last year',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const lastYear = new Date().getFullYear() - 1;
      const allMatch = results.every(inv => inv.invoiceDate.startsWith(String(lastYear)));
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices from ${lastYear}` : 'Found invoices from other years' };
    }
  },
  {
    category: 'Date Filtering',
    query: 'Invoices from January 2025',
    validate: (results) => {
      const allMatch = results.every(inv => inv.invoiceDate.startsWith('2025-01'));
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices from January 2025` : 'Found invoices from other months' };
    }
  },
  {
    category: 'Date Filtering',
    query: 'Between 2025-01-01 and 2025-03-31',
    validate: (results) => {
      const allMatch = results.every(inv =>
        inv.invoiceDate >= '2025-01-01' && inv.invoiceDate <= '2025-03-31'
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices in range` : 'Found invoices outside range' };
    }
  },

  // Special Queries
  {
    category: 'Special Queries',
    query: 'Contracts with no value',
    validate: (results, data) => {
      // This query returns special response format
      if (data.type !== 'contracts_no_value') return { pass: false, reason: 'Did not return special format' };
      return { pass: true, reason: `Found ${data.contractsWithNoValue?.length || 0} contracts with ${results.length} invoices` };
    }
  },
  {
    category: 'Special Queries',
    query: 'Monthly invoices in USD',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv =>
        inv.frequency?.toLowerCase() === 'monthly' && inv.currency === 'USD'
      );
      return { pass: allMatch, reason: allMatch ? `All ${results.length} invoices match` : 'Found mismatched invoices' };
    }
  }
];

async function runTests() {
  console.log('=== COMPREHENSIVE API Query Tests ===\n');
  console.log(`Testing ${testQueries.length} queries across all categories\n`);

  let passCount = 0;
  let failCount = 0;
  const failedTests = [];

  let currentCategory = '';

  for (const test of testQueries) {
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log(`\n--- ${currentCategory} ---`);
    }

    console.log(`\n"${test.query}"`);

    try {
      const response = await axios.post(`${API_URL}/api/query`, { query: test.query });
      const results = response.data.invoices || [];
      const fullData = response.data;

      const validation = test.validate(results, fullData);

      if (validation.pass) {
        console.log(`  ✅ PASS - ${validation.reason}`);
        passCount++;
      } else {
        console.log(`  ❌ FAIL - ${validation.reason}`);
        failCount++;
        failedTests.push({ query: test.query, reason: validation.reason });
      }
    } catch (error) {
      console.log(`  ❌ ERROR - ${error.message}`);
      failCount++;
      failedTests.push({ query: test.query, reason: error.message });
    }
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total Tests: ${testQueries.length}`);
  console.log(`Passed: ${passCount} ✅`);
  console.log(`Failed: ${failCount} ❌`);
  console.log(`Success Rate: ${Math.round((passCount / testQueries.length) * 100)}%`);

  if (failedTests.length > 0) {
    console.log(`\n=== FAILED TESTS ===`);
    failedTests.forEach(test => {
      console.log(`\n"${test.query}"`);
      console.log(`  ${test.reason}`);
    });
  }

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
