const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const dbPath = path.join(__dirname, 'invoices.db');

// Extract services using updated parsing logic
async function extractServices(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  let services = '';

  // Strategy 1: Look for "Description" section in table
  const descMatch = text.match(/Description[\s\S]{0,150}?Week\s+Ending\s+Date[\s\S]{0,150}?Qty[\s\S]{0,150}?UOM[\s\S]{0,150}?Unit\s+Price[\s\S]{0,150}?Taxable[\s\S]{0,150}?Extended\s+Price([\s\S]{0,1500}?)(?:Item\s+Subtotal|Special\s+Instructions|Page\s+\d+)/i);
  if (descMatch) {
    services = descMatch[1].trim();
  }

  // Strategy 2: Look for simpler format "QuantityDescriptionTaxableExt Price"
  if (!services) {
    const simpleMatch = text.match(/Quantity\s*Description\s*Taxable\s*Ext\s+Price([\s\S]{0,8000}?)Item\s+Subtotal/i);
    if (simpleMatch) {
      services = simpleMatch[1].trim();
    }

    // Also try concatenated version
    if (!services) {
      const concatenatedMatch = text.match(/QuantityDescriptionTaxableExt\s+Price([\s\S]{0,8000}?)Item\s+Subtotal/i);
      if (concatenatedMatch) {
        services = concatenatedMatch[1].trim();
      }
    }
  }

  // Clean up
  if (services) {
    const invoiceNumIndex = services.indexOf('Invoice Number:');
    if (invoiceNumIndex > 0) {
      services = services.substring(0, invoiceNumIndex);
    }

    services = services.replace(/^(Taxable\s*Extended\s*Price\s*|Week\s+Ending\s+Date\s*Qty\s*UOM\s*Unit\s*Price\s*|Quantity\s*Description\s*Taxable\s*Ext\s+Price\s*|QuantityDescriptionTaxableExt\s+Price\s*)/i, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+Yes\s+\$[\d,]+/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+\.\d+/g, '');
    services = services.replace(/\s+No\s+\$[\d,]+/g, '');
    services = services.replace(/\s+Yes\s+/g, ' ');
    services = services.replace(/\s+No\s+/g, ' ');
    services = services.replace(/^\d+\s+/gm, '');
    services = services.replace(/\s+\d+\s+/g, ' ');
    services = services.replace(/Invoice\s+Number:\s*[\d]+\s+Invoice\s+Date:\s*[\d\-]+/gi, '');
    services = services.replace(/\s+/g, ' ').trim();
    services = services.substring(0, 500);
  }

  return services || 'No service description found';
}

async function reparseInvoices() {
  try {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    const invoiceNumbers = ['4600015300', '4600017964'];

    for (const invNum of invoiceNumbers) {
      console.log(`\nProcessing invoice ${invNum}...`);

      const stmt = db.prepare('SELECT id, pdfPath FROM invoices WHERE invoiceNumber = ?');
      stmt.bind([invNum]);

      if (stmt.step()) {
        const inv = stmt.getAsObject();
        const pdfFullPath = path.join(__dirname, inv.pdfPath.replace('/pdfs/', 'invoice_pdfs/'));

        if (!fs.existsSync(pdfFullPath)) {
          console.log(`  ✗ PDF not found: ${pdfFullPath}`);
          stmt.free();
          continue;
        }

        // Extract services
        const services = await extractServices(pdfFullPath);
        console.log(`  Extracted services (${services.length} chars)`);
        console.log(`  Preview: ${services.substring(0, 200)}...`);

        // Update database
        db.run("UPDATE invoices SET services = ? WHERE invoiceNumber = ?", [services, invNum]);
        console.log(`  ✓ Updated services field`);
      } else {
        console.log(`  ✗ Invoice not found in database`);
      }

      stmt.free();
    }

    // Save database
    const data = db.export();
    const newBuffer = Buffer.from(data);
    fs.writeFileSync(dbPath, newBuffer);
    console.log('\n✓ Database saved');

    db.close();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

reparseInvoices();
