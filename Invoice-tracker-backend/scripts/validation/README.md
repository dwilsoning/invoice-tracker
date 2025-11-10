# PDF Parsing Validation

This script provides **independent third-party validation** of PDF parsing by using different extraction logic than the server, then comparing results against the database.

## Third-Party Validation Approach

Unlike tests that replicate the server's logic (which would just confirm what the server already does), this validation script uses **alternative parsing strategies** to provide an independent "second opinion":

- **Same date format rules** - Uses currency-based format (USD=MM/DD/YYYY, others=DD/MM/YYYY) to match server, but with different extraction patterns
- **Different pattern matching** - Uses alternative regex patterns and different search order for extraction
- **Different classification priority** - Checks invoice type keywords in a different order than the server

This approach means:
- ✅ **When both agree** → High confidence the data is correct
- ⚠️ **When they disagree** → Requires manual review to determine which is right
- 📊 **Provides true quality assurance** - catches potential bugs in server parsing logic

## What It Does

1. **Parses actual PDFs** from the `invoice_pdfs` directory using independent extraction logic
2. **Extracts key data**:
   - Invoice number
   - Invoice date
   - Amount due
   - Currency
   - Invoice type (PS, MS, Maint, etc.)
   - Services description

3. **Compares against database** to find mismatches
4. **Reports accuracy** showing:
   - ✅ Matched invoices (both methods agree)
   - ⚠️ Mismatched fields (methods disagree - needs manual review)
   - ❓ Not in database
   - ❌ Parsing errors

## How to Run

**Note:** Database must be running for this validation to work.

### Basic Usage (Default: First 20 PDFs)

```bash
node scripts/validation/validate-pdf-parsing.js
```

Or double-click: `scripts/validation/validate-pdfs.bat`

### Validate Random Sample

```bash
# Random 20 PDFs (default)
node scripts/validation/validate-pdf-parsing.js --random

# Random 50 PDFs
node scripts/validation/validate-pdf-parsing.js --random=50

# Random 100 PDFs
node scripts/validation/validate-pdf-parsing.js --random=100
```

### Validate All Invoices

```bash
# Validates entire database (all PDFs)
node scripts/validation/validate-pdf-parsing.js --all
```

**Warning:** `--all` may take several minutes with 1,900+ PDFs.

### Custom Sample Size

```bash
# Validate first 50 PDFs
node scripts/validation/validate-pdf-parsing.js --sample=50
```

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
There's a difference between the validation script's extraction and the database. This means the two independent parsing methods disagree. Possible reasons:
- **Database is correct** - The server's more comprehensive parsing captured the right data
- **Validation is correct** - The validation script's alternative approach found an issue with server parsing
- **Both are wrong** - Edge case that neither method handles perfectly
- **Ambiguous data** - PDF has unclear formatting that can be interpreted multiple ways

**Important:** This validation uses **independent extraction logic** from the server. When there's a mismatch, **manually check the actual PDF** to determine which method extracted the correct data.

The script will show exactly which fields don't match, helping you identify patterns in parsing issues.

### ❓ Not in Database
The invoice was found in the PDF file but not in the database. Possible reasons:
- PDF hasn't been uploaded to the system yet
- Invoice was deleted from database
- Parsing extracted wrong invoice number

### ❌ Errors
Could not parse the PDF or extract the invoice number. Indicates parsing logic needs work for this PDF format.

## Validation Strategies

### Quick Check (Default)
Validates first 20 PDFs - fast quality check

### Random Sampling
Validates random PDFs across the entire dataset - catches issues in different time periods and clients

### Complete Validation
Validates all PDFs - comprehensive quality assurance (takes several minutes)

### Custom Sample
Specify any sample size for targeted testing

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
