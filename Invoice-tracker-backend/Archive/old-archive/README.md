# Archived Files

This directory contains deprecated files that are no longer used in production but are kept for reference.

## server-sqlite.js

**Status:** DEPRECATED (as of November 2025)

This is the original SQLite-based server that has been replaced by `server-postgres.js`.

**Why archived:**
- SQLite has been superseded by PostgreSQL for better performance and reliability
- Maintaining two servers was causing confusion and duplicate work
- All production systems now use PostgreSQL

**To use (if needed for reference):**
```bash
node archived/server-sqlite.js
```

**Note:** The SQLite database file is no longer maintained and may be out of sync with the PostgreSQL database.

## Active Server

The current production server is: **`server-postgres.js`**

Use `start-invoice-tracker-postgres.bat` to start the application.
