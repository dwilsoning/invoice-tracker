const query = 'Invoices from last year';
const queryLower = query.toLowerCase();

console.log('Testing patterns for:', query);
console.log('');

// Pattern 1
let clientMatch = queryLower.match(/(?:which|what)\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)/i);
console.log('Pattern 1:', clientMatch ? `"${clientMatch[1]}"` : 'NO MATCH');

// Pattern 2
if (!clientMatch) {
  const pattern2Match = queryLower.match(/show\s+me\s+([a-z0-9\s&'.,-]+?)\s+(?:contracts?|invoices?)(?:\s+(?:on|for)\s+contract)?/i);
  if (pattern2Match && !pattern2Match[0].includes(' on contract') && !pattern2Match[0].includes(' for contract')) {
    clientMatch = pattern2Match;
  }
  console.log('Pattern 2:', clientMatch ? `"${clientMatch[1]}"` : 'NO MATCH');
}

// Pattern 3
if (!clientMatch) {
  clientMatch = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|\?)|$)/i);
  console.log('Pattern 3 match:', clientMatch);
  if (clientMatch) {
    console.log('Pattern 3: MATCHED', `"${clientMatch[1]}"`);
  } else {
    console.log('Pattern 3:', 'NO MATCH');
  }
}

// Pattern 4
if (!clientMatch) {
  const potentialMatch = queryLower.match(/^([a-z0-9\s&'.,-]+?)\s+(contracts?|invoices?)(?:\s+(?:for|from|to|by))?/i);
  console.log('Pattern 4 raw match:', potentialMatch);
  if (potentialMatch) {
    console.log('Pattern 4: would match', `"${potentialMatch[1]}"`);
  } else {
    console.log('Pattern 4:', 'NO MATCH');
  }
}

console.log('');
console.log('Final:', clientMatch ? `Client: "${clientMatch[1]}"` : 'NO CLIENT');
