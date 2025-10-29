// Test Pattern 2 fix for contract queries

const testQueries = [
  'Show me invoices on contract 527995',
  'Show me Barwon Health invoices',
  'Show me Barwon Health invoices from last month'
];

testQueries.forEach(query => {
  const queryLower = query.toLowerCase();
  let clientMatch = null;

  // Pattern 2 with fix
  const pattern2Match = queryLower.match(/show\s+me\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)(?:\s+(?:on|for)\s+contract)?/i);
  if (pattern2Match && !pattern2Match[0].includes(' on contract') && !pattern2Match[0].includes(' for contract')) {
    clientMatch = pattern2Match;
  }

  console.log(`Query: "${query}"`);
  if (clientMatch) {
    console.log(`  ✅ Client matched: "${clientMatch[1].trim()}"`);
  } else {
    console.log(`  ⚠️  Client matched: NONE (correct for contract queries)`);
  }
  console.log();
});
