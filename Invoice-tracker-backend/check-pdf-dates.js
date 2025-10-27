const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
  try {
    const pdfPath = './invoice_pdfs/1761208101142-MDRX_AR_Standard_Invoice_4600032536.pdf';

    if (!fs.existsSync(pdfPath)) {
      console.log('PDF not found at:', pdfPath);
      console.log('Listing invoice_pdfs directory...');
      const files = fs.readdirSync('./invoice_pdfs').filter(f => f.includes('4600032536'));
      console.log('Files matching 4600032536:', files);
      process.exit(1);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);

    console.log('=== PDF TEXT FOR INVOICE 4600032536 ===\n');
    console.log(pdfData.text.substring(0, 2000));
    console.log('\n=== SEARCHING FOR DATE LINES ===');

    // Look for 'Invoice Date' and 'Due Date' labels
    const lines = pdfData.text.split('\n');
    lines.forEach((line, idx) => {
      if (line.match(/Invoice\s+Date|Due\s+Date|DATE/i)) {
        console.log(`Line ${idx}: ${line}`);
        if (lines[idx+1]) console.log(`  Next: ${lines[idx+1]}`);
      }
    });

    console.log('\n=== ALL DATE PATTERNS ===');
    const datePatterns = pdfData.text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g);
    if (datePatterns) {
      console.log('Found dates:', [...new Set(datePatterns)]);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
