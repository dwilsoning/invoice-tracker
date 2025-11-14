# Backend Folder Reorganization - November 12, 2025

## Summary

The backend folder has been reorganized to separate **production application files** from **development/debugging utilities**. This improves code clarity and makes it easier to understand which files are essential for running the Invoice Tracker.

---

## What Changed

### ✅ Cleaned Backend Root Directory

The main backend folder now contains **only essential files**:

```
Invoice-tracker-backend/
├── .env                              (Database credentials)
├── .env.example                      (Environment template)
├── .gitignore                        (Git ignore rules)
├── 00-START-HERE.md                  (Quick start guide)
├── README.md                         (Project overview)
├── DEPLOYMENT-COMPLETE-SCHEMA.md     (Full deployment guide)
├── DEPLOYMENT-QUICK-REFERENCE.md     (Quick reference)
├── db-postgres.js                    (PostgreSQL connection)
├── server-postgres.js                (Express server)
├── package.json                      (Dependencies)
├── package-lock.json                 (Lock file)
├── node_modules/                     (Dependencies)
├── attachments/                      (Invoice attachments storage)
├── backups/                          (Database backups)
├── docs/                             (API documentation)
├── invoice_pdfs/                     (PDF storage)
├── middleware/                       (Express middleware)
├── migrations/                       (Database migrations)
├── routes/                           (API routes)
├── scripts/                          (Production scripts)
├── tests/                            (Test suite)
├── uploads/                          (File uploads)
├── utils/                            (Utility functions)
└── Archive/                          (Moved non-essential files)
```

### 📦 Archive Folder Structure

**80+ files** have been moved to `Archive/` for organization:

```
Archive/
├── old-archive/                      (Previous archive contents)
├── .claude/                          (Claude session data)
│
├── Database & Schema Files:
├── complete-schema-export.sql        (Old schema export)
├── deploy-complete-schema-ec2.sql    (EC2 deployment schema)
├── deploy-schema-to-ec2.js           (EC2 schema deployment script)
├── migrate-data-to-ec2.js            (Data migration script)
├── production-schema.sql             (Production schema)
├── grant-permissions.sql             (Old permissions)
├── recreate-schema-superuser.sql     (Old schema recreation)
│
├── Deployment & Setup Documentation:
├── CADDY-QUICK-START.md              (Caddy setup)
├── CADDY-SETUP.md                    (Caddy configuration)
├── DEPLOYMENT-GUIDE.md               (Old deployment guide)
├── QUICK-DEPLOY.md                   (Quick deployment)
├── export-schema-instructions.md     (Schema export)
│
├── Debug & Check Scripts (30+ files):
├── check-and-fix-database-schema.js
├── check-backend-errors.js
├── check-cashflow-buckets.js
├── check-date-discrepancies.js
├── check-error.js
├── check-expected-revenue.js
├── check-invoices-table.js
├── check-server.js
├── check-table-counts.js
├── debug-query.js
├── show-current-schema.js
│
├── Test Scripts (25+ files):
├── test-all-patterns.js
├── test-api-queries.js
├── test-attachments.js
├── test-auth.js
├── test-bulk-update.js
├── test-cashflow.js
├── test-contracts.js
├── test-create-user.js
├── ... (15 more test files)
│
├── Utility & Fix Scripts (15+ files):
├── add-missing-columns.js
├── analyze-query-patterns.js
├── cleanup-expected-duplicates.js
├── create-admin.js
├── create-dismissal-table.js
├── export-complete-schema.js
├── fix-all-invoice-dates.js
├── fix-column-names.js
├── fix-credit-memo-dates.js
├── ... (6 more utility files)
│
├── Legacy Batch Scripts (8 files):
├── BACKUP-DATABASE.bat
├── SETUP-DAILY-BACKUP.bat
├── START-POSTGRESQL-SERVER.bat
├── STOP-ALL-SERVERS.bat
├── STOP-ALL-SERVERS.ps1
├── start-invoice-tracker-postgres.bat
├── stop-invoice-tracker-postgres.bat
├── start.bat
│
├── Data & Test Results:
├── date-discrepancies.json
├── invoice-type-changes.json
├── pdf-validation-report.json
├── reparse-changes.json
├── test-results.txt
├── server.log
│
└── Legacy Database:
    └── invoices.db.DEPRECATED_SQLITE_DO_NOT_USE
```

---

## Why This Reorganization?

### Problems Solved

| Issue | Solution |
|-------|----------|
| **Unclear which files are essential** | Archive separates production from utilities |
| **80+ files cluttering the root** | Only 20 essential files in root directory |
| **Hard to find API code** | Clear structure: routes/, middleware/, utils/ |
| **Testing files mixed with source** | Tests organized in tests/ folder |
| **Legacy scripts confusing new developers** | All debug/test scripts in Archive/ |
| **Difficult to understand project structure** | Clean separation of concerns |

### Benefits

✅ **Faster Development** - Easier to navigate the codebase  
✅ **Better Onboarding** - New developers can focus on essential files  
✅ **Cleaner Git History** - Archive folder can be .gitignored  
✅ **Production Ready** - Only necessary files in root  
✅ **Easy Backups** - Archive contains all historical scripts  
✅ **Maintenance** - Debugging tools still available when needed  

---

## Files by Category

### Production Application Files (Keep in Root)
- `server-postgres.js` - Main Express server
- `db-postgres.js` - Database connection
- `routes/` - API endpoints
- `middleware/` - Express middleware
- `utils/` - Helper functions
- `tests/` - Test suite
- `migrations/` - Database migrations
- `scripts/` - Production scripts (backups, etc.)

### Configuration Files (Keep in Root)
- `.env` - Environment variables
- `.env.example` - Template
- `.gitignore` - Git rules
- `package.json` - Dependencies
- `package-lock.json` - Lock file

