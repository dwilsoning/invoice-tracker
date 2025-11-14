const { db } = require('./db-postgres');

async function checkCashFlowBuckets() {
  let exitCode = 0;
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const days30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const days60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const days90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log('\n=== Cash Flow Analysis ===');
    console.log('Today:', todayStr);
    console.log('30 days from now:', days30);
    console.log('60 days from now:', days60);
    console.log('90 days from now:', days90);

    // Get all pending invoices
    const allPendingInvoices = await db.all(`
      SELECT invoice_number, client, due_date, amount_due, currency, invoice_type, invoice_date
      FROM invoices
      WHERE status = 'Pending' AND due_date IS NOT NULL
      ORDER BY due_date
    `);

    // Apply production mode filter (as Analytics does)
    const productionStartDate = '2026-01-01';
    const pendingInvoices = allPendingInvoices.filter(inv => inv.invoiceDate >= productionStartDate);

    console.log('\nTotal pending invoices (all):', allPendingInvoices.length);
    console.log('Pending invoices after production mode filter (>= 2026-01-01):', pendingInvoices.length);

    // Exclude credit memos
    const nonCreditMemos = pendingInvoices.filter(inv => inv.invoiceType !== 'Credit Memo');
    console.log('Pending invoices (excluding credit memos):', nonCreditMemos.length);

    // Categorize by due date
    let overdue = [], next30 = [], next31to60 = [], next61to90 = [], beyond90 = [];

    nonCreditMemos.forEach(inv => {
      if (inv.dueDate < todayStr) {
        overdue.push(inv);
      } else if (inv.dueDate <= days30) {
        next30.push(inv);
      } else if (inv.dueDate <= days60) {
        next31to60.push(inv);
      } else if (inv.dueDate <= days90) {
        next61to90.push(inv);
      } else {
        beyond90.push(inv);
      }
    });

    console.log('\n=== Breakdown by Category ===');
    console.log('Overdue (before today):', overdue.length, 'invoices');
    console.log('Due in next 30 days (today to', days30 + '):', next30.length, 'invoices');
    console.log('Due in 31-60 days:', next31to60.length, 'invoices');
    console.log('Due in 61-90 days:', next61to90.length, 'invoices');
    console.log('Due beyond 90 days:', beyond90.length, 'invoices');

    // Calculate totals (simple sum in USD, not converted)
    const sumUSD = (arr) => arr.filter(inv => inv.currency === 'USD').reduce((sum, inv) => sum + inv.amountDue, 0);

    console.log('\n=== USD Amounts (approximate) ===');
    console.log('Overdue:', Math.round(sumUSD(overdue)).toLocaleString());
    console.log('Next 30 days:', Math.round(sumUSD(next30)).toLocaleString());
    console.log('31-60 days:', Math.round(sumUSD(next31to60)).toLocaleString());
    console.log('61-90 days:', Math.round(sumUSD(next61to90)).toLocaleString());
    console.log('Beyond 90 days:', Math.round(sumUSD(beyond90)).toLocaleString());

    // Combined (as current logic does)
    const combinedNext30 = [...overdue, ...next30];
    console.log('\n=== Current Logic (Overdue + Next 30) ===');
    console.log('Total invoices in "Next 30 Days":', combinedNext30.length);
    console.log('USD Amount:', Math.round(sumUSD(combinedNext30)).toLocaleString());

    // Show some sample overdue invoices
    console.log('\n=== Sample Overdue Invoices ===');
    overdue.slice(0, 10).forEach(inv => {
      console.log(`${inv.invoiceNumber} | ${inv.client.substring(0, 30)} | Due: ${inv.dueDate} | ${inv.currency} ${inv.amountDue.toLocaleString()}`);
    });

    if (overdue.length > 10) {
      console.log(`... and ${overdue.length - 10} more overdue invoices`);
    }

  } catch (error) {
    console.error('Error:', error);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

checkCashFlowBuckets();
