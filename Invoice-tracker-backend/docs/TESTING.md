# Invoice Tracker - Testing Documentation

## Overview

This test suite provides comprehensive testing for the Invoice Tracker application, including:
- API endpoint tests
- PDF parsing unit tests
- Integration tests for complete workflows
- Performance tests
- Data integrity validation

## Test Structure

```
tests/
├── api.test.js              # Comprehensive API endpoint tests
├── unit/
│   └── pdf-parsing.test.js  # Unit tests for PDF parsing and utilities
├── integration/
│   └── workflow.test.js     # Integration tests for complete workflows
├── test-data/
│   ├── sample-invoice-quarterly.pdf  # Sample quarterly invoice
│   ├── sample-invoice-monthly.pdf    # Sample monthly invoice
│   ├── sample-credit-memo.pdf        # Sample credit memo
│   └── sample-payments.xlsx          # Sample payment spreadsheet
└── setup.js                 # Global test setup and configuration
```

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

This installs all required dependencies including:
- Jest (test framework)
- Supertest (HTTP assertion library)
- All application dependencies

### 2. Start the Server

**IMPORTANT:** Most tests require the server to be running on port 3001.

```bash
npm start
```

Keep the server running in a separate terminal window while running tests.

## Running Tests

### Quick Start (Windows)

Double-click any of the batch files:
- **run-tests.bat** - Run all tests
- **run-api-tests.bat** - Run API tests only
- **run-unit-tests.bat** - Run unit tests only
- **run-integration-tests.bat** - Run integration tests only
- **run-tests-with-coverage.bat** - Run tests with coverage report

### Command Line

#### Run All Tests
```bash
npm test
```

#### Run Specific Test Suites
```bash
# API tests only
npm run test:api

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

#### Run Tests with Coverage
```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` folder.
Open `coverage/lcov-report/index.html` in your browser to view the detailed report.

#### Watch Mode (for development)
```bash
npm run test:watch
```

This will re-run tests automatically when files change.

## Test Categories

### 1. API Endpoint Tests (`tests/api.test.js`)

Tests all REST API endpoints:

**Invoice Endpoints:**
- GET `/api/invoices` - Fetch all invoices
- POST `/api/upload-pdfs` - Upload PDF invoices
- PUT `/api/invoices/:id` - Update invoice
- DELETE `/api/invoices/:id` - Delete invoice

**Expected Invoice Endpoints:**
- GET `/api/expected-invoices`
- PUT `/api/expected-invoices/:id`
- DELETE `/api/expected-invoices/:id`

**Contract Endpoints:**
- GET `/api/contracts`
- POST `/api/contracts`
- PUT `/api/contracts/:contractName`
- DELETE `/api/contracts/:contractName`

**Other Endpoints:**
- GET `/api/exchange-rates`
- POST `/api/query` - Natural language queries
- POST `/api/upload-payments` - Payment spreadsheet upload
- GET/DELETE `/api/invoices/duplicates/:invoiceNumber`

**Test Coverage:**
- ✅ Basic functionality
- ✅ Data validation
- ✅ Error handling
- ✅ Edge cases
- ✅ Performance benchmarks
- ✅ Data integrity

### 2. Unit Tests (`tests/unit/pdf-parsing.test.js`)

Tests individual functions and utilities:

**PDF Text Extraction:**
- PDF reading and parsing
- Keyword detection

**Date Parsing:**
- DD-MMM-YYYY format
- DD-MMMM-YYYY format
- 2-digit year handling
- Invalid date handling

**Frequency Detection:**
- Monthly, quarterly, annual
- Bi-annual, tri-annual
- Ad-hoc (default)

**Invoice Type Classification:**
- Professional Services (PS)
- Maintenance (Maint)
- Subscription (Sub)
- Hosting
- Managed Services (MS)
- Hardware (HW)
- Third Party (3PP)
- Credit Memos

**Utility Functions:**
- Currency extraction
- Amount extraction
- Invoice number extraction
- Date formatting
- Currency conversion

### 3. Integration Tests (`tests/integration/workflow.test.js`)

Tests complete end-to-end workflows:

**Complete Invoice Lifecycle:**
1. Upload invoice PDF
2. Verify invoice in list
3. Update status to Paid
4. Query for paid invoices
5. Delete invoice

**Duplicate Handling:**
1. Upload invoice
2. Upload duplicate
3. Detect duplicates
4. Clean up

**Contract Management:**
1. Create contract
2. Update contract
3. Link to invoices
4. Delete contract

**Payment Processing:**
1. Upload invoices
2. Process payments via Excel
3. Verify status updates

**Expected Invoice Workflow:**
1. Upload recurring invoice
2. Check expected invoices
3. Acknowledge expected invoice
4. Verify acknowledgment

**Query and Filtering:**
1. Upload test data
2. Query by status
3. Query by type
4. Calculate totals
5. Clean up

**Error Recovery:**
1. Test invalid operations
2. Verify system stability
3. Test error handling

## Test Data

Sample test files are located in `tests/test-data/`:

- **sample-invoice-quarterly.pdf** - Invoice 4600012956 (Quarterly, Maintenance)
- **sample-invoice-monthly.pdf** - Invoice 4600026853 (Monthly)
- **sample-credit-memo.pdf** - Invoice 4000006001 (Credit Memo, negative amount)
- **sample-payments.xlsx** - Sample payment spreadsheet

These files are automatically used by the test suite.

## Understanding Test Results

### Successful Test Run
```
PASS tests/api.test.js
PASS tests/unit/pdf-parsing.test.js
PASS tests/integration/workflow.test.js

