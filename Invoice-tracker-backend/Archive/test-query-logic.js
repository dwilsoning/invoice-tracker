// Test query logic standalone
const { db } = require('./db-postgres');

async function simulateQuery(query) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Simulating query: "${query}"`);
  console.log('='.repeat(80));

  // Simulate the exact logic from server-postgres.js /api/query endpoint
  const invoices = await db.all('SELECT * FROM invoices');
  const queryLower = query.toLowerCase();
  let results = [...invoices];

  console.log(`Starting with ${results.length} total invoices`);

  // Invoice type filtering
  const typeMap = {
    'ps': 'PS',
    'professional services': 'PS',
    'maint': 'Maint',
    'maintenance': 'Maint',
    'sub': 'Sub',
    'subscription': 'Sub',
    'hosting': 'Hosting',
    'ms': 'MS',
    'managed services': 'MS',
    'sw': 'SW',
    'software': 'SW',
    'hw': 'HW',
    'hardware': 'HW',
    '3pp': '3PP',
    'third party': '3PP',
    'credit memo': 'Credit Memo'
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (queryLower.includes(key)) {
      results = results.filter(inv => inv.invoiceType && inv.invoiceType === value);
      console.log(`After type filter ('${value}'): ${results.length} invoices`);
      break;
    }
  }

  // Contract filtering
  let contractMatch = queryLower.match(/(?:on\s+contract|for\s+contract|contract)\s+([a-z0-9\s\-_'.&,]+?)(?:\s+(?:what|total|sum|how|in|during|are|is|invoices?|\?)|$)/i);
  if (contractMatch) {
    const contract_name = contractMatch[1].trim();
    console.log(`Contract pattern matched: "${contract_name}"`);

    const beforeFilter = results.length;
    results = results.filter(inv =>
      (inv.customerContract && inv.customerContract.toLowerCase() === contract_name) ||
      (inv.oracleContract && inv.oracleContract.toLowerCase() === contract_name)
    );
    console.log(`After contract filter: ${results.length} invoices (was ${beforeFilter})`);

    // Debug: show a few contracts to see what we're comparing
    if (results.length === 0 && beforeFilter > 0) {
      console.log('No matches found. Sample contracts from unfiltered list:');
      invoices.slice(0, 5).forEach(inv => {
        console.log(`  - Customer: "${inv.customerContract}" (lower: "${inv.customerContract?.toLowerCase()}"), Oracle: "${inv.oracleContract}"`);
      });
      console.log(`Looking for: "${contract_name}"`);
    }
  }

  // Date filtering - this month
  if (queryLower.includes('this month') || queryLower.includes('current month')) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthNum = String(currentMonth + 1).padStart(2, '0');
    const monthStart = `${currentYear}-${monthNum}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthEnd = `${currentYear}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

    console.log(`Date range filter: ${monthStart} to ${monthEnd}`);

    const beforeFilter = results.length;
    if (queryLower.includes('due')) {
      results = results.filter(inv => inv.dueDate >= monthStart && inv.dueDate <= monthEnd);
    } else {
      results = results.filter(inv => inv.invoiceDate >= monthStart && inv.invoiceDate <= monthEnd);
    }
    console.log(`After date filter: ${results.length} invoices (was ${beforeFilter})`);
  }

  console.log(`\nFinal result: ${results.length} invoices`);
  if (results.length > 0) {
    console.log('Sample results:');
    results.slice(0, 5).forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceNumber} - ${inv.client} - Contract: ${inv.customerContract} - Type: ${inv.invoiceType} - Date: ${inv.invoiceDate}`);
    });
  }

  return results;
}

async function test() {
  try {
    await simulateQuery('invoices for contract 516557');
    await simulateQuery('contract 516557');
    await simulateQuery('show me invoices for contract 516557');
    await simulateQuery('PS invoices this month');
    await simulateQuery('invoices this month');
    await simulateQuery('PS invoices');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
