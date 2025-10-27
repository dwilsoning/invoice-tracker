const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'invoices.db');

async function fixInvalidClients() {
  try {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found:', dbPath);
      return;
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Find invoices with "Remittance" as client
    console.log('Checking for invoices with "Remittance" as client...');
    const remittanceStmt = db.prepare("SELECT id, invoiceNumber, client FROM invoices WHERE LOWER(TRIM(client)) = 'remittance'");
    const remittanceInvoices = [];
    while (remittanceStmt.step()) {
      remittanceInvoices.push(remittanceStmt.getAsObject());
    }
    remittanceStmt.free();

    console.log(`Found ${remittanceInvoices.length} invoice(s) with "Remittance" as client`);
    if (remittanceInvoices.length > 0) {
      remittanceInvoices.forEach(inv => {
        console.log(`  - Invoice: ${inv.invoiceNumber}, ID: ${inv.id}`);
      });

      // Delete invoices with Remittance as client
      db.run("DELETE FROM invoices WHERE LOWER(TRIM(client)) = 'remittance'");
      console.log(`✓ Deleted ${remittanceInvoices.length} invoice(s) with "Remittance" as client`);
    }

    // Find invoices with "Ship To" as client
    console.log('\nChecking for invoices with "Ship To" as client...');
    const shipToStmt = db.prepare("SELECT id, invoiceNumber, client FROM invoices WHERE LOWER(TRIM(client)) = 'ship to'");
    const shipToInvoices = [];
    while (shipToStmt.step()) {
      shipToInvoices.push(shipToStmt.getAsObject());
    }
    shipToStmt.free();

    console.log(`Found ${shipToInvoices.length} invoice(s) with "Ship To" as client`);
    if (shipToInvoices.length > 0) {
      shipToInvoices.forEach(inv => {
        console.log(`  - Invoice: ${inv.invoiceNumber}, ID: ${inv.id}`);
      });

      // Update invoices with "Ship To" to "Unknown Client"
      db.run("UPDATE invoices SET client = 'Unknown Client' WHERE LOWER(TRIM(client)) = 'ship to'");
      console.log(`✓ Updated ${shipToInvoices.length} invoice(s) with "Ship To" to "Unknown Client"`);
    }

    // Save database if changes were made
    if (remittanceInvoices.length > 0 || shipToInvoices.length > 0) {
      const data = db.export();
      const newBuffer = Buffer.from(data);
      fs.writeFileSync(dbPath, newBuffer);
      console.log('\n✓ Database saved');
    } else {
      console.log('\nNo changes needed');
    }

    db.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixInvalidClients();