Test Suites: 3 passed, 3 total
Tests:       120 passed, 120 total
Snapshots:   0 total
Time:        45.2s
```

### Failed Test
```
FAIL tests/api.test.js
  ● Invoice Endpoints › POST /api/upload-pdfs › Should upload PDF

    expect(received).toBe(expected)

    Expected: 200
    Received: 500

      72 |         .attach('pdfs', testPdfPath);
      73 |
    > 74 |     expect(response.status).toBe(200);
```

## Troubleshooting

### "Server should be running and accessible" fails

**Problem:** Server not running or running on wrong port.

**Solution:**
1. Start the server: `npm start`
2. Verify it's running on port 3001
3. Check console for errors

### "Test PDF not found, skipping..."

**Problem:** Test data files missing.

**Solution:**
1. Check `tests/test-data/` folder exists
2. Verify PDF files are present
3. Re-run the batch file that creates test data if needed

### Tests timeout

**Problem:** Server too slow or database locked.

**Solution:**
1. Increase timeout in `jest.config.js`
2. Check database isn't locked by another process
3. Restart the server

### "ECONNREFUSED" errors

**Problem:** Cannot connect to server.

**Solution:**
1. Ensure server is running: `npm start`
2. Check no firewall blocking port 3001
3. Verify correct API_URL in test files

## Best Practices

### Before Running Tests

1. **Backup your database** if you have important data
2. **Start with a clean database** for consistent results
3. **Ensure server is running** on port 3001
4. **Check test data files** are present

### Writing New Tests

1. **Follow the existing structure** - Keep tests organized by category
2. **Use descriptive test names** - Clearly state what's being tested
3. **Include setup and teardown** - Clean up test data after tests
4. **Test happy path and edge cases** - Don't just test success scenarios
5. **Use meaningful assertions** - Make it clear what should happen

### Example Test Structure

```javascript
describe('Feature Name', () => {
  let testData;

  beforeEach(() => {
    // Setup before each test
    testData = createTestData();
  });

  afterEach(() => {
    // Cleanup after each test
    cleanupTestData(testData);
  });

  test('Should perform expected action', async () => {
    // Arrange
    const input = prepareInput();

    // Act
    const result = await performAction(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

## Continuous Integration

The test suite is designed to work with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm start & # Start server in background
      - run: npm test
```

## Coverage Goals

Target coverage metrics:
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

Run `npm run test:coverage` to see current coverage.

## Additional Testing

### Manual Testing Checklist

Beyond automated tests, perform these manual checks:

- [ ] Upload PDFs from `C:\Users\dwils\Altera Digital Health\...`
- [ ] Verify UI correctly displays all invoice types
- [ ] Test drag-and-drop file upload
- [ ] Check natural language queries with various inputs
- [ ] Verify PDF viewer opens correctly
- [ ] Test duplicate handling with real invoices
- [ ] Check expected invoice notifications
- [ ] Test contract value calculations
- [ ] Verify export functionality
- [ ] Test with different browsers (Chrome, Firefox, Edge)

### Performance Testing

Monitor these metrics:
- Invoice list load time < 1 second
- PDF upload processing < 5 seconds per invoice
- Query response time < 2 seconds
- Database operations < 100ms

### Load Testing

For production readiness:
1. Upload 100+ invoices
2. Test concurrent users
3. Monitor memory usage
4. Check database performance

## Getting Help

If tests fail or you encounter issues:

1. Check the console output for specific error messages
2. Review this documentation
3. Check the test file for comments and examples
4. Verify server logs for errors
5. Ensure database is not corrupted

## Summary

The Invoice Tracker test suite provides:
- **120+ automated tests** covering all functionality
- **3 test categories** (API, Unit, Integration)
- **Easy-to-use batch files** for Windows
- **Comprehensive coverage** of edge cases and errors
- **Performance benchmarks** to ensure speed
- **Data integrity validation** to prevent bugs

Run tests regularly during development to catch issues early!
