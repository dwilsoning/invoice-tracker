// Test all client matching patterns for contract query

const query = 'Show me invoices on contract 527995';
const queryLower = query.toLowerCase();

console.log('Testing ALL client patterns for:', query);
console.log('');

// Pattern 1: which/what X contracts/invoices
let clientMatch = queryLower.match(/(?:which|what)\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)/i);
console.log('Pattern 1 (which/what X):', clientMatch ? `MATCHED: "${clientMatch[1]}"` : 'NO MATCH');

// Pattern 2: show me X invoices/contracts
if (!clientMatch) {
  const pattern2Match = queryLower.match(/show\s+me\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)(?:\s+(?:on|for)\s+contract)?/i);
  console.log('Pattern 2 raw match:', pattern2Match ? `"${pattern2Match[0]}"` : 'NO MATCH');
  if (pattern2Match) {
    console.log('  Captured:', `"${pattern2Match[1]}"`);
    console.log('  Includes " on contract"?', pattern2Match[0].includes(' on contract'));
    console.log('  Includes " for contract"?', pattern2Match[0].includes(' for contract'));
  }

  if (pattern2Match && !pattern2Match[0].includes(' on contract') && !pattern2Match[0].includes(' for contract')) {
    clientMatch = pattern2Match;
    console.log('Pattern 2 (show me X):', `MATCHED: "${clientMatch[1]}"`);
  } else {
    console.log('Pattern 2 (show me X):', 'EXCLUDED (contract query)');
  }
}

// Pattern 3: invoices/contracts for/from/to X
if (!clientMatch) {
  clientMatch = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|\?)|$)/i);
  console.log('Pattern 3 (invoices for X):', clientMatch ? `MATCHED: "${clientMatch[1]}"` : 'NO MATCH');
}

// Pattern 4: X contracts/invoices
if (!clientMatch) {
  const potentialMatch = queryLower.match(/^([a-z0-9\s&'.,-]+?)\s+(contracts?|invoices?)(?:\s+(?:for|from|to|by))?/i);
  if (potentialMatch) {
    console.log('Pattern 4 raw match:', `"${potentialMatch[0]}"`);
    console.log('  Captured:', `"${potentialMatch[1]}"`);
    console.log('  Has trailing preposition?', potentialMatch[0].match(/\s+(?:for|from|to|by)\s*$/i) ? 'YES' : 'NO');

    if (!potentialMatch[0].match(/\s+(?:for|from|to|by)\s*$/i)) {
      const potentialClient = potentialMatch[1].trim();
      const excludedWords = ['unpaid', 'paid', 'overdue', 'pending', 'outstanding',
                             'professional', 'professional services', 'maintenance', 'subscription', 'hosting',
                             'managed', 'managed services', 'software', 'hardware', 'ps', 'maint', 'sub',
                             'ms', 'sw', 'hw', '3pp', 'third', 'third party', 'credit', 'credit memo',
                             'monthly', 'quarterly', 'annual', 'adhoc', 'show', 'show me'];

      if (!excludedWords.includes(potentialClient)) {
        clientMatch = [potentialMatch[0], potentialMatch[1]];
        console.log('Pattern 4 (X invoices):', `MATCHED: "${clientMatch[1]}"`);
      } else {
        console.log('Pattern 4 (X invoices):', `EXCLUDED (excluded word: "${potentialClient}")`);
      }
    }
  } else {
    console.log('Pattern 4 (X invoices):', 'NO MATCH');
  }
}

console.log('');
console.log('=== FINAL RESULT ===');
console.log('Client matched:', clientMatch ? `"${clientMatch[1].trim()}"` : 'NONE');
