# Migration Script - Complete Data Coverage

## Overview
The migration script (`scripts/migrate-to-aws.js`) performs a **complete full-system migration** of all Invoice Tracker data from your local system to AWS EC2 (or any other target system).

---

## What Gets Migrated

### ✅ 1. Complete Database Export
The script uses `pg_dump` which exports **EVERYTHING** from your PostgreSQL database:

#### All Database Tables:
1. **invoices** - All invoice records
2. **expected_invoices** - All expected invoice records
3. **contracts** - All contract records
4. **users** - All user accounts

#### Invoice Table (invoices) - Complete Record:
- ✅ Invoice ID
- ✅ Invoice number
- ✅ Invoice date
- ✅ Client name
- ✅ Customer contract
- ✅ Oracle contract
- ✅ PO number
- ✅ Invoice type (Maint, PS, HW, etc.)
- ✅ Amount due
- ✅ Currency
- ✅ Due date
- ✅ **Status (Pending/Paid)** ← Your paid vs unpaid information
- ✅ **Payment date** ← When invoice was marked as paid
- ✅ Frequency (monthly, quarterly, annual, adhoc)
- ✅ Upload date
- ✅ Services description
- ✅ PDF path
- ✅ PDF original filename
- ✅ Contract value
- ✅ Contract currency
- ✅ Notes
- ✅ Created timestamp
- ✅ Updated timestamp

#### Expected Invoices Table (expected_invoices):
- ✅ Expected invoice ID
- ✅ Client
- ✅ Customer contract
- ✅ Invoice type
- ✅ Expected amount
- ✅ Currency
- ✅ Expected date
- ✅ Frequency
- ✅ Last invoice number
- ✅ Last invoice date
- ✅ **Acknowledged status** ← Whether you've acknowledged the expected invoice
- ✅ **Acknowledged date** ← When you acknowledged it
- ✅ **Dismissed status** ← Whether you've dismissed this expected invoice
- ✅ **Dismissed date** ← When you dismissed it
- ✅ Created date
- ✅ Created timestamp
- ✅ Updated timestamp

#### Contracts Table (contracts):
- ✅ Contract ID
- ✅ Contract name
- ✅ Contract value
- ✅ Currency
- ✅ Created date
- ✅ Updated date
- ✅ Created timestamp
- ✅ Updated timestamp

#### Users Table (users):
- ✅ User ID
- ✅ Email
- ✅ Password hash (securely hashed)
- ✅ First name
- ✅ Last name
- ✅ Role (admin/user)
- ✅ Active status
- ✅ Last login timestamp
- ✅ Created timestamp
- ✅ Updated timestamp

### ✅ 2. All Database Schema & Structure
- ✅ All table definitions
- ✅ All indexes (for fast lookups)
- ✅ All triggers (auto-update timestamps)
- ✅ All functions (database functions)
- ✅ All constraints (data integrity rules)

### ✅ 3. All Invoice PDF Files
**Location:** `invoice_pdfs/` directory
- ✅ Every single PDF invoice that was uploaded
- ✅ Maintains original directory structure
- ✅ Preserves original filenames
- ✅ Includes deleted PDFs folder (if exists)

### ✅ 4. All Uploaded Files
**Location:** `uploads/` directory
- ✅ Payment spreadsheets uploaded
- ✅ Any contract documents
- ✅ Any other files uploaded through the system

### ✅ 5. Migration Metadata
- ✅ Export date and time
- ✅ Source database information
- ✅ File counts
- ✅ System information (Node version, platform)

---

## What the Migration Script Does

### Export Process (Local Machine):
```bash
node scripts/migrate-to-aws.js --export
```

**Steps:**
1. **Database Export** - Uses `pg_dump` to create complete database dump
   - Includes `--clean` flag (removes existing data on import)
   - Includes `--if-exists` flag (safe imports)
   - Exports ALL tables, data, schema, triggers, functions

2. **Compress Database** - Compresses SQL dump with gzip
   - Reduces file size by 80-90%

3. **Copy Invoice PDFs** - Recursively copies entire `invoice_pdfs/` directory
   - Preserves directory structure
   - Copies all subdirectories

4. **Copy Uploads** - Recursively copies entire `uploads/` directory
   - All payment spreadsheets
   - All uploaded documents

5. **Create Metadata** - Records migration information
   - When exported
   - What was exported
   - How many files

6. **Create Archive** - Packages everything into compressed tarball
   - Format: `invoice-tracker-data-[timestamp].tar.gz`
   - Contains: database dump + PDFs + uploads + metadata

**Output:** Single `.tar.gz` file containing EVERYTHING

### Import Process (AWS EC2):
```bash
node scripts/migrate-to-aws.js --import --file invoice-tracker-data-*.tar.gz
```

**Steps:**
1. **Extract Archive** - Unpacks the tarball
2. **Import Database** - Uses `psql` to restore complete database
   - Recreates all tables
   - Inserts all data
   - Recreates all indexes, triggers, functions
