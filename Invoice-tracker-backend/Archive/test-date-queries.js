const testQueries = [
  'Invoices from January 2025',
  'Invoices from january',
  'Invoices from last year',
  'Invoices from Barwon Health',
  'Invoices from December 2024',
  'Invoices from this month'
];

testQueries.forEach(query => {
  const queryLower = query.toLowerCase();
  let clientMatch = null;

  const pattern3Match = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|\?)|$)/i);
  if (pattern3Match) {
    const captured = pattern3Match[1].trim();
    const temporalKeywords = ['this month', 'last month', 'next month', 'this year', 'last year', 'next year',
                              'current month', 'previous month', 'current year', 'previous year'];
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december'];

    const isTemporal = temporalKeywords.includes(captured) || monthNames.some(month => captured.startsWith(month));

    if (!isTemporal) {
      clientMatch = pattern3Match;
    }
  }

  console.log(`Query: "${query}"`);
  console.log(`  Client: ${clientMatch ? `"${clientMatch[1]}"` : 'NONE (temporal excluded)'}`);
  console.log();
});
