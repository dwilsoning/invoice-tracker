# Invoice Tracker

A full-stack web application for tracking and managing invoices with user authentication, PDF parsing, and financial analytics.

---

## 🌟 Features

### Invoice Management
- 📄 Upload and parse PDF invoices automatically
- 📊 Track invoice status (Pending, Paid, Overdue)
- 💰 Multi-currency support (USD, AUD, EUR, GBP, SGD)
- 📅 Due date tracking and payment management
- 🔍 Advanced filtering and search
- 📈 Financial analytics and dashboards

### User Authentication
- 🔐 Secure login with JWT tokens
- 👥 User management (admin/user roles)
- 🔑 Password reset via email
- 👤 User profile management
- 🛡️ Role-based access control

### Data Management
- 📊 Contract tracking and management
- 📅 Expected invoice generation
- 💾 PostgreSQL database
- 🔄 Automated backups
- 📤 Excel/CSV export capabilities

---

## 🚀 Quick Start

### New Installation

1. **Check Prerequisites**: See [PREREQUISITES.md](PREREQUISITES.md)
   - Node.js 16+
   - PostgreSQL 12+
   - 5 GB disk space

2. **Install**: Follow [INSTALLATION.md](INSTALLATION.md) for step-by-step setup

3. **Quick Setup**: Experienced developers can use [QUICK-SETUP.md](QUICK-SETUP.md)

### Already Installed?

```bash
# Terminal 1 - Start Backend
cd Invoice-tracker-backend
npm run start:postgres

# Terminal 2 - Start Frontend
cd invoice-tracker-frontend
npm run dev
```

Access at: http://localhost:5173

---

## 📋 System Requirements

### Required Software
- **Node.js**: 16.x or higher
- **PostgreSQL**: 12.x or higher
- **npm**: 8.x or higher (comes with Node.js)

### Operating Systems
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu 20.04+, Debian, Fedora)

### Hardware
- CPU: Dual-core 2 GHz+
- RAM: 4 GB minimum, 8 GB recommended
- Disk: 5 GB free space

---

## 📁 Project Structure

```
Invoice Tracker/
│
├── 📄 README.md                     # This file
├── 📄 PREREQUISITES.md              # System requirements
├── 📄 INSTALLATION.md               # Detailed setup guide
├── 📄 QUICK-SETUP.md                # Quick reference
│
├── 📂 Invoice-tracker-backend/      # Backend API (Node.js/Express)
│   ├── server-postgres.js           # Main server
│   ├── db-postgres.js               # Database connection
│   ├── package.json                 # Dependencies
│   ├── .env.example                 # Environment template
│   │
│   ├── 📂 routes/                   # API endpoints
│   │   ├── auth.js                  # Authentication
│   │   └── users.js                 # User management
│   │
│   ├── 📂 middleware/               # Express middleware
│   │   └── auth.js                  # Auth middleware
│   │
│   ├── 📂 utils/                    # Utility functions
│   │   ├── auth.js                  # Password hashing
│   │   ├── jwt.js                   # JWT tokens
│   │   └── email.js                 # Email service
│   │
│   ├── 📂 scripts/                  # Management scripts
│   │   ├── run-auth-migration.js    # Database setup
│   │   ├── create-admin-user.js     # User creation
│   │   ├── test-auth-setup.js       # Setup testing
│   │   └── backup/                  # Backup scripts
│   │
│   ├── 📂 migrations/               # Database migrations
│   │   ├── schema.sql               # Main schema
│   │   └── add-users-authentication.sql
│   │
│   ├── 📂 docs/                     # Documentation
│   │   ├── AUTHENTICATION-QUICKSTART.md
│   │   ├── AUTHENTICATION-SETUP.md
│   │   ├── AUTHENTICATION-API.md
│   │   └── POSTGRESQL-SETUP.md
│   │
│   ├── 📂 invoice_pdfs/             # PDF storage
│   ├── 📂 uploads/                  # Temp uploads
│   └── 📂 backups/                  # Database backups
│
└── 📂 invoice-tracker-frontend/     # Frontend (React/Vite)
    ├── src/                         # Source code
    ├── public/                      # Static assets
    ├── package.json                 # Dependencies
    └── vite.config.js               # Vite configuration
```

---

## 🔧 Technology Stack

