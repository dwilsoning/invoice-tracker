# Invoice Tracker - Quick Setup Guide

**For experienced developers** - streamlined setup instructions.

For detailed instructions, see **INSTALLATION.md**

---

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+ running
- Project files

---

## 1. Database Setup (2 minutes)

```bash
# Connect to PostgreSQL
psql -U postgres

# Run these SQL commands:
CREATE USER invoice_tracker_user WITH PASSWORD 'your_password';
CREATE DATABASE invoice_tracker OWNER invoice_tracker_user;
GRANT ALL PRIVILEGES ON DATABASE invoice_tracker TO invoice_tracker_user;
\c invoice_tracker
GRANT ALL ON SCHEMA public TO invoice_tracker_user;
\q

# Test connection
psql -U invoice_tracker_user -d invoice_tracker -h localhost
```

---

## 2. Backend Setup (3 minutes)

```bash
cd Invoice-tracker-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env - set these values:
# DB_PASSWORD=your_password
# JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Run migrations
node scripts/run-auth-migration.js
psql -U invoice_tracker_user -d invoice_tracker -h localhost -f scripts/migration/schema.sql

# Create admin user
node scripts/create-admin-user.js

# Test setup
node scripts/test-auth-setup.js

# Create directories
mkdir -p invoice_pdfs/deleted uploads backups
```

---

## 3. Frontend Setup (2 minutes)

```bash
cd ../invoice-tracker-frontend

# Install dependencies
npm install
```

---

## 4. Start Application

**Terminal 1 - Backend:**
```bash
cd Invoice-tracker-backend
npm run start:postgres
```

**Terminal 2 - Frontend:**
```bash
cd invoice-tracker-frontend
npm run dev
```

---

## 5. Verify

- Backend: http://localhost:3001/api/health
- Frontend: http://localhost:5173
- Login with admin credentials created in step 2

---

## Environment Variables Quick Reference

**Required in .env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_actual_password
PORT=3001
FRONTEND_URL=http://localhost:5173
JWT_SECRET=generated_64_char_hex_string
```

**Optional (email):**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

---

## Commands Cheat Sheet

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Test database connection
pg_isready
psql -U invoice_tracker_user -d invoice_tracker -h localhost

# List tables
psql -U invoice_tracker_user -d invoice_tracker -h localhost -c "\dt"

# Check what's using port 3001
# Windows: netstat -ano | findstr :3001
# Linux/Mac: lsof -i :3001

# Backend health check
curl http://localhost:3001/api/health

# Run tests
npm test

# Create database backup
node scripts/backup/backup-postgres.js

# Create new admin user
node scripts/create-admin-user.js

# Test authentication setup
node scripts/test-auth-setup.js
```

---

## Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Can't connect to DB | Check PostgreSQL running: `pg_isready` |
| Port in use | Change PORT in .env or kill process |
| Module not found | `rm -rf node_modules && npm install` |
| Migration failed | Check DB permissions, try manual SQL |
| Login fails | Verify admin user exists, check JWT_SECRET |

---

## Project Structure

```
Invoice Tracker/
├── Invoice-tracker-backend/
│   ├── server-postgres.js       # Main server (use this)
│   ├── db-postgres.js           # Database connection
│   ├── .env                     # Configuration (create this)
│   ├── package.json
│   ├── scripts/
│   │   ├── run-auth-migration.js
│   │   ├── create-admin-user.js
│   │   └── test-auth-setup.js
│   ├── routes/                  # API routes
│   ├── middleware/              # Auth middleware
│   ├── utils/                   # Helper functions
│   └── docs/                    # Documentation
│
└── invoice-tracker-frontend/
    ├── src/
    ├── package.json
    └── vite.config.js
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/request-password-reset` - Request reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/verify` - Verify token

### Users (Admin)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/upload-invoice` - Upload invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

See **docs/AUTHENTICATION-API.md** for complete API reference.

---

## Done!

Backend: http://localhost:3001
Frontend: http://localhost:5173

For detailed setup, see **INSTALLATION.md**
For prerequisites, see **PREREQUISITES.md**
