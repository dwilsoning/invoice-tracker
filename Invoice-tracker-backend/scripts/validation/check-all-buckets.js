const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkAllBuckets() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'invoices.db');

  if (!fs.existsSync(dbPath)) {
    console.log('Database file not found');
    return;
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Get all pending invoices excluding credit memos
  const result = db.exec("SELECT invoiceNumber, status, dueDate, amountDue, currency, invoiceType FROM invoices WHERE status = 'Pending' AND invoiceType != 'Credit Memo' ORDER BY dueDate");

  if (result.length > 0 && result[0].values.length > 0) {
    console.log('Analyzing aging buckets for all pending invoices...\n');

    const buckets = {
      'Current': [],
      '31-60': [],
      '61-90': [],
      '91-120': [],
      '121-180': [],
      '181-270': [],
      '271-365': [],
      '>365': []
    };

    result[0].values.forEach(row => {
      const [invoiceNumber, status, dueDate, amountDue, currency, invoiceType] = row;

      if (dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = today - due;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let bucket;
        if (diffDays <= 0) bucket = 'Current';
        else if (diffDays <= 30) bucket = 'Current';
        else if (diffDays <= 60) bucket = '31-60';
        else if (diffDays <= 90) bucket = '61-90';
        else if (diffDays <= 120) bucket = '91-120';
        else if (diffDays <= 180) bucket = '121-180';
        else if (diffDays <= 270) bucket = '181-270';
        else if (diffDays <= 365) bucket = '271-365';
        else bucket = '>365';

        buckets[bucket].push({
          invoiceNumber,
          dueDate,
          daysOverdue: diffDays,
          amount: amountDue,
          currency
        });
      }
    });

    // Display buckets
    Object.keys(buckets).forEach(bucketName => {
      const invoicesInBucket = buckets[bucketName];
      console.log(`\n${bucketName} (${invoicesInBucket.length} invoices):`);

      if (bucketName === '31-60' || bucketName === '61-90') {
        // Show more detail for these buckets
        invoicesInBucket.forEach(inv => {
          console.log(`  ${inv.invoiceNumber} - Due: ${inv.dueDate} - ${inv.daysOverdue} days overdue - ${inv.currency} ${inv.amount}`);
        });
      } else {
        console.log(`  Total count: ${invoicesInBucket.length}`);
      }
    });

    // Check specifically around invoice 160008976
    console.log('\n\n--- Checking invoices near 160008976 ---');
    const nearResult = db.exec("SELECT invoiceNumber, status, dueDate, amountDue, currency, invoiceType FROM invoices WHERE invoiceNumber BETWEEN '160008970' AND '160008980' ORDER BY invoiceNumber");

    if (nearResult.length > 0 && nearResult[0].values.length > 0) {
      nearResult[0].values.forEach(row => {
        const [invoiceNumber, status, dueDate, amountDue, currency, invoiceType] = row;
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = today - due;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let bucket = 'N/A';
        if (status === 'Pending' && invoiceType !== 'Credit Memo') {
          if (diffDays <= 0) bucket = 'Current';
          else if (diffDays <= 30) bucket = 'Current';
          else if (diffDays <= 60) bucket = '31-60';
          else if (diffDays <= 90) bucket = '61-90';
          else if (diffDays <= 120) bucket = '91-120';
          else if (diffDays <= 180) bucket = '121-180';
          else if (diffDays <= 270) bucket = '181-270';
          else if (diffDays <= 365) bucket = '271-365';
          else bucket = '>365';
        } else if (status === 'Paid') {
          bucket = 'Paid (excluded)';
        } else if (invoiceType === 'Credit Memo') {
          bucket = 'Credit Memo (excluded)';
        }

        console.log(`${invoiceNumber}: Status=${status}, Type=${invoiceType}, Due=${dueDate}, Days=${diffDays}, Bucket=${bucket}`);
      });
    }

  } else {
    console.log('No pending invoices found');
  }

  db.close();
}

checkAllBuckets().catch(console.error);
