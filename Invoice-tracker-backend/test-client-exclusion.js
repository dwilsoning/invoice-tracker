// Test the client matching logic with exclusion list

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

  // Pattern 4: "X contracts/invoices" at the beginning (only if X is not a status/type word)
  if (!clientMatch) {
    const potentialMatch = queryLower.match(/^([a-z0-9\s&'.,-]+?)\s+(contracts?|invoices?)(?:\s+(?:for|from|to|by))?/i);
    if (potentialMatch && !potentialMatch[0].match(/\s+(?:for|from|to|by)\s*$/i)) {
      const potentialClient = potentialMatch[1].trim();

      // Exclude status words and invoice type words from being treated as client names
      const excludedWords = ['unpaid', 'paid', 'overdue', 'pending', 'outstanding',
                             'professional', 'professional services', 'maintenance', 'subscription', 'hosting',
                             'managed', 'managed services', 'software', 'hardware', 'ps', 'maint', 'sub',
                             'ms', 'sw', 'hw', '3pp', 'third', 'third party', 'credit', 'credit memo',
                             'monthly', 'quarterly', 'annual', 'adhoc'];

      if (!excludedWords.includes(potentialClient)) {
        clientMatch = [potentialMatch[0], potentialMatch[1]];
      } else {
        console.log(`  ⚠️  Excluded '${potentialClient}' from being treated as client name`);
      }
    }
  }

  return clientMatch ? clientMatch[1].trim() : null;
}

const testQueries = [
  'Unpaid invoices',
  'Overdue invoices',
  'Professional Services invoices',
  'Barwon Health invoices',
  'Maintenance invoices for Barwon Health'
];

console.log('Testing client matching with exclusion list:\n');
testQueries.forEach(query => {
  console.log(`Query: "${query}"`);
  const client = testClientMatch(query);
  console.log(`  Client matched: ${client || 'NONE (correct - this is a status/type query)'}`);
  console.log();
});
