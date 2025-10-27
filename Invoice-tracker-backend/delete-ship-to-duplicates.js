const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'invoices.db');

async function deleteShipToDuplicates() {
  try {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found:', dbPath);
      return;
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Find all invoices with "SHIP TO:" as client
    console.log('Finding invoices with "SHIP TO:" as client...');
    const stmt = db.prepare("SELECT id, invoiceNumber, client, pdfPath FROM invoices WHERE client = 'SHIP TO:'");
    const shipToInvoices = [];
    while (stmt.step()) {
      shipToInvoices.push(stmt.getAsObject());
    }
    stmt.free();

    console.log(`Found ${shipToInvoices.length} duplicate invoice(s) with "SHIP TO:" as client`);

    if (shipToInvoices.length > 0) {
      shipToInvoices.forEach(inv => {
        console.log(`  - Invoice: ${inv.invoiceNumber}, pdfPath: ${inv.pdfPath}`);
      });

      // Delete all invoices with "SHIP TO:" as client
      db.run("DELETE FROM invoices WHERE client = 'SHIP TO:'");
      console.log(`\n✓ Deleted ${shipToInvoices.length} duplicate invoice(s)`);

      // Save database
      const data = db.export();
      const newBuffer = Buffer.from(data);
      fs.writeFileSync(dbPath, newBuffer);
      console.log('✓ Database saved');
    } else {
      console.log('No duplicates found');
    }

    db.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

deleteShipToDuplicates();
