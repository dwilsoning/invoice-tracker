// Test edge cases for aging bucket boundaries

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today - due;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getAgingBucket(daysOverdue) {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 30) return 'Current';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  if (daysOverdue <= 120) return '91-120';
  if (daysOverdue <= 180) return '121-180';
  if (daysOverdue <= 270) return '181-270';
  if (daysOverdue <= 365) return '271-365';
  return '>365';
}

console.log('Testing bucket edge cases:\n');

const testCases = [
  { days: 0, expected: 'Current' },
  { days: 15, expected: 'Current' },
  { days: 30, expected: 'Current' },
  { days: 31, expected: '31-60' },
  { days: 45, expected: '31-60' },
  { days: 60, expected: '31-60' },
  { days: 61, expected: '61-90' },
  { days: 75, expected: '61-90' },
  { days: 90, expected: '61-90' },
  { days: 91, expected: '91-120' },
];

testCases.forEach(test => {
  const actual = getAgingBucket(test.days);
  const status = actual === test.expected ? '✓' : '✗';
  console.log(`${status} ${test.days} days -> ${actual} (expected: ${test.expected})`);
});

console.log('\n--- Testing invoice 160008976 ---');
const today = new Date('2025-10-24');
const dueDate = new Date('2025-08-24');
const diffTime = today - dueDate;
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

console.log(`Today: ${today.toISOString().split('T')[0]}`);
console.log(`Due date: ${dueDate.toISOString().split('T')[0]}`);
console.log(`Difference in ms: ${diffTime}`);
console.log(`Difference in days (Math.floor): ${diffDays}`);
console.log(`Bucket: ${getAgingBucket(diffDays)}`);

console.log('\n--- Bucket ranges as currently implemented ---');
console.log('Current: 0-30 days overdue');
console.log('31-60: 31-60 days overdue');
console.log('61-90: 61-90 days overdue');
console.log('91-120: 91-120 days overdue');
console.log('etc.');

console.log('\n--- Potential issue ---');
console.log('The bucket "31-60" should contain invoices that are 31-60 days overdue.');
console.log('An invoice that is 61 days overdue belongs in "61-90", which is correct.');
console.log('\nIf you expected invoice 160008976 (61 days overdue) to be in "31-60",');
console.log('that would be incorrect based on standard accounting aging periods.');
