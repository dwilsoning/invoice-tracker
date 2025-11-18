// Analyze query pattern matching

const testQueries = [
  'invoices for contract 516557',
  'show me invoices for contract 516557',
  'contract 516557',
  'invoices on contract 516557',
  'Type invoices this month',
  'invoices this month',
  'PS invoices this month',
  'Type invoices',
  'PS invoices',
  'Maint invoices'
];

console.log('Testing contract pattern:');
const contractPattern = /(?:on\s+contract|for\s+contract|contract)\s+([a-z0-9\s\-_'.&,]+?)(?:\s+(?:what|total|sum|how|in|during|are|is|invoices?|\?)|$)/i;

testQueries.forEach(query => {
  const match = query.toLowerCase().match(contractPattern);
  console.log(`\nQuery: "${query}"`);
  console.log(`Match: ${match ? `YES - captured: "${match[1]}"` : 'NO'}`);
});

console.log('\n\n' + '='.repeat(80));
console.log('Testing invoice type pattern:');
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

testQueries.forEach(query => {
  const queryLower = query.toLowerCase();
  let foundType = null;

  for (const [key, value] of Object.entries(typeMap)) {
    if (queryLower.includes(key)) {
      foundType = value;
      break;
    }
  }

  console.log(`\nQuery: "${query}"`);
  console.log(`Type: ${foundType || 'NONE'}`);
});

console.log('\n\n' + '='.repeat(80));
console.log('Testing date pattern (this month):');

testQueries.forEach(query => {
  const queryLower = query.toLowerCase();
  const hasThisMonth = queryLower.includes('this month') || queryLower.includes('current month');

  console.log(`\nQuery: "${query}"`);
  console.log(`This Month: ${hasThisMonth ? 'YES' : 'NO'}`);
});
