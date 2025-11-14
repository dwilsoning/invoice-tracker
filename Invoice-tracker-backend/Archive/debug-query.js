// Debug the exact query matching logic

const query = "invoices for contract 516557";
const queryLower = query.toLowerCase();

console.log(`Testing query: "${query}"\n`);

// Pattern 3 from server-postgres.js
const pattern3Match = queryLower.match(/(?:invoices?|contracts?)\s+(?:for|from|to|by)\s+([a-z0-9\s&'.,-]+?)(?:\s+(?:this|last|next|that|are|is|in|during|between|from\s+(?:this|last|next)|on\s+contract|for\s+contract|\?)|$)/i);

console.log("Pattern 3 (Client filter):");
if (pattern3Match) {
  console.log(`  Full match: "${pattern3Match[0]}"`);
  console.log(`  Captured: "${pattern3Match[1]}"`);
  console.log(`  Captured trimmed: "${pattern3Match[1].trim()}"`);
  console.log(`  Is "contract"? ${pattern3Match[1].trim() === 'contract'}`);
  console.log(`  Starts with "contract "? ${pattern3Match[1].trim().startsWith('contract ')}`);
  console.log(`  Should skip? ${pattern3Match[1].trim() === 'contract' || pattern3Match[1].trim().startsWith('contract ')}`);
} else {
  console.log("  No match");
}

console.log();

// Contract pattern from server-postgres.js
const contractMatch = queryLower.match(/(?:on\s+contract|for\s+contract|contract)\s+([a-z0-9\s\-_'.&,]+?)(?:\s+(?:what|total|sum|how|in|during|are|is|invoices?|\?)|$)/i);

console.log("Contract filter:");
if (contractMatch) {
  console.log(`  Full match: "${contractMatch[0]}"`);
  console.log(`  Captured: "${contractMatch[1]}"`);
  console.log(`  Captured trimmed: "${contractMatch[1].trim()}"`);
} else {
  console.log("  No match");
}
