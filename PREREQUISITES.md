# Invoice Tracker - System Prerequisites

Complete list of everything needed to run the Invoice Tracker application on any computer.

---

## 📋 Overview

The Invoice Tracker consists of:
- **Backend**: Node.js/Express REST API with PostgreSQL database
- **Frontend**: React application with Vite
- **Storage**: File system for PDF invoices

---

## 🖥️ System Requirements

### Operating System
Any of the following:
- **Windows** 10/11 (tested on Windows)
- **macOS** 10.15 or later
- **Linux** (Ubuntu 20.04+, Debian, Fedora, etc.)

### Hardware (Minimum)
- **CPU**: Dual-core processor (2 GHz or faster)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 2 GB for software + storage for invoice PDFs
- **Network**: Internet connection for initial setup and optional features

---

## 📦 Required Software

### 1. Node.js and npm

**Version Required**: Node.js 16.x or higher (tested on 18.19.1)

**Download**: https://nodejs.org/

**Installation**:
- Download the LTS (Long Term Support) version
- Run the installer
- Verify installation:
  ```bash
  node --version   # Should show v16.x or higher
  npm --version    # Should show 8.x or higher
  ```

**Windows**: Use the Windows installer (.msi)
**macOS**: Use the macOS installer (.pkg) or Homebrew: `brew install node`
**Linux**: Use package manager or NodeSource:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/RHEL
sudo dnf install nodejs
```

---

### 2. PostgreSQL Database

**Version Required**: PostgreSQL 12 or higher (tested on 14.x)

**Download**: https://www.postgresql.org/download/

**Installation**:

**Windows**:
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - Set a password for the `postgres` superuser (remember this!)
   - Default port: 5432
   - Install pgAdmin 4 (recommended for database management)
4. Add PostgreSQL to PATH if not done automatically

**macOS**:
```bash
# Using Homebrew (recommended)
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Verify Installation**:
```bash
# Check PostgreSQL version
psql --version   # Should show PostgreSQL 12.x or higher

# Check if PostgreSQL is running
# Windows
pg_ctl status

# Linux/macOS
sudo systemctl status postgresql
# or
brew services list | grep postgresql
```

---

### 3. Git (Optional but Recommended)

**Version Required**: Git 2.x or higher

**Download**: https://git-scm.com/downloads

**Installation**:
- **Windows**: Download Git for Windows installer
- **macOS**: `brew install git` or use Xcode Command Line Tools
- **Linux**: `sudo apt install git` (Ubuntu/Debian)

**Verify**:
```bash
git --version
```

---

## 🔧 Development Tools (Optional)

### Code Editor
Recommended (choose one):
- **Visual Studio Code** (recommended): https://code.visualstudio.com/
- **WebStorm**: https://www.jetbrains.com/webstorm/
- **Sublime Text**: https://www.sublimetext.com/
- Any text editor will work

### Database Management Tool
Recommended (choose one):
- **pgAdmin 4** (usually installed with PostgreSQL)
- **DBeaver**: https://dbeaver.io/
- **DataGrip**: https://www.jetbrains.com/datagrip/
- **Azure Data Studio**: https://azure.microsoft.com/en-us/products/data-studio/

---

## 📂 Project Files Required

You need to obtain the complete Invoice Tracker project folder, which includes:

```
Invoice Tracker/
├── Invoice-tracker-backend/    # Backend API (Node.js/Express)
├── invoice-tracker-frontend/   # Frontend UI (React/Vite)
└── (optional) scripts/         # Utility scripts
```

**How to Get the Files**:

### Option 1: Via Git (Recommended)
```bash
git clone <repository-url> "Invoice Tracker"
cd "Invoice Tracker"
```

### Option 2: Via Download
1. Download the project as a ZIP file
2. Extract to a folder called "Invoice Tracker"
3. Navigate to that folder

---

## 🌐 Network/Firewall Configuration

### Ports Required
Make sure these ports are available (not blocked by firewall):

- **3001**: Backend API server (configurable via PORT in .env)
- **5173**: Frontend development server (Vite default)
- **5432**: PostgreSQL database (default, configurable)

### Allow Access
**Windows Firewall**:
- May prompt when first starting the servers - click "Allow"
- Or manually add exceptions for Node.js and PostgreSQL

**Linux/macOS Firewall**:
```bash
# Usually not needed for localhost development
# If using UFW on Linux:
sudo ufw allow 3001
sudo ufw allow 5173
```

---

---

## 💾 Storage Requirements

