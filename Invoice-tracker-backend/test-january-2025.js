const query = 'Invoices from January 2025';
const queryLower = query.toLowerCase();

const pattern3Match = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|\?)|$)/i);

console.log('Pattern 3 match:', pattern3Match);
if (pattern3Match) {
  console.log('Captured:', `"${pattern3Match[1]}"`);
  
  const captured = pattern3Match[1].trim();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                     'july', 'august', 'september', 'october', 'november', 'december'];
  
  // Check if captured text starts with a month name
  const startsWithMonth = monthNames.some(month => captured.startsWith(month));
  console.log('Starts with month?', startsWithMonth);
  
  // Check if captured text is a temporal keyword
  const temporalKeywords = ['this month', 'last month', 'next month', 'this year', 'last year', 'next year'];
  const isTemporal = temporalKeywords.includes(captured);
  console.log('Is temporal keyword?', isTemporal);
  
  if (startsWithMonth || isTemporal) {
    console.log('✅ Should be EXCLUDED from client matching');
  } else {
    console.log('❌ Would be used as client name');
  }
}
