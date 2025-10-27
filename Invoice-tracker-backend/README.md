# Invoice Tracker - Backend

PostgreSQL-based backend for the APAC Invoice Tracker application.

---

## 📁 Directory Structure

```
Invoice-tracker-backend/
├── 🟢 server-postgres.js          # Main server (USE THIS)
├── 🔴 server.js                   # Old SQLite server (deprecated)
├── db-postgres.js                 # Database connection module
├── package.json                   # Dependencies
├── .env                          # Environment configuration
│
├── 📂 docs/                      # Documentation
│   ├── POSTGRESQL-SETUP.md       # Database setup guide
│   ├── README-WHICH-SERVER.md    # Server selection guide
│   ├── HOW-TO-STOP-SERVERS.md    # Stop server instructions
│   ├── TESTING.md                # Testing documentation
│   ├── TESTING-QUICK-START.md    # Quick testing guide
│   ├── QA-VALIDATION-REPORT.md   # QA reports
│   └── PARSING-FIXES-SUMMARY.md  # Date parsing fixes
│
├── 📂 scripts/
│   ├── 📂 testing/              # Test scripts
│   │   ├── run-all-tests.ps1    # Run all tests
│   │   ├── run-unit-tests.bat   # Unit tests
│   │   ├── run-api-tests.bat    # API tests
│   │   ├── test-parse-pdfs.js   # PDF parsing tests
│   │   └── ...
│   │
│   ├── 📂 validation/           # Data validation scripts
│   │   ├── validate-invoices.js  # Validate invoice data
│   │   ├── check-invoice.js      # Check specific invoice
│   │   ├── comprehensive-validation.js
│   │   └── ...
│   │
│   ├── 📂 migration/            # Database migration scripts
│   │   ├── migrate-to-postgres.js    # SQLite → PostgreSQL
│   │   ├── fix-strategic-dates.js    # Fix US date formats
│   │   ├── fix-dates.js              # General date fixes
│   │   ├── schema.sql                # Database schema
│   │   └── ...
│   │
│   └── 📂 utilities/            # Utility scripts
│       ├── upload-missing-invoices.js
│       ├── update-invoice-type.js
│       └── bulk-upload.sh
│
├── 📂 tests/                    # Jest test files
│   ├── api.test.js             # API endpoint tests
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
│
├── 📂 invoice_pdfs/            # Invoice PDF storage
├── 📂 uploads/                 # Temporary upload folder
│
└── 🔧 Batch Files (Quick Actions)
    ├── START-POSTGRESQL-SERVER.bat
    ├── STOP-ALL-SERVERS.bat
    └── stop-invoice-tracker-postgres.bat
```

---

## 🚀 Quick Start

### 1. Start the Server
```bash
# Use the PostgreSQL server (recommended)
node server-postgres.js

# Or double-click:
START-POSTGRESQL-SERVER.bat
```

### 2. Stop the Server
```bash
# Stop all servers (SQLite and PostgreSQL)
STOP-ALL-SERVERS.bat

# Or press Ctrl+C in the terminal
```

### 3. Check Server Health
```bash
# Visit in browser:
http://localhost:3001/api/health

# Should show:
{"status":"ok","database":"postgresql",...}
```

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `server-postgres.js` | ✅ Main server - USE THIS |
| `db-postgres.js` | Database connection module |
| `server.js` | ❌ Old SQLite version - DON'T USE |
| `.env` | Database credentials (not in git) |
| `package.json` | Node.js dependencies |

---

## 📖 Documentation

All documentation is in the `docs/` folder:

| Document | Description |
|----------|-------------|
| `POSTGRESQL-SETUP.md` | How to set up PostgreSQL database |
| `README-WHICH-SERVER.md` | Which server file to use |
| `HOW-TO-STOP-SERVERS.md` | How to stop servers |
| `TESTING.md` | Complete testing guide |
| `TESTING-QUICK-START.md` | Quick testing reference |

---

## 🧪 Testing

All test scripts are in `scripts/testing/`:

### Run All Tests
```bash
cd scripts/testing
run-all-tests.ps1
```

### Run Specific Tests
```bash
# Unit tests only
run-unit-tests.bat

# API tests only
run-api-tests.bat

# Integration tests
run-integration-tests.bat
```

---

## ✅ Validation

Data validation scripts are in `scripts/validation/`:

