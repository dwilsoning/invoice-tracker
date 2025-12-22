const { db } = require('../db-postgres');

(async () => {
  const allInvoices = await db.all("SELECT * FROM invoices WHERE status = 'Pending'");
  console.log('Total pending invoices in database:', allInvoices.length);

  const analyticsInvoices = allInvoices.filter(inv =>
    inv.invoiceType !== 'Credit Memo' &&
    inv.invoiceType !== 'Vendor Invoice' &&
    inv.invoiceType !== 'PO'
  );
  console.log('After excluding Credit Memo/Vendor Invoice/PO:', analyticsInvoices.length);

  const today = new Date();
  const over365 = analyticsInvoices.filter(inv => {
    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    return daysOverdue > 365;
  });

  console.log('\nInvoices in >365 bucket (after exclusions):', over365.length);

  const exchangeRates = { USD: 1, AUD: 0.65, EUR: 1.08, GBP: 1.27, SGD: 0.74, NZD: 0.61 };
  const convertToUSD = (amount, currency) => {
    const rate = exchangeRates[currency] || 1;
    return amount / rate;
  };

  const total365USD = over365.reduce((sum, inv) => {
    const usd = convertToUSD(inv.amountDue, inv.currency);
    // Skip negative amounts like the aging report does
    if (usd < 0) return sum;
    return sum + usd;
  }, 0);

  console.log('Total >365 in USD: $' + total365USD.toLocaleString('en-US', {minimumFractionDigits: 2}));

  console.log('\nFirst 10 invoices in >365:');
  over365.slice(0, 10).forEach(inv => {
    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    const usd = convertToUSD(inv.amountDue, inv.currency);
    console.log(`  ${inv.invoiceNumber}: ${inv.invoiceType}, Due: ${inv.dueDate}, ${daysOverdue} days, ${inv.currency} ${inv.amountDue} = USD ${usd.toFixed(2)}`);
  });

  // Check what types are in the >365 bucket
  const typeBreakdown = {};
  over365.forEach(inv => {
    const usd = convertToUSD(inv.amountDue, inv.currency);
    if (usd < 0) return; // Skip negative amounts

    if (!typeBreakdown[inv.invoiceType]) {
      typeBreakdown[inv.invoiceType] = { count: 0, totalUSD: 0 };
    }
    typeBreakdown[inv.invoiceType].count++;
    typeBreakdown[inv.invoiceType].totalUSD += usd;
  });

  console.log('\nBreakdown by invoice type in >365:');
  Object.entries(typeBreakdown).forEach(([type, data]) => {
    console.log(`  ${type}: ${data.count} invoices, $${data.totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  });

  process.exit(0);
})();
