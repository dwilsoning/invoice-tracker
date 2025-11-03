const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testBulkUpdate() {
  try {
    console.log('Testing bulk invoice status update...\n');

    // Get some invoices first
    console.log('1. Fetching invoices...');
    const response = await axios.get(`${API_URL}/invoices`);
    const invoices = response.data;

    // Filter out credit memos and get first 3 pending invoices
    const pendingInvoices = invoices
      .filter(inv => inv.invoiceType !== 'Credit Memo' && inv.status === 'Pending')
      .slice(0, 3);

    if (pendingInvoices.length === 0) {
      console.log('No pending invoices found to test with.');
      return;
    }

    const testInvoiceIds = pendingInvoices.map(inv => inv.id);
    console.log(`Found ${testInvoiceIds.length} pending invoices to test:`, testInvoiceIds);
    console.log('Invoices:', pendingInvoices.map(inv => ({
      id: inv.id,
      number: inv.invoiceNumber,
      status: inv.status
    })));

    // Test 1: Mark them as Paid
    console.log('\n2. Testing bulk update to Paid...');
    const paidResponse = await axios.put(`${API_URL}/invoices/bulk-status`, {
      invoiceIds: testInvoiceIds,
      status: 'Paid',
      paymentDate: new Date().toISOString().split('T')[0]
    });
    console.log('Response:', paidResponse.data);

    // Verify the update
    console.log('\n3. Verifying invoices are marked as Paid...');
    for (const id of testInvoiceIds) {
      const invoice = await axios.get(`${API_URL}/invoices`);
      const updated = invoice.data.find(inv => inv.id === id);
      console.log(`Invoice ${updated.invoiceNumber}: ${updated.status} (payment date: ${updated.paymentDate})`);
    }

    // Test 2: Mark them back as Pending
    console.log('\n4. Testing bulk update back to Pending...');
    const pendingResponse = await axios.put(`${API_URL}/invoices/bulk-status`, {
      invoiceIds: testInvoiceIds,
      status: 'Pending',
      paymentDate: null
    });
    console.log('Response:', pendingResponse.data);

    // Verify the update
    console.log('\n5. Verifying invoices are marked as Pending...');
    for (const id of testInvoiceIds) {
      const invoice = await axios.get(`${API_URL}/invoices`);
      const updated = invoice.data.find(inv => inv.id === id);
      console.log(`Invoice ${updated.invoiceNumber}: ${updated.status} (payment date: ${updated.paymentDate})`);
    }

    console.log('\n✅ Bulk update tests completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
  }
}

testBulkUpdate();