### Validate All Invoices
```bash
node scripts/validation/validate-invoices.js
```

### Check Specific Invoice
```bash
node scripts/validation/check-invoice.js 4600032536
```

### Comprehensive Validation
```bash
node scripts/validation/comprehensive-validation.js
```

---

## 🔄 Migration & Fixes

Migration scripts are in `scripts/migration/`:

### Migrate from SQLite to PostgreSQL
```bash
node scripts/migration/migrate-to-postgres.js
```

### Fix Date Issues
```bash
# Fix Strategic Asia Pacific Partners dates (US format)
node scripts/migration/fix-strategic-dates.js --apply

# General date fixes
node scripts/migration/fix-dates.js
```

### Database Schema
```bash
# View or apply database schema
psql -h localhost -U your_user -d invoice_tracker < scripts/migration/schema.sql
```

---

## 🛠️ Utilities

Utility scripts are in `scripts/utilities/`:

### Upload Missing Invoices
```bash
node scripts/utilities/upload-missing-invoices.js
```

### Update Invoice Types
```bash
node scripts/utilities/update-invoice-type.js
```

### Bulk Upload
```bash
bash scripts/utilities/bulk-upload.sh
```

---

## 🗄️ Database

### Connection Details
- **Host**: Configured in `.env`
- **Port**: 5432 (PostgreSQL default)
- **Database**: `invoice_tracker`
- **User**: Configured in `.env`

### Current Status
- ✅ 810 invoices migrated
- ✅ PostgreSQL 14+
- ✅ 139 Strategic Asia Pacific Partners invoices fixed
- ✅ All date formats corrected

---

## 📦 Dependencies

Main dependencies (see `package.json` for full list):
- `express` - Web server framework
- `pg` - PostgreSQL client
- `formidable` - File upload handling
- `pdf-parse` - PDF parsing
- `exceljs` - Excel file handling
- `axios` - HTTP client
- `cors` - CORS middleware
- `dotenv` - Environment variables

---

## 🔧 Environment Variables

Create a `.env` file with:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=your_username
DB_PASSWORD=your_password

# Application Configuration
PORT=3001
NODE_ENV=development
```

See `.env.example` for template.

---

## 🐛 Troubleshooting

### Server Won't Start
1. Check PostgreSQL is running
2. Verify `.env` file exists and has correct credentials
3. Check port 3001 is not in use: `netstat -ano | findstr :3001`

### Database Connection Failed
1. Test connection: `psql -h localhost -U your_user -d invoice_tracker`
2. Check firewall rules
3. Verify credentials in `.env`

### SQL Syntax Errors
- Make sure you're using `server-postgres.js`, not `server.js`
- Check for trailing commas in SQL queries
- Review recent changes in server file

### PDFs Not Loading
1. Verify server is running: `http://localhost:3001/api/health`
2. Check `invoice_pdfs/` folder exists
3. Verify PDF paths in database are correct

---

## 📝 Version History

### Current Version: 1.0 (PostgreSQL)
- ✅ PostgreSQL database migration complete
- ✅ Advanced analytics platform
- ✅ Production mode (starts Nov 1, 2025)
- ✅ Date parsing fixes for all clients
- ✅ Cloud deployment ready

### Legacy: 0.x (SQLite)
- ❌ Deprecated - don't use `server.js`
- ❌ Not suitable for production

---

## 🚀 Deployment

For cloud deployment instructions, see:
```
C:\Users\dwils\Claude-Projects\Invoice Tracker\DEPLOYMENT-GUIDE.md
```

Covers:
- Azure deployment (~$44/month)
- AWS deployment (~$32/month)
- Database migration
- Environment setup
- Monitoring and backups

---

## 📞 Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review troubleshooting section above
3. Check git commit history for recent changes

---

## 🎯 Common Tasks

| Task | Command/File |
|------|-------------|
| Start server | `node server-postgres.js` |
| Stop server | `STOP-ALL-SERVERS.bat` |
| Run tests | `scripts/testing/run-all-tests.ps1` |
| Validate data | `node scripts/validation/validate-invoices.js` |
| Fix dates | `node scripts/migration/fix-strategic-dates.js` |
| Check health | Visit `http://localhost:3001/api/health` |
| View docs | Open `docs/` folder |

---

**Always use `server-postgres.js` for the Invoice Tracker!**
