const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Note: This test suite requires the server to be running on port 3001
const API_URL = 'http://localhost:3001';

describe('Integration Tests - Complete Workflows', () => {
  const testPdfPath = path.join(__dirname, '../test-data', 'sample-invoice-quarterly.pdf');
  const testExcelPath = path.join(__dirname, '../test-data', 'sample-payments.xlsx');

  let uploadedInvoiceId;
  let uploadedInvoiceNumber;

  describe('Complete Invoice Lifecycle', () => {
    test('Step 1: Upload invoice PDF', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping workflow...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      if (response.body.invoices.length > 0) {
        uploadedInvoiceId = response.body.invoices[0].id;
        uploadedInvoiceNumber = response.body.invoices[0].invoiceNumber;

        expect(uploadedInvoiceId).toBeDefined();
        expect(uploadedInvoiceNumber).toBeDefined();
      }
    });

    test('Step 2: Verify invoice appears in list', async () => {
      if (!uploadedInvoiceId) {
        console.log('No uploaded invoice, skipping...');
        return;
      }

      const response = await request(API_URL).get('/api/invoices');

      expect(response.status).toBe(200);
      const invoice = response.body.find(inv => inv.id === uploadedInvoiceId);

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('Pending');
    });

    test('Step 3: Update invoice status to Paid', async () => {
      if (!uploadedInvoiceId) {
        console.log('No uploaded invoice, skipping...');
        return;
      }

      const paymentDate = new Date().toISOString().split('T')[0];
      const response = await request(API_URL)
        .put(`/api/invoices/${uploadedInvoiceId}`)
        .send({
          status: 'Paid',
          paymentDate: paymentDate
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 4: Verify invoice status updated', async () => {
      if (!uploadedInvoiceId) {
        console.log('No uploaded invoice, skipping...');
        return;
      }

      const response = await request(API_URL).get('/api/invoices');
      const invoice = response.body.find(inv => inv.id === uploadedInvoiceId);

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('Paid');
      expect(invoice.paymentDate).toBeDefined();
    });

    test('Step 5: Query for paid invoices', async () => {
      const response = await request(API_URL)
        .post('/api/query')
        .send({ query: 'show me paid invoices' });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();

      if (uploadedInvoiceId) {
        const paidInvoices = response.body.invoices;
        const foundInvoice = paidInvoices.find(inv => inv.id === uploadedInvoiceId);
        expect(foundInvoice).toBeDefined();
      }
    });

    test('Step 6: Delete invoice', async () => {
      if (!uploadedInvoiceId) {
        console.log('No uploaded invoice, skipping...');
        return;
      }

      const response = await request(API_URL)
        .delete(`/api/invoices/${uploadedInvoiceId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 7: Verify invoice deleted', async () => {
      if (!uploadedInvoiceId) {
        console.log('No uploaded invoice, skipping...');
        return;
      }

      const response = await request(API_URL).get('/api/invoices');
      const invoice = response.body.find(inv => inv.id === uploadedInvoiceId);

      expect(invoice).toBeUndefined();
    });
  });

  describe('Duplicate Handling Workflow', () => {
    let duplicateInvoiceId1;
    let duplicateInvoiceId2;
    let duplicateInvoiceNumber;

    test('Step 1: Upload invoice first time', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      expect(response.status).toBe(200);

      if (response.body.invoices.length > 0) {
        duplicateInvoiceId1 = response.body.invoices[0].id;
        duplicateInvoiceNumber = response.body.invoices[0].invoiceNumber;
      }
    });

    test('Step 2: Upload same invoice again', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      expect(response.status).toBe(200);
      expect(response.body.duplicates).toBeDefined();
      expect(response.body.duplicates.length).toBeGreaterThan(0);
    });

    test('Step 3: Get duplicates list', async () => {
      if (!duplicateInvoiceNumber) {
        console.log('No duplicate invoice number, skipping...');
        return;
      }

      const response = await request(API_URL)
        .get(`/api/invoices/duplicates/${duplicateInvoiceNumber}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Step 4: Clean up duplicates', async () => {
      if (!duplicateInvoiceId1) {
        console.log('No duplicate invoice, skipping...');
        return;
      }

      // Delete the uploaded invoice
      await request(API_URL).delete(`/api/invoices/${duplicateInvoiceId1}`);
    });
  });

  describe('Contract and Invoice Relationship Workflow', () => {
    const testContractName = 'WORKFLOW-TEST-' + Date.now();
    let contractInvoiceId;

    test('Step 1: Create contract', async () => {
      const response = await request(API_URL)
        .post('/api/contracts')
        .send({
          contractName: testContractName,
          contractValue: 500000,
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 2: Verify contract created', async () => {
      const response = await request(API_URL).get('/api/contracts');

      expect(response.status).toBe(200);
      const contract = response.body.find(c => c.contractName === testContractName);

      expect(contract).toBeDefined();
      expect(contract.contractValue).toBe(500000);
    });

    test('Step 3: Update contract value', async () => {
      const response = await request(API_URL)
        .put(`/api/contracts/${encodeURIComponent(testContractName)}`)
        .send({
          contractValue: 750000,
          currency: 'USD'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 4: Verify contract updated', async () => {
      const response = await request(API_URL).get('/api/contracts');
      const contract = response.body.find(c => c.contractName === testContractName);

      expect(contract).toBeDefined();
      expect(contract.contractValue).toBe(750000);
    });

    test('Step 5: Delete contract', async () => {
      const response = await request(API_URL)
        .delete(`/api/contracts/${encodeURIComponent(testContractName)}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 6: Verify contract deleted', async () => {
      const response = await request(API_URL).get('/api/contracts');
      const contract = response.body.find(c => c.contractName === testContractName);

      expect(contract).toBeUndefined();
    });
  });

  describe('Payment Processing Workflow', () => {
    let paymentInvoiceId;
    let paymentInvoiceNumber;

    test('Step 1: Upload invoice for payment', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      if (response.body.invoices && response.body.invoices.length > 0) {
        paymentInvoiceId = response.body.invoices[0].id;
        paymentInvoiceNumber = response.body.invoices[0].invoiceNumber;
      }
    });

    test('Step 2: Verify invoice status is Pending', async () => {
      if (!paymentInvoiceId) {
        console.log('No payment invoice, skipping...');
        return;
      }

      const response = await request(API_URL).get('/api/invoices');
      const invoice = response.body.find(inv => inv.id === paymentInvoiceId);

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('Pending');
    });

    test('Step 3: Process payment via spreadsheet upload', async () => {
      if (!fs.existsSync(testExcelPath)) {
        console.log('Test Excel not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-payments')
        .attach('spreadsheet', testExcelPath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 4: Clean up payment invoice', async () => {
      if (!paymentInvoiceId) {
        console.log('No payment invoice, skipping...');
        return;
      }

      await request(API_URL).delete(`/api/invoices/${paymentInvoiceId}`);
    });
  });

  describe('Expected Invoice Workflow', () => {
    let recurringInvoiceId;
    let expectedInvoiceId;

    test('Step 1: Upload recurring invoice', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      if (response.body.invoices && response.body.invoices.length > 0) {
        const invoice = response.body.invoices[0];
        recurringInvoiceId = invoice.id;

        // Verify it has a frequency (not adhoc)
        expect(invoice.frequency).toBeDefined();
      }
    });

    test('Step 2: Check for expected invoices', async () => {
      const response = await request(API_URL).get('/api/expected-invoices');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        expectedInvoiceId = response.body[0].id;
      }
    });

    test('Step 3: Acknowledge expected invoice', async () => {
      if (!expectedInvoiceId) {
        console.log('No expected invoice, skipping...');
        return;
      }

      const response = await request(API_URL)
        .put(`/api/expected-invoices/${expectedInvoiceId}`)
        .send({ acknowledged: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Step 4: Verify acknowledgment', async () => {
      if (!expectedInvoiceId) {
        console.log('No expected invoice, skipping...');
        return;
      }

      const response = await request(API_URL).get('/api/expected-invoices');
      const expected = response.body.find(e => e.id === expectedInvoiceId);

      if (expected) {
        expect(expected.acknowledged).toBe(1);
      }
    });

    test('Step 5: Clean up recurring invoice', async () => {
      if (!recurringInvoiceId) {
        console.log('No recurring invoice, skipping...');
        return;
      }

      await request(API_URL).delete(`/api/invoices/${recurringInvoiceId}`);
    });
  });

  describe('Query and Filtering Workflow', () => {
    let testInvoices = [];

    test('Step 1: Upload multiple test invoices', async () => {
      if (!fs.existsSync(testPdfPath)) {
        console.log('Test PDF not found, skipping...');
        return;
      }

      const response = await request(API_URL)
        .post('/api/upload-pdfs')
        .attach('pdfs', testPdfPath);

      if (response.body.invoices) {
        testInvoices = response.body.invoices;
      }
    });

    test('Step 2: Query for all invoices', async () => {
      const response = await request(API_URL)
        .post('/api/query')
        .send({ query: 'show all invoices' });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
      expect(response.body.invoices.length).toBeGreaterThanOrEqual(0);
    });

    test('Step 3: Query for total amount', async () => {
      const response = await request(API_URL)
        .post('/api/query')
        .send({ query: 'what is the total?' });

      expect(response.status).toBe(200);
      if (response.body.type === 'total') {
        expect(response.body.value).toBeDefined();
        expect(typeof response.body.value).toBe('number');
      }
    });

    test('Step 4: Query for pending invoices', async () => {
      const response = await request(API_URL)
        .post('/api/query')
        .send({ query: 'show pending invoices' });

      expect(response.status).toBe(200);
      expect(response.body.invoices).toBeDefined();
    });

    test('Step 5: Clean up test invoices', async () => {
      for (const invoice of testInvoices) {
        await request(API_URL).delete(`/api/invoices/${invoice.id}`);
      }
    });
  });

  describe('Error Recovery Workflow', () => {
    test('Step 1: Attempt invalid operation', async () => {
      const response = await request(API_URL)
        .put('/api/invoices/non-existent-id')
        .send({ status: 'Paid' });

      expect(response.status).toBe(200);
      expect(response.body.changes).toBe(0);
    });

    test('Step 2: Verify system still responsive', async () => {
      const response = await request(API_URL).get('/api/invoices');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Step 3: Attempt to delete non-existent invoice', async () => {
      const response = await request(API_URL)
        .delete('/api/invoices/does-not-exist');

      expect(response.status).toBe(200);
    });

    test('Step 4: Verify system still healthy', async () => {
      const response = await request(API_URL).get('/api/exchange-rates');

      expect(response.status).toBe(200);
      expect(response.body.USD).toBe(1);
    });
  });
});
