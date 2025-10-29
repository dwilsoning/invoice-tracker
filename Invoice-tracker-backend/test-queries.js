// Test script to validate query regex patterns

const testQueries = [
  // Client queries
  { query: "Which Barwon Health contracts are unpaid", expectedClient: "barwon health", expectedStatus: "unpaid" },
  { query: "Invoices for Minister for Health", expectedClient: "minister for health" },
  { query: "Show me Barwon Health invoices from last month", expectedClient: "barwon health", expectedDate: "last month" },

  // Status queries
  { query: "Unpaid invoices", expectedStatus: "unpaid" },
  { query: "Outstanding invoices", expectedStatus: "unpaid" },
  { query: "Overdue invoices", expectedStatus: "overdue" },
  { query: "Paid invoices this year", expectedStatus: "paid", expectedDate: "this year" },

  // Invoice type queries
  { query: "Professional Services invoices", expectedType: "ps" },
  { query: "PS invoices", expectedType: "ps" },
  { query: "Maintenance invoices for Barwon Health", expectedType: "maint", expectedClient: "barwon health" },
  { query: "Subscription invoices this month", expectedType: "sub", expectedDate: "this month" },

  // Contract queries
  { query: "Show me invoices on contract 527995", expectedContract: "527995" },
  { query: "Contract 12345 invoices", expectedContract: "12345" },

  // Date queries
  { query: "Invoices from this month", expectedDate: "this month" },
  { query: "Invoices from January 2025", expectedDate: "january" },

  // Special queries
  { query: "Contracts with no value", expectedSpecial: "no_value" },
  { query: "Monthly invoices in USD", expectedFrequency: "monthly", expectedCurrency: "usd" },
];

// Client matching regex patterns (copied from server-postgres.js)
function testClientMatch(query) {
  const queryLower = query.toLowerCase();
  let clientMatch = null;

  // Pattern 1: "which/what X contracts/invoices"
  clientMatch = queryLower.match(/(?:which|what)\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)/i);

  // Pattern 2: "show me X invoices/contracts"
  if (!clientMatch) {
    clientMatch = queryLower.match(/show\s+me\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)/i);
  }

  // Pattern 3: "invoices/contracts for/from/to X"
  if (!clientMatch) {
    clientMatch = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|\?)|$)/i);
  }

  // Pattern 4: "X contracts/invoices" at the beginning (only if no preposition follows)
  if (!clientMatch) {
    const potentialMatch = queryLower.match(/^([a-z0-9\s&'.,-]+?)\s+(contracts?|invoices?)(?:\s+(?:for|from|to|by))?/i);
    if (potentialMatch && !potentialMatch[0].match(/\s+(?:for|from|to|by)\s*$/i)) {
      clientMatch = [potentialMatch[0], potentialMatch[1]];
    }
  }

  return clientMatch ? clientMatch[1].trim() : null;
}

// Contract matching regex
function testContractMatch(query) {
  const queryLower = query.toLowerCase();
  const contractMatch = queryLower.match(/(?:on\s+contract|for\s+contract|contract)\s+([a-z0-9\s\-_'.&,]+?)(?:\s+(?:what|total|sum|how|in|during|are|is|invoices?|\?)|$)/i);
  return contractMatch ? contractMatch[1].trim() : null;
}

// Status matching
function testStatusMatch(query) {
  const queryLower = query.toLowerCase();
  if (queryLower.includes('overdue')) return 'overdue';
  if (queryLower.includes('unpaid') || queryLower.includes('pending') || queryLower.includes('outstanding')) return 'unpaid';
  if (queryLower.includes('paid')) return 'paid';
  return null;
}

// Type matching
function testTypeMatch(query) {
  const queryLower = query.toLowerCase();
  const typeMap = {
    'professional services': 'ps', 'ps': 'ps',
    'maintenance': 'maint', 'maint': 'maint',
    'subscription': 'sub', 'sub': 'sub',
    'hosting': 'hosting',
    'managed services': 'ms', 'ms': 'ms',
    'software': 'sw', 'sw': 'sw',
    'hardware': 'hw', 'hw': 'hw',
    'third party': '3pp', '3pp': '3pp',
    'credit memo': 'credit memo'
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (queryLower.includes(key)) return value;
  }
  return null;
}

// Date matching
function testDateMatch(query) {
  const queryLower = query.toLowerCase();
  if (queryLower.includes('this month') || queryLower.includes('current month')) return 'this month';
  if (queryLower.includes('last month') || queryLower.includes('previous month')) return 'last month';
  if (queryLower.includes('this year') || queryLower.includes('current year')) return 'this year';
  if (queryLower.includes('last year') || queryLower.includes('previous year')) return 'last year';

  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  for (const month of months) {
    if (queryLower.includes(month)) return month;
  }

  return null;
}

// Special query matching
function testSpecialMatch(query) {
  const queryLower = query.toLowerCase();
  if (queryLower.match(/contracts?.*(with\s+no|without|no)\s+value/i) ||
      queryLower.match(/which.*contracts.*no.*value/i)) {
    return 'no_value';
  }
  return null;
}

// Frequency matching
function testFrequencyMatch(query) {
  const queryLower = query.toLowerCase();
  const frequencies = ['monthly', 'quarterly', 'annual', 'adhoc', 'one-time'];
  for (const freq of frequencies) {
    if (queryLower.includes(freq)) return freq;
  }
  return null;
}

// Currency matching
function testCurrencyMatch(query) {
  const queryLower = query.toLowerCase();
  const currencies = ['usd', 'aud', 'eur', 'gbp', 'sgd'];
  for (const curr of currencies) {
    if (queryLower.includes(curr)) return curr;
  }
  return null;
}

// Run tests
console.log("=== Testing Query Patterns ===\n");

let passCount = 0;
let failCount = 0;

testQueries.forEach(test => {
  console.log(`Query: "${test.query}"`);
  let allPass = true;

  if (test.expectedClient !== undefined) {
    const matched = testClientMatch(test.query);
    const pass = matched === test.expectedClient;
    console.log(`  Client: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedClient}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedContract !== undefined) {
    const matched = testContractMatch(test.query);
    const pass = matched === test.expectedContract;
    console.log(`  Contract: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedContract}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedStatus !== undefined) {
    const matched = testStatusMatch(test.query);
    const pass = matched === test.expectedStatus;
    console.log(`  Status: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedStatus}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedType !== undefined) {
    const matched = testTypeMatch(test.query);
    const pass = matched === test.expectedType;
    console.log(`  Type: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedType}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedDate !== undefined) {
    const matched = testDateMatch(test.query);
    const pass = matched === test.expectedDate;
    console.log(`  Date: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedDate}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedSpecial !== undefined) {
    const matched = testSpecialMatch(test.query);
    const pass = matched === test.expectedSpecial;
    console.log(`  Special: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedSpecial}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedFrequency !== undefined) {
    const matched = testFrequencyMatch(test.query);
    const pass = matched === test.expectedFrequency;
    console.log(`  Frequency: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedFrequency}")`);
    if (!pass) allPass = false;
  }

  if (test.expectedCurrency !== undefined) {
    const matched = testCurrencyMatch(test.query);
    const pass = matched === test.expectedCurrency;
    console.log(`  Currency: ${pass ? '✅' : '❌'} "${matched}" (expected "${test.expectedCurrency}")`);
    if (!pass) allPass = false;
  }

  if (allPass) passCount++;
  else failCount++;

  console.log();
});

console.log(`\n=== Summary ===`);
console.log(`Passed: ${passCount}/${testQueries.length}`);
console.log(`Failed: ${failCount}/${testQueries.length}`);
