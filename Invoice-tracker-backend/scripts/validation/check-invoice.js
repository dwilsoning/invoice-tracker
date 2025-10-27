const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkInvoice() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'invoices.db');

  if (!fs.existsSync(dbPath)) {
    console.log('Database file not found');
    return;
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Check for the specific invoice
  const result = db.exec("SELECT invoiceNumber, status, dueDate, amountDue, currency, invoiceType FROM invoices WHERE invoiceNumber = '160008976'");

  if (result.length > 0 && result[0].values.length > 0) {
    console.log('Invoice found:');
    console.log('Columns:', result[0].columns);
    console.log('Data:', result[0].values[0]);

    const dueDate = result[0].values[0][2];
    if (dueDate) {
      const today = new Date();
      const due = new Date(dueDate);
      const diffTime = today - due;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      console.log('\nDays calculation:');
      console.log('Today:', today.toISOString().split('T')[0]);
      console.log('Due date:', due.toISOString().split('T')[0]);
      console.log('Days overdue:', diffDays);

      // Determine bucket
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

      console.log('Expected bucket:', bucket);
    }
  } else {
    console.log('Invoice 160008976 not found in database');

    // Let's search for similar invoice numbers
    const similarResult = db.exec("SELECT invoiceNumber FROM invoices WHERE invoiceNumber LIKE '%8976%' LIMIT 10");
    if (similarResult.length > 0 && similarResult[0].values.length > 0) {
      console.log('\nSimilar invoice numbers found:');
      similarResult[0].values.forEach(row => console.log(row[0]));
    }
  }

  db.close();
}

checkInvoice().catch(console.error);