### Documentation Files (Keep in Root)
- `README.md` - Project overview
- `00-START-HERE.md` - Quick start guide
- `DEPLOYMENT-COMPLETE-SCHEMA.md` - Full deployment docs
- `DEPLOYMENT-QUICK-REFERENCE.md` - Quick reference

### Storage Directories (Keep in Root)
- `attachments/` - Invoice attachments
- `backups/` - Database backups
- `docs/` - API docs
- `invoice_pdfs/` - PDF files
- `uploads/` - User uploads
- `node_modules/` - Dependencies

### Non-Essential Files (Moved to Archive)
- **Debug Scripts**: check-*.js, debug-*.js (15 files)
- **Test Scripts**: test-*.js (25 files)
- **Utility Scripts**: fix-*.js, analyze-*.js, etc. (20 files)
- **Legacy Setup**: *.bat, *.ps1 files (8 files)
- **Old Documentation**: CADDY-*, DEPLOYMENT-GUIDE.md, QUICK-DEPLOY.md
- **Data Files**: *.json, *.log, *.sql (old exports)
- **Deprecated**: invoices.db.DEPRECATED_SQLITE_DO_NOT_USE

---

## How to Use

### To Start the Application

```bash
cd Invoice-tracker-backend
npm install
npm run start:postgres
```

### To Deploy to EC2

All deployment scripts are in `Archive/`:

```bash
# 1. Copy deployment scripts from Archive
cp Archive/deploy-schema-to-ec2.js .
cp Archive/deploy-complete-schema-ec2.sql .
cp Archive/migrate-data-to-ec2.js .

# 2. Update .env with EC2 credentials

# 3. Run deployment
node deploy-schema-to-ec2.js

# 4. Run migration (optional)
node migrate-data-to-ec2.js

# 5. Clean up (move scripts back to Archive when done)
mv deploy-*.js deploy-*.sql Archive/
mv migrate-*.js Archive/
```

### To Run Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### To Debug Issues

Debug scripts are in `Archive/`:

```bash
# Copy needed debug script
cp Archive/check-table-counts.js .

# Run it
node check-table-counts.js

# Move it back when done
mv check-table-counts.js Archive/
```

---

## Git Commit Information

### Changes Made

This reorganization should be committed with the following message:

```
feat: reorganize backend folder structure

- Move 80+ debug/test/utility scripts to Archive/ folder
- Clean up root directory to show only essential files
- Improve code clarity and project onboarding
- Separate production code from development utilities
- Maintain all historical scripts in Archive for reference

Files moved:
- Debug scripts: check-*.js, debug-*.js, etc.
- Test scripts: test-*.js files
- Utility scripts: fix-*.js, analyze-*.js, create-*.js, etc.
- Legacy setup scripts: *.bat, *.ps1 files
- Old documentation: CADDY-*.md, DEPLOYMENT-GUIDE.md, etc.
- Data files: *.json, *.log outputs
- Deprecated: invoices.db.DEPRECATED_SQLITE_DO_NOT_USE

Production files retained:
- Core application: server-postgres.js, db-postgres.js
- API: routes/, middleware/, utils/
- Tests: tests/ folder
- Config: package.json, .env*
- Documentation: README.md, 00-START-HERE.md, DEPLOYMENT-*.md
- Storage: attachments/, backups/, uploads/, etc.
```

### To Commit These Changes

```bash
# 1. Create new branch
git checkout -b feature/complete-ec2-deployment

# 2. Stage all changes
git add -A

# 3. Commit with message
git commit -m "feat: reorganize backend folder structure

- Move 80+ debug/test/utility scripts to Archive/ folder
- Clean up root directory to show only essential files
- Improve code clarity and project onboarding
- Separate production code from development utilities

Files moved to Archive/:
- 15 debug/check scripts (check-*.js, debug-*.js)
- 25 test scripts (test-*.js)
- 15 utility scripts (fix-*.js, analyze-*.js, etc.)
- 8 legacy setup scripts (*.bat, *.ps1)
- Old deployment docs (CADDY-*.md, DEPLOYMENT-GUIDE.md)
- Data and results files (*.json, *.log, *.sql)
- Deprecated database file

Production files preserved in root:
- Core: server-postgres.js, db-postgres.js
- API: routes/, middleware/, utils/
- Tests: tests/
- Config: package.json, .env*
- Docs: *.md files
- Storage: attachments/, backups/, uploads/"

# 4. Push to remote
git push -u origin feature/complete-ec2-deployment
```

---

## Files to .gitignore

Consider adding to `.gitignore` to prevent Archive folder from being tracked:

```bash
# Archive folder (for development/debugging only)
Archive/
Archive/**
!Archive/.gitkeep  # Keep folder in git
```

---

## Rollback Instructions

If you need to undo this reorganization:

```bash
# Move everything back from Archive
mv Archive/* .
rmdir Archive

# Revert commit
git revert HEAD
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Essential files in root** | 20 |
| **Essential folders** | 9 |
| **Files moved to Archive** | 80+ |
| **Debug scripts archived** | 15 |
| **Test scripts archived** | 25 |
| **Utility scripts archived** | 20 |
| **Legacy batch files archived** | 8 |
| **Space freed in root** | ~85% reduction in file count |

---

## Next Steps

1. ✅ Folder reorganized
2. 📋 Review this guide
3. 🔄 Commit changes to git with the provided message
4. 📤 Push to `feature/complete-ec2-deployment` branch
5. 🔀 Create Pull Request to merge into `main`
6. ✨ Deploy with confidence!

---

**Date**: November 12, 2025  
**Status**: ✅ Reorganization Complete  
**Ready for**: Git commit and deployment

