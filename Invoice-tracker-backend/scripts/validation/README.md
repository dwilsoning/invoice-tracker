# PDF Parsing Validation

This script validates that PDF parsing is working correctly by comparing what's extracted from actual PDFs against what's stored in the database.

## What It Does

1. **Parses actual PDFs** from the `invoice_pdfs` directory
2. **Extracts key data**:
   - Invoice number
   - Invoice date
   - Amount due
   - Currency
   - Invoice type (PS, MS, Maint, etc.)
   - Services description

3. **Compares against database** to find mismatches
4. **Reports accuracy** showing:
   - ✅ Matched invoices
   - ⚠️ Mismatched fields
   - ❓ Not in database
   - ❌ Parsing errors

## How to Run

```bash
node scripts/validation/validate-pdf-parsing.js
```

**Note:** Database must be running for this validation to work.

## Output

The script will:
1. Show console output with validation results
2. Generate `pdf-validation-report.json` with detailed findings

### Sample Output

```
==================================================
PDF PARSING VALIDATION
==================================================

Found 1916 PDF files

Validating 20 PDFs...

==================================================
VALIDATION RESULTS
==================================================

Total PDFs Tested:     20
✅ Matched:             18
⚠️  Mismatched:          1
❓ Not in Database:     1
❌ Errors:              0

Accuracy: 90.0%
```

## What Gets Validated

| Field | Comparison |
|-------|-----------|
| Invoice Number | Exact match |
| Invoice Date | Date comparison (ignores time) |
| Amount Due | Tolerance of $0.01 |
| Currency | Exact match |
| Invoice Type | Exact match (PS, MS, Maint, etc.) |

## Interpreting Results

### ✅ Matched
PDF parsing extracted data that perfectly matches the database. This is good!

### ⚠️ Mismatched
There's a difference between the PDF and database. Possible reasons:
- **Validation script's simplified parsing** - The validation uses a simplified extraction that may not capture all edge cases
- **Database is correct** - Manual corrections or better parsing in the main app
- **Database needs fixing** - PDF data is more accurate
- Edge case in PDF format

**Important:** The validation script uses simplified extraction logic compared to the full server. When there's a mismatch, **check the actual PDF** to determine which is correct.

The script will show exactly which fields don't match.

### ❓ Not in Database
The invoice was found in the PDF file but not in the database. Possible reasons:
- PDF hasn't been uploaded to the system yet
- Invoice was deleted from database
- Parsing extracted wrong invoice number

### ❌ Errors
Could not parse the PDF or extract the invoice number. Indicates parsing logic needs work for this PDF format.

## Sample Size

By default, validates the first **20 PDFs**. This keeps validation fast while providing good coverage.

To test more PDFs, edit this line in the script:
```javascript
const sampleSize = Math.min(20, pdfFiles.length);  // Change 20 to desired number
```

## Use Cases

1. **After updating parsing logic** - Ensure changes didn't break existing parsing
2. **Quality assurance** - Verify database has accurate data
3. **Finding edge cases** - Identify PDFs that need special handling
4. **Regression testing** - Confirm parsing improvements don't break existing functionality

## Report File

The `pdf-validation-report.json` file contains:
- Detailed results for each PDF tested
- All mismatches with exact values
- Full error messages
- Timestamps and metadata

This file is useful for:
- Tracking parsing accuracy over time
- Debugging specific invoices
- Creating bug reports
