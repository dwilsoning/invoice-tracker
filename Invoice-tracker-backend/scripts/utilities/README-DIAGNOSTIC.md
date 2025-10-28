# PDF Validation Diagnostic Tool

## Overview
This tool validates that the data stored in the database matches what's actually in the PDF files. It parses each PDF using the same logic as the invoice upload process and compares the extracted data with the database.

## What It Checks
- **Invoice Number**: Matches PDF vs Database
- **Client Name**: Matches PDF vs Database
- **Amount Due**: Matches PDF vs Database (with 0.01 tolerance)
- **Currency**: Matches PDF vs Database
- **Customer Contract**: Matches PDF vs Database
- **PO Number**: Matches PDF vs Database
- **Invoice Type**: Validates classification (Maint, SW, PS, etc.) based on services description
- **Frequency**: Validates classification (monthly, quarterly, annual, etc.) based on services description

## Usage

### Windows (Easy Method)
Double-click the desktop shortcut:
```
DIAGNOSTIC-PDF-VALIDATION.bat
```

Or from command line:
```batch
# Check specific invoice
DIAGNOSTIC-PDF-VALIDATION.bat --invoice 4600032089

# Check first 50 invoices
DIAGNOSTIC-PDF-VALIDATION.bat --limit 50

# Check ALL invoices
DIAGNOSTIC-PDF-VALIDATION.bat --all
```

### Command Line (Advanced)
From the backend directory:

```bash
# Check first 10 invoices (default)
node scripts/utilities/diagnostic-pdf-validation.js

# Check specific invoice
node scripts/utilities/diagnostic-pdf-validation.js --invoice 4600032089

# Check first 50 invoices
node scripts/utilities/diagnostic-pdf-validation.js --limit 50

# Check ALL invoices
node scripts/utilities/diagnostic-pdf-validation.js --all
```

## Report Output

The tool generates a detailed report showing:

1. **Summary Statistics**
   - Total invoices checked
   - Number of PDFs not found
   - Number of invoices with issues

2. **Detailed Issues List**
   - Invoice number
   - Client name
   - Specific fields that don't match
   - Expected vs actual values

3. **Issue Type Summary**
   - Counts by field (e.g., "Amount Due: 5 invoices", "Frequency: 12 invoices")

## Example Output

```
=====================================
PDF Validation Diagnostic Tool
=====================================

Checking up to 10 invoices...

Checking invoice 4600032089...
  ✅ All fields match

Checking invoice 4000005400...
  ❌ Frequency: Expected: annual, DB: adhoc

=====================================
Diagnostic Report
=====================================

Total invoices checked: 10
PDFs not found: 0
Invoices with issues: 1

=====================================
Issues Found
=====================================

1. Invoice: 4000005400
   Client: Department of Health - Victoria
   ❌ Frequency: Expected: annual, DB: adhoc

=====================================
Summary by Issue Type
=====================================

  Frequency: 1 invoice(s)
```

## Common Issues Found

### Frequency Misclassification
- **Cause**: Invoice description contains frequency keyword (monthly, annual, etc.) but database shows different frequency
- **Fix**: Run `apply-validation-fixes.js` to auto-correct based on services description

### Type Misclassification
- **Cause**: Support/maintenance invoices classified as SW due to "software" keyword
- **Fix**: Run `apply-validation-fixes.js` to auto-correct based on services description

### Amount Mismatch
- **Cause**: PDF parsing extracted wrong amount or credit memo not detected
- **Fix**: Manual review required - check PDF and update database

### Client Name Mismatch
- **Cause**: PDF has variation of client name (e.g., "Singapore Health Services" vs "Singapore General Health Services")
- **Fix**: Use `fix-singapore-client-names.js` or similar to standardize

## Automated Fixes

After running the diagnostic, you can apply automated fixes for frequency and type issues:

```bash
node scripts/utilities/apply-validation-fixes.js
```

This will auto-correct:
- Frequency classifications based on keywords in services description
- Invoice type classifications based on keywords in services description

## Notes

- The tool only checks invoices that have PDF paths in the database
- PDFs must exist on disk at the specified path
- Comparison uses fuzzy matching for strings (partial matches accepted)
- Amount comparisons allow 0.01 difference (rounding tolerance)
- Run this tool after:
  - Bulk invoice uploads
  - Database migrations
  - Manual data corrections
  - Suspected parsing issues

## Maintenance

The diagnostic tool uses the same classification logic as the server:
- `classifyInvoiceType()` - Located in server-postgres.js:215-288
- `detectFrequency()` - Located in server-postgres.js:290-336

If you update classification rules in the server, also update them in:
- `diagnostic-pdf-validation.js`
- `apply-validation-fixes.js`
- `validate-all-invoices.js`
