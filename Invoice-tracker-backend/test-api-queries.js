// Comprehensive end-to-end API query tests
const axios = require('axios');

const API_URL = 'http://localhost:3001';

// Test queries with expected behavior
const testQueries = [
  {
    query: 'Unpaid invoices',
    expectation: 'Should return Pending status invoices only',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allPending = results.every(inv => inv.status === 'Pending' && inv.invoiceType !== 'Credit Memo');
      return { pass: allPending, reason: allPending ? 'All invoices are Pending' : 'Found non-Pending invoices' };
    }
  },
  {
    query: 'Overdue invoices',
    expectation: 'Should return Pending invoices with past due dates',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const today = new Date().toISOString().split('T')[0];
      const allOverdue = results.every(inv => inv.status === 'Pending' && inv.dueDate < today);
      return { pass: allOverdue, reason: allOverdue ? 'All invoices are overdue' : 'Found non-overdue invoices' };
    }
  },
  {
    query: 'Professional Services invoices',
    expectation: 'Should return PS type invoices only',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allPS = results.every(inv => inv.invoiceType === 'PS');
      return { pass: allPS, reason: allPS ? 'All invoices are PS type' : `Found non-PS types: ${results.filter(inv => inv.invoiceType !== 'PS').map(inv => inv.invoiceType).join(', ')}` };
    }
  },
  {
    query: 'Show me invoices on contract 527995',
    expectation: 'Should return exactly 4 invoices for contract 527995',
    validate: (results) => {
      if (results.length !== 4) return { pass: false, reason: `Expected 4 invoices, got ${results.length}` };
      const allMatch = results.every(inv => inv.customerContract === '527995');
      return { pass: allMatch, reason: allMatch ? 'All invoices match contract 527995' : 'Found mismatched contracts' };
    }
  },
  {
    query: 'Invoices from January 2025',
    expectation: 'Should return invoices from January 2025',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allJanuary = results.every(inv => {
        const date = inv.invoiceDate;
        return date.startsWith('2025-01');
      });
      return { pass: allJanuary, reason: allJanuary ? 'All invoices from January 2025' : 'Found invoices from other months' };
    }
  },
  {
    query: 'Invoices from last year',
    expectation: 'Should return invoices from 2024',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const all2024 = results.every(inv => {
        const date = inv.invoiceDate;
        return date.startsWith('2024');
      });
      return { pass: all2024, reason: all2024 ? 'All invoices from 2024' : 'Found invoices from other years' };
    }
  },
  {
    query: 'Maintenance invoices for Barwon Health',
    expectation: 'Should return Maintenance invoices for Barwon Health client',
    validate: (results) => {
      if (results.length === 0) return { pass: false, reason: 'Returned 0 invoices' };
      const allMatch = results.every(inv =>
        inv.client.toLowerCase().includes('barwon health') &&
        inv.invoiceType === 'Maintenance'
      );
      return { pass: allMatch, reason: allMatch ? 'All match client and type' : 'Found mismatched invoices' };
    }
  }
];

async function runTests() {
  console.log('=== End-to-End API Query Tests ===\n');

  let passCount = 0;
  let failCount = 0;

  for (const test of testQueries) {
    console.log(`Query: "${test.query}"`);
    console.log(`Expected: ${test.expectation}`);

    try {
      const response = await axios.post(`${API_URL}/api/query`, { query: test.query });
      const results = response.data.invoices || [];

      console.log(`Returned: ${results.length} invoices`);

      const validation = test.validate(results);

      if (validation.pass) {
        console.log(`✅ PASS - ${validation.reason}`);
        passCount++;
      } else {
        console.log(`❌ FAIL - ${validation.reason}`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      failCount++;
    }

    console.log();
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passCount}/${testQueries.length}`);
  console.log(`Failed: ${failCount}/${testQueries.length}`);

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
