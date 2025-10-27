# Invoice Tracker Testing - Quick Start Guide

## Setup (One-Time)

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Dependencies are already installed:
   - ✅ Jest
   - ✅ Supertest
   - ✅ Test data files created

## Running Tests - Quick Reference

### Windows Users (Easiest)

Just double-click these files:

| File | What It Does |
|------|--------------|
| `run-tests.bat` | Run ALL tests |
| `run-api-tests.bat` | API endpoint tests only |
| `run-unit-tests.bat` | Unit tests only (PDF parsing, utilities) |
| `run-integration-tests.bat` | Integration tests only (workflows) |
| `run-tests-with-coverage.bat` | Tests + Coverage report |
| `test-pdfs.bat` | Test PDF parsing on real invoices |

### Command Line

```bash
# Run all tests
npm test

# Run specific test types
npm run test:api
npm run test:unit
npm run test:integration

# Run with coverage report
npm run test:coverage
```

## IMPORTANT: Before Running Tests

⚠️ **START THE SERVER FIRST!**

```bash
npm start
```

The server must be running on port 3001 for API and integration tests.

## What Gets Tested

### ✅ All API Endpoints (60+ tests)
- Invoice CRUD operations
- PDF upload and parsing
- Payment processing
- Contract management
- Expected invoices
- Natural language queries
- Exchange rates
- Duplicate handling

### ✅ PDF Parsing (30+ tests)
- Date extraction and formatting
- Invoice number detection
- Frequency detection (monthly, quarterly, annual, etc.)
- Invoice type classification
- Amount extraction (positive and negative)
- Currency detection
- Client name extraction

### ✅ Complete Workflows (30+ tests)
- Upload → Update → Pay → Delete
- Duplicate detection and resolution
- Contract creation and management
- Payment processing via Excel
- Expected invoice generation
- Query and filtering
- Error recovery

## Test Data

Sample files in `tests/test-data/`:
- `sample-invoice-quarterly.pdf` - Quarterly maintenance invoice
- `sample-invoice-monthly.pdf` - Monthly invoice
- `sample-credit-memo.pdf` - Credit memo (negative amount)
- `sample-payments.xlsx` - Payment spreadsheet

## Understanding Results

### ✅ All Tests Pass
```
Test Suites: 3 passed, 3 total
Tests:       120 passed, 120 total
```
**You're good to go!**

### ❌ Some Tests Fail
```
Test Suites: 1 failed, 2 passed, 3 total
Tests:       5 failed, 115 passed, 120 total
```
**Check the error messages and see troubleshooting below.**

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Server should be running" fails | Start server: `npm start` |
| "Test PDF not found" | Files should be in `tests/test-data/` |
| Tests timeout | Server might be slow, check console for errors |
| "ECONNREFUSED" | Server not running on port 3001 |

## Coverage Report

After running `run-tests-with-coverage.bat`:

1. Open `coverage/lcov-report/index.html` in your browser
2. See line-by-line coverage of your code
3. Identify untested code paths

Target: **80% coverage** or higher

## Quick Test During Development

```bash
npm run test:watch
```

This watches for file changes and re-runs tests automatically.

## What's Tested vs. What Needs Manual Testing

### ✅ Automated (120+ tests)
- All API endpoints
- PDF parsing logic
- Data validation
- Error handling
- Workflows
- Performance

### 🔧 Manual Testing Still Needed
- UI appearance
- Drag-and-drop UX
- PDF viewer
- Different browsers
- Real-world invoices
- Accessibility

## Example Test Workflow

1. **Make code changes**
2. **Run unit tests** - `run-unit-tests.bat`
3. **If pass, run API tests** - `run-api-tests.bat`
4. **If pass, run integration tests** - `run-integration-tests.bat`
5. **Generate coverage report** - `run-tests-with-coverage.bat`
6. **Fix any issues and repeat**

## Common Test Scenarios

### Testing a New PDF Format

1. Add PDF to `tests/test-data/`
2. Run: `node test-parse-pdfs.js`
3. Verify extracted data is correct
4. If incorrect, update parsing logic in `server.js`
5. Re-run tests

### Testing a New API Endpoint

1. Add test to `tests/api.test.js`
2. Run: `npm run test:api`
3. Implement endpoint in `server.js`
4. Re-run until test passes

### Testing a Complete Feature

1. Add integration test to `tests/integration/workflow.test.js`
2. Run: `npm run test:integration`
3. Implement feature
4. Run all tests: `npm test`

## Performance Benchmarks

Tests verify these performance targets:

| Operation | Target | Test |
|-----------|--------|------|
| GET /api/invoices | < 1 second | ✅ Automated |
| PDF upload | < 5 seconds | ✅ Automated |
| Query endpoint | < 2 seconds | ✅ Automated |
| Contract operations | < 500ms | ✅ Automated |

## Need Help?

1. Read full documentation: `TESTING.md`
2. Check test files for examples
3. Review console output for specific errors
4. Verify server is running properly

## Summary

- **120+ automated tests** ensure quality
- **Easy batch files** for quick testing
- **3 test categories** cover everything
- **Run before committing** code changes
- **Coverage reports** show what's tested
- **Fast feedback** during development

**Happy Testing! 🚀**
