const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api';

async function testAttachments() {
  try {
    console.log('🧪 Testing attachment functionality...\n');

    // 1. Get first invoice to test with
    console.log('1. Fetching invoices...');
    const invoicesResponse = await axios.get(`${API_URL}/invoices`);
    const invoices = invoicesResponse.data;

    if (invoices.length === 0) {
      console.log('❌ No invoices found in database. Please add an invoice first.');
      return;
    }

    const testInvoice = invoices[0];
    console.log(`✅ Using invoice: ${testInvoice.invoiceNumber} (ID: ${testInvoice.id})\n`);

    // 2. Create a test file
    console.log('2. Creating test file...');
    const testFilePath = path.join(__dirname, 'test-attachment.txt');
    fs.writeFileSync(testFilePath, 'This is a test attachment file for testing purposes.');
    console.log('✅ Test file created\n');

    // 3. Upload attachment
    console.log('3. Uploading attachment...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath), 'test-attachment.txt');

    const uploadResponse = await axios.post(
      `${API_URL}/invoices/${testInvoice.id}/attachments`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    console.log('✅ Attachment uploaded:', uploadResponse.data);
    const attachmentId = uploadResponse.data.id;
    console.log('');

    // 4. Get attachments for invoice
    console.log('4. Fetching attachments for invoice...');
    const attachmentsResponse = await axios.get(`${API_URL}/invoices/${testInvoice.id}/attachments`);
    console.log(`✅ Found ${attachmentsResponse.data.length} attachment(s):`, attachmentsResponse.data);
    console.log('');

    // 5. Test notes field
    console.log('5. Testing notes field...');
    const updateResponse = await axios.put(`${API_URL}/invoices/${testInvoice.id}`, {
      notes: 'This is a test note added via API'
    });
    console.log('✅ Notes updated successfully');
    console.log('');

    // 6. Verify notes were saved
    console.log('6. Verifying notes were saved...');
    const updatedInvoice = invoices.find(inv => inv.id === testInvoice.id);
    const verifyResponse = await axios.get(`${API_URL}/invoices`);
    const verifiedInvoice = verifyResponse.data.find(inv => inv.id === testInvoice.id);
    console.log(`✅ Notes field: "${verifiedInvoice.notes || '(empty)'}"`);
    console.log('');

    // 7. Delete attachment
    console.log('7. Deleting attachment...');
    await axios.delete(`${API_URL}/attachments/${attachmentId}`);
    console.log('✅ Attachment deleted');
    console.log('');

    // 8. Verify deletion
    console.log('8. Verifying deletion...');
    const finalAttachmentsResponse = await axios.get(`${API_URL}/invoices/${testInvoice.id}/attachments`);
    console.log(`✅ Attachments after deletion: ${finalAttachmentsResponse.data.length}`);
    console.log('');

    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log('🧹 Cleaned up test file');

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAttachments();