### Backend
- **Runtime**: Node.js 18.x
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (custom implementation)
- **Email**: Nodemailer
- **File Processing**: pdf-parse, ExcelJS
- **Testing**: Jest, Supertest

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios

### Database Schema
- **invoices** - Invoice records
- **contracts** - Contract information
- **expected_invoices** - Anticipated invoices
- **users** - User accounts
- **password_reset_tokens** - Password reset requests

---

## 📖 Documentation

### Getting Started
- [PREREQUISITES.md](PREREQUISITES.md) - What you need before installing
- [INSTALLATION.md](INSTALLATION.md) - Complete installation guide
- [QUICK-SETUP.md](QUICK-SETUP.md) - Quick reference for experienced users

### Authentication System
- [AUTHENTICATION-QUICKSTART.md](Invoice-tracker-backend/docs/AUTHENTICATION-QUICKSTART.md) - 5-minute auth setup
- [AUTHENTICATION-SETUP.md](Invoice-tracker-backend/docs/AUTHENTICATION-SETUP.md) - Detailed auth configuration
- [AUTHENTICATION-API.md](Invoice-tracker-backend/docs/AUTHENTICATION-API.md) - Complete API reference
- [AUTHENTICATION-IMPLEMENTATION-SUMMARY.md](Invoice-tracker-backend/AUTHENTICATION-IMPLEMENTATION-SUMMARY.md) - Implementation details

### Database & Backend
- [POSTGRESQL-SETUP.md](Invoice-tracker-backend/docs/POSTGRESQL-SETUP.md) - Database setup
- [README-WHICH-SERVER.md](Invoice-tracker-backend/docs/README-WHICH-SERVER.md) - Server selection
- [HOW-TO-STOP-SERVERS.md](Invoice-tracker-backend/docs/HOW-TO-STOP-SERVERS.md) - Stop servers

---

## 🔐 Authentication & Security

### Features
- **JWT Authentication**: Secure token-based auth (7-day expiration)
- **Password Security**: PBKDF2 hashing with salt
- **Role-Based Access**: Admin and user roles
- **Password Reset**: Email-based password recovery
- **Account Management**: User activation/deactivation

### Security Best Practices
- Strong password requirements enforced
- Tokens signed with HMAC-SHA256
- One-time password reset tokens
- Protection against email enumeration
- CORS configured for frontend domain

---

## 🚦 API Endpoints

### Public Endpoints
```
POST   /api/auth/login                    # User login
POST   /api/auth/request-password-reset   # Request password reset
POST   /api/auth/reset-password           # Reset password
```

### Protected Endpoints (Authentication Required)
```
GET    /api/auth/verify                   # Verify token
POST   /api/auth/change-password          # Change password
GET    /api/users/profile/me              # Get my profile
PUT    /api/users/profile/me              # Update my profile

GET    /api/invoices                      # List invoices
POST   /api/upload-invoice                # Upload invoice
PUT    /api/invoices/:id                  # Update invoice
DELETE /api/invoices/:id                  # Delete invoice

GET    /api/contracts                     # List contracts
GET    /api/expected-invoices             # List expected invoices
```

### Admin-Only Endpoints
```
GET    /api/users                         # List all users
POST   /api/users                         # Create user
PUT    /api/users/:id                     # Update user
DELETE /api/users/:id                     # Delete user
```

Complete API reference: [AUTHENTICATION-API.md](Invoice-tracker-backend/docs/AUTHENTICATION-API.md)

---

## ⚙️ Configuration

### Environment Variables

Create `.env` in the backend folder:

```env
# Database (Required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_secure_password

# Application (Required)
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Authentication (Required)
JWT_SECRET=your_64_character_hex_secret

# Email (Optional - for password reset)
EMAIL_SERVICE=gmail|sendgrid|smtp
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Generating Secrets

```bash
# Generate JWT secret (64 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate secure password
openssl rand -base64 32
```

---

## 🧪 Testing

```bash
# Backend tests
cd Invoice-tracker-backend
npm test                    # Run all tests
npm run test:api            # API tests only
npm run test:unit           # Unit tests only
npm run test:coverage       # Coverage report

# Test authentication setup
node scripts/test-auth-setup.js

