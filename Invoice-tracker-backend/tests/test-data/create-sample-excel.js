const ExcelJS = require('exceljs');
const path = require('path');

async function createSamplePaymentExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  // Add headers
  worksheet.columns = [
    { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
    { header: 'Payment Date', key: 'paymentDate', width: 15 }
  ];

  // Add sample data
  worksheet.addRow({ invoiceNumber: '4600012956', paymentDate: new Date('2024-09-15') });
  worksheet.addRow({ invoiceNumber: '4600012637', paymentDate: new Date('2024-09-20') });
  worksheet.addRow({ invoiceNumber: '4000005321', paymentDate: new Date('2025-06-15') });

  // Save to file
  const filePath = path.join(__dirname, 'sample-payments.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log('Sample payment Excel file created at:', filePath);
}

createSamplePaymentExcel().catch(console.error);
