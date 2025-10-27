const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'invoices.db');

async function updateInvoiceType() {
  try {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found:', dbPath);
      return;
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Check if invoice exists
    const checkStmt = db.prepare('SELECT id, invoiceNumber, client, invoiceType FROM invoices WHERE invoiceNumber = ?');
    checkStmt.bind(['4600028556']);

    if (checkStmt.step()) {
      const invoice = checkStmt.getAsObject();
      console.log('Found invoice:');
      console.log('  ID:', invoice.id);
      console.log('  Invoice Number:', invoice.invoiceNumber);
      console.log('  Client:', invoice.client);
      console.log('  Current Type:', invoice.invoiceType);

      // Update the invoice type
      db.run("UPDATE invoices SET invoiceType = 'SW' WHERE invoiceNumber = '4600028556'");

      // Verify update
      const verifyStmt = db.prepare('SELECT invoiceType FROM invoices WHERE invoiceNumber = ?');
      verifyStmt.bind(['4600028556']);

      if (verifyStmt.step()) {
        const updated = verifyStmt.getAsObject();
        console.log('\n✓ Invoice type updated to:', updated.invoiceType);
      }
      verifyStmt.free();

      // Save database
      const data = db.export();
      const newBuffer = Buffer.from(data);
      fs.writeFileSync(dbPath, newBuffer);
      console.log('✓ Database saved');

    } else {
      console.log('Invoice 4600028556 not found in database');
    }

    checkStmt.free();
    db.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateInvoiceType();