# Health check
curl http://localhost:3001/api/health
```

---

## 💾 Backup & Maintenance

### Create Backup
```bash
cd Invoice-tracker-backend
node scripts/backup/backup-postgres.js
```

### Restore from Backup
```bash
psql -U invoice_tracker_user -d invoice_tracker < backups/backup_file.sql
```

### Database Maintenance
```bash
# Vacuum database
psql -U invoice_tracker_user -d invoice_tracker -c "VACUUM ANALYZE;"

# Check database size
psql -U invoice_tracker_user -d invoice_tracker -c "
  SELECT pg_size_pretty(pg_database_size('invoice_tracker'));"
```

---

## 🐛 Troubleshooting

### Common Issues

**Cannot connect to database**
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U invoice_tracker_user -d invoice_tracker -h localhost
```

**Port already in use**
```bash
# Windows
netstat -ano | findstr :3001

# Linux/macOS
lsof -i :3001
```

**Module not found**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Authentication not working**
- Verify JWT_SECRET is set in .env
- Check admin user exists: `psql -U invoice_tracker_user -d invoice_tracker -c "SELECT * FROM users;"`
- Run: `node scripts/test-auth-setup.js`

See [INSTALLATION.md](INSTALLATION.md) section 7 for more troubleshooting.

---

## 📊 Default Ports

- **Frontend**: 5173 (Vite dev server)
- **Backend API**: 3001 (configurable)
- **PostgreSQL**: 5432 (default)

---

## 🛠️ Development

### Start Development Servers
```bash
# Backend (with auto-reload)
cd Invoice-tracker-backend
npm run dev:postgres

# Frontend (with hot reload)
cd invoice-tracker-frontend
npm run dev
```

### Build for Production
```bash
# Frontend
cd invoice-tracker-frontend
npm run build

# Output: dist/ folder
```

---

## 📦 Dependencies

### Backend Main Dependencies
- express: 4.18.2
- pg: 8.11.3 (PostgreSQL client)
- cors: 2.8.5
- dotenv: 16.3.1
- nodemailer: 6.10.1
- pdf-parse: 1.1.1
- exceljs: 4.4.0
- axios: 1.6.5

### Frontend Main Dependencies
- react: 18.2.0
- react-dom: 18.2.0
- vite: 7.1.11
- axios: 1.6.5
- recharts: 3.3.0
- tailwindcss: 3.4.0

---

## 🔄 Version History

### v1.0.0 (Current)
- Full invoice management system
- User authentication with JWT
- Role-based access control
- Password reset functionality
- PostgreSQL database
- PDF invoice parsing
- Multi-currency support
- Financial analytics dashboard

---

## 👥 User Roles

### Admin
- Full access to all features
- User management (create, edit, delete users)
- System configuration
- Access to all invoices and data

### User
- View and manage invoices
- Upload new invoices
- Update own profile
- Change own password
- Limited to assigned data (can be configured)

---

## 📧 Email Configuration

### Gmail Setup (Recommended for Development)
1. Enable 2-factor authentication
2. Generate app password: https://myaccount.google.com/apppasswords
3. Update .env:
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

### SendGrid Setup (Recommended for Production)
1. Create account: https://sendgrid.com/
2. Generate API key
3. Update .env:
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🌐 Deployment

### Production Checklist
- [ ] Use strong, unique JWT_SECRET
- [ ] Configure production database
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure CORS for production domain
- [ ] Set up email service (SendGrid/similar)
- [ ] Enable database backups
- [ ] Set up monitoring/logging
- [ ] Use process manager (PM2, systemd)
- [ ] Set NODE_ENV=production

---

## 📞 Support

### Documentation
- Check [docs/](Invoice-tracker-backend/docs/) folder for detailed guides
- Review [INSTALLATION.md](INSTALLATION.md) for setup help
- See [PREREQUISITES.md](PREREQUISITES.md) for system requirements

### Testing
```bash
# Run diagnostic tests
cd Invoice-tracker-backend
node scripts/test-auth-setup.js
```

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

- Built with Node.js, Express, React, and PostgreSQL
- PDF parsing powered by pdf-parse
- Email functionality via Nodemailer
- Charts powered by Recharts

---

**Ready to get started?**

→ New installation: See [PREREQUISITES.md](PREREQUISITES.md) then [INSTALLATION.md](INSTALLATION.md)

→ Quick setup: See [QUICK-SETUP.md](QUICK-SETUP.md)

→ Already installed: `npm run start:postgres` (backend) + `npm run dev` (frontend)