3. **Copy PDFs** - Restores all invoice PDFs to correct location
4. **Copy Uploads** - Restores all uploaded files to correct location
5. **Verify Import** - Checks database and file counts
6. **Cleanup** - Removes temporary files

---

## Specific Answers to Your Questions

### ✅ Invoices?
**YES** - Every single invoice record is migrated including:
- All invoice details
- Invoice date
- Client information
- Amounts
- Currencies
- Contract information

### ✅ PDFs?
**YES** - Every single PDF file is migrated:
- All invoice PDFs from `invoice_pdfs/` folder
- Maintains exact folder structure
- Preserves original filenames

### ✅ Acknowledgements Made?
**YES** - All acknowledgement data is migrated:
- `acknowledged` column (true/false)
- `acknowledged_date` column (when acknowledged)
- Applied to expected_invoices table

### ✅ Dismissed Expected Invoices?
**YES** - All dismissal data is migrated:
- `dismissed` column (true/false)
- `dismissed_date` column (when dismissed)
- Applied to expected_invoices table

### ✅ End Users?
**YES** - All user accounts are migrated:
- User email addresses
- Password hashes (secure, not plain text)
- First and last names
- Admin/user roles
- Active/inactive status
- Last login timestamps

### ✅ Paid vs Unpaid Information?
**YES** - All payment status is migrated:
- `status` column ('Pending' or 'Paid')
- `payment_date` column (when marked as paid)
- Complete payment history preserved

### ✅ Any Other Information Changed During Usage?
**YES** - EVERYTHING is migrated including:
- All notes added to invoices
- All timestamps (created_at, updated_at)
- Contract values entered
- Expected invoice dates
- Frequency settings
- All custom fields
- Any data modifications made through the tracker

---

## Data Integrity Guarantees

### The migration uses `pg_dump` which is PostgreSQL's official backup tool:
- ✅ **Atomic** - Either all data migrates or none (no partial migrations)
- ✅ **Consistent** - Maintains all relationships between tables
- ✅ **Complete** - Gets 100% of database content
- ✅ **Schema-preserving** - Exact same structure on target
- ✅ **Type-safe** - All data types preserved exactly

### File Migration:
- ✅ **Recursive** - Gets all files in all subdirectories
- ✅ **Preserves structure** - Exact same folder layout
- ✅ **Binary-safe** - PDFs copied byte-for-byte
- ✅ **Verified** - Counts files before and after

---

## What Is NOT Migrated

The following are **system-specific** and should be set up fresh on AWS:
- ❌ `.env` file (database passwords, JWT secrets)
- ❌ `node_modules/` (reinstalled via npm install)
- ❌ System configurations (PM2, Nginx)
- ❌ SSL certificates (generated fresh with Let's Encrypt)
- ❌ Backups folder (create new backups on AWS)

**These are NOT migrated because:**
- Database credentials will be different on AWS
- JWT secrets should be unique per environment
- Node modules are platform-specific
- System configs are environment-specific

---

## Verification After Migration

The import script automatically verifies:
1. **Database** - Counts invoices in database
2. **PDFs** - Counts PDF files migrated
3. **Uploads** - Counts uploaded files migrated

### Manual Verification Checklist:
After migration, you should verify:
- [ ] Can log in with existing user accounts
- [ ] All invoices visible in dashboard
- [ ] Correct count of paid vs unpaid invoices
- [ ] Can open and view invoice PDFs
- [ ] Expected invoices show correct acknowledgement status
- [ ] Dismissed expected invoices stay dismissed
- [ ] Contract values are correct
- [ ] User roles work correctly (admin vs regular user)
- [ ] All client names and amounts are accurate

---

## Migration Size Estimates

Typical migration package size (compressed):
- **Database**: 1-10 MB (depending on number of invoices)
- **PDFs**: 100 MB - 10 GB (depending on number and size of PDFs)
- **Uploads**: 10 MB - 1 GB (depending on spreadsheets uploaded)
- **Total**: Usually 100 MB - 15 GB

Transfer time estimates:
- **100 MB**: 5-10 minutes
- **1 GB**: 30-60 minutes
- **10 GB**: Several hours

---

## Safety & Rollback

### The migration is safe:
- ✅ Non-destructive export (doesn't modify local data)
- ✅ Local data remains untouched after export
- ✅ Import is separate step (can test before committing)
- ✅ Old backups remain in `backups/` folder on local machine

### Rollback capability:
- You can keep the `.tar.gz` export file as a backup
- Can re-import to AWS if something goes wrong
- Can import back to local machine if needed
- Old local database remains intact until you delete it

---

## Summary

**YES**, the migration script migrates **EVERYTHING**:

✅ **100% of database** - All tables, all rows, all columns
✅ **100% of invoice PDFs** - Every single PDF file
✅ **100% of uploaded files** - All payment spreadsheets, documents
✅ **100% of user data** - All user accounts and passwords
✅ **100% of acknowledgements** - All acknowledged/dismissed statuses
✅ **100% of payment information** - All paid/unpaid statuses and dates
✅ **100% of modifications** - Everything entered or changed in the tracker

**The migration is complete, comprehensive, and preserves all your data exactly as it exists on your local system.**
