# Authentication Quick Start Guide

Get user authentication up and running in 5 minutes!

## Prerequisites

- PostgreSQL installed and running
- Invoice Tracker backend set up with database connection
- Node.js and npm installed

## Step 1: Install Dependencies

```bash
npm install
```

This will install `nodemailer` and all other required packages.

## Step 2: Run Database Migration

```bash
node scripts/run-auth-migration.js
```

This creates the `users` and `password_reset_tokens` tables.

## Step 3: Configure Environment

Edit your `.env` file:

```env
# Required: Set a secure JWT secret
JWT_SECRET=use-the-command-below-to-generate-a-secure-secret

# Optional: Frontend URL for password reset emails
FRONTEND_URL=http://localhost:5173

# Optional: Email configuration (for password resets)
# For development, you can skip this
EMAIL_SERVICE=smtp
SMTP_HOST=localhost
SMTP_PORT=587
```

**Generate a secure JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` value.

## Step 4: Create Admin User

```bash
node scripts/create-admin-user.js
```

Follow the prompts to create your first admin account.

## Step 5: Test Setup

```bash
node scripts/test-auth-setup.js
```

This verifies everything is configured correctly.

## Step 6: Start Server

```bash
npm run start:postgres
```

## Step 7: Test Authentication

### Login Test

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"YourPassword123!"}'
```

You should receive a JWT token in the response.

### Verify Token Test

```bash
# Replace YOUR_TOKEN with the token from login
curl http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What's Next?

### Configure Email (Optional)

For password reset functionality, configure email in `.env`:

**Option 1: Gmail**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

Get Gmail app password: https://myaccount.google.com/apppasswords

**Option 2: SendGrid**
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### Protect Your Invoice Routes (Optional)

To require authentication for invoice operations, add the middleware to routes in `server-postgres.js`:

```javascript
// Before:
app.get('/api/invoices', async (req, res) => { ... });

// After (require authentication):
app.get('/api/invoices', authenticateToken, async (req, res) => { ... });

// Or require admin role:
app.delete('/api/invoices/:id', authenticateToken, requireAdmin, async (req, res) => { ... });
```

### Frontend Integration

See `docs/AUTHENTICATION-API.md` for complete API documentation and frontend integration examples.

## Troubleshooting

### "Users table does not exist"

Run the migration:
```bash
node scripts/run-auth-migration.js
```

### "JWT_SECRET not set"

Add to `.env`:
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env
```

### "Email configuration error"

This is normal if you haven't configured email yet. Email is optional for development. Password reset will still generate tokens in the database.

### "Cannot connect to database"

Make sure PostgreSQL is running:
```bash
# Windows
net start postgresql

# Linux/WSL
sudo service postgresql start
```

Verify database credentials in `.env`.

## Files Created

The authentication system added these files:

```
migrations/
  └── add-users-authentication.sql      # Database schema

utils/
  ├── auth.js                            # Password hashing & validation
  ├── jwt.js                             # JWT token handling
  └── email.js                           # Email service

middleware/
  └── auth.js                            # Authentication middleware

routes/
  ├── auth.js                            # Login, password reset
  └── users.js                           # User management

scripts/
  ├── run-auth-migration.js              # Run migration
  ├── create-admin-user.js               # Create admin
  └── test-auth-setup.js                 # Test setup

docs/
  ├── AUTHENTICATION-SETUP.md            # Detailed setup
  ├── AUTHENTICATION-API.md              # API reference
  └── AUTHENTICATION-QUICKSTART.md       # This file
```

## API Endpoints Available

### Public
- `POST /api/auth/login` - Login
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Authenticated
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/change-password` - Change password
- `GET /api/users/profile/me` - Get my profile
- `PUT /api/users/profile/me` - Update my profile

### Admin Only
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Run migration
node scripts/run-auth-migration.js

# Create admin user
node scripts/create-admin-user.js

# Test setup
node scripts/test-auth-setup.js

# Start server
npm run start:postgres

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Support

For detailed documentation:
- **Setup Guide**: `docs/AUTHENTICATION-SETUP.md`
- **API Reference**: `docs/AUTHENTICATION-API.md`
- **Main README**: `README.md`

## Security Checklist

- [ ] Set a strong JWT_SECRET
- [ ] Use HTTPS in production
- [ ] Configure email service
- [ ] Create strong admin password
- [ ] Update default database password
- [ ] Configure CORS for your frontend domain
- [ ] Enable firewall rules for PostgreSQL
- [ ] Regular database backups

---

**Done!** Your authentication system is ready to use.

Login with your admin credentials and start managing users! 🎉