### Disk Space Needed:
- **Node modules** (backend): ~300 MB
- **Node modules** (frontend): ~200 MB
- **PostgreSQL**: ~100 MB base installation
- **Invoice PDFs**: Depends on usage (plan for 1-5 GB)
- **Database data**: ~100 MB for moderate usage
- **Total**: ~2-5 GB minimum

### File System Permissions:
- **Read/Write** access to project folder
- **Read/Write** access for PostgreSQL data directory
- **Create/Delete** permissions for PDF storage folder

---

## 🔐 Access Requirements

### Database Credentials Needed:
You'll need to set up:
1. PostgreSQL superuser password (set during installation)
2. Application database user credentials (created during setup)

### Administrator Access:
- **Windows**: May need to "Run as Administrator" for PostgreSQL installation
- **Linux/macOS**: May need `sudo` for PostgreSQL installation and service management

---

## 📋 Pre-Installation Checklist

Before starting installation, ensure you have:

- [ ] Operating system that meets requirements
- [ ] Sufficient disk space (5 GB free minimum)
- [ ] Internet connection for downloading dependencies
- [ ] Administrator/sudo access for installing software
- [ ] PostgreSQL superuser password ready
- [ ] Firewall allows required ports (3001, 5173, 5432)
- [ ] Project files downloaded or cloned

---

## 📚 Environment Variables Needed

Once software is installed, you'll need to configure these:

### Backend (.env file):
```env
# Database Configuration (REQUIRED)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_secure_password

# Application (REQUIRED)
PORT=3001
NODE_ENV=development

# Authentication (REQUIRED for user auth)
JWT_SECRET=random-64-character-secret

# Frontend URL (OPTIONAL)
FRONTEND_URL=http://localhost:5173
```

---

## 🚀 Quick Start After Prerequisites

Once all prerequisites are installed:

### 1. Database Setup
```bash
# Create PostgreSQL database and user
# (See INSTALLATION.md for detailed steps)
```

### 2. Backend Setup
```bash
cd Invoice-tracker-backend
npm install                          # Install dependencies
cp .env.example .env                 # Create environment file
# Edit .env with your configuration
node scripts/run-auth-migration.js   # Create auth tables
node scripts/create-admin-user.js    # Create first admin user
npm run start:postgres               # Start backend server
```

### 3. Frontend Setup
```bash
cd invoice-tracker-frontend
npm install                          # Install dependencies
npm run dev                          # Start frontend server
```

### 4. Access Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

---

## ❓ Troubleshooting Prerequisites

### "Node.js not found"
- Ensure Node.js is installed and added to PATH
- Restart terminal after installation
- Windows: May need to restart computer

### "PostgreSQL connection failed"
- Check PostgreSQL service is running
- Verify credentials in .env
- Check port 5432 is not blocked
- Windows: Use Services app to start PostgreSQL
- Linux: `sudo systemctl start postgresql`

### "Permission denied"
- Windows: Run terminal as Administrator
- Linux/macOS: Use `sudo` for system-level operations
- Ensure user has write permissions to project folder

### "Port already in use"
- Check if another application is using ports 3001, 5173, or 5432
- Windows: `netstat -ano | findstr :3001`
- Linux/macOS: `lsof -i :3001`
- Change ports in configuration if needed

---

## 📖 Next Steps

After installing all prerequisites, follow:
1. **INSTALLATION.md** - Complete setup guide
2. **docs/AUTHENTICATION-QUICKSTART.md** - Set up user authentication
3. **README.md** - Application usage and features

---

## 🔄 Keeping Software Updated

### Regular Updates Recommended:
```bash
# Update Node.js packages
npm outdated              # Check for updates
npm update                # Update packages

# Update PostgreSQL (varies by OS)
# Windows: Use installer
# macOS: brew upgrade postgresql
# Linux: apt upgrade postgresql

# Update Node.js (use installer or version manager)
```

---

## 📞 Support & Resources

### Official Documentation:
- **Node.js**: https://nodejs.org/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **npm**: https://docs.npmjs.com/
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/

### Community Support:
- Node.js: https://nodejs.org/en/community/
- PostgreSQL: https://www.postgresql.org/community/
- Stack Overflow: Use tags [node.js], [postgresql], [react]

---

## 📝 Summary

**Minimum Required**:
1. Node.js 16+ with npm
2. PostgreSQL 12+
3. 5 GB free disk space
4. Project files

**Recommended**:
5. Git for version control
6. Code editor (VS Code)
7. Database tool (pgAdmin)
8. Email service credentials

**Optional**:
9. Development tools
10. Additional monitoring/debugging tools

Once these prerequisites are met, proceed to the installation guide to set up and configure the Invoice Tracker application.
