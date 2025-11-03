# User Authentication and Management Setup Guide

This guide explains how to set up and use the user authentication and management features in the Invoice Tracker application.

## Table of Contents

1. [Overview](#overview)
2. [Database Setup](#database-setup)
3. [Environment Configuration](#environment-configuration)
4. [Email Configuration](#email-configuration)
5. [Creating Your First Admin User](#creating-your-first-admin-user)
6. [API Endpoints](#api-endpoints)
7. [Security Best Practices](#security-best-practices)

## Overview

The authentication system provides:

- User registration and login with JWT tokens
- Password hashing with PBKDF2
- Role-based access control (Admin and User roles)
- Password reset via email
- User profile management
- Admin user management interface

## Database Setup

### Step 1: Run the Migration

Execute the migration to create the users and password reset tables:

```bash
# Connect to PostgreSQL
psql -U invoice_tracker_user -d invoice_tracker

# Run the migration
\i migrations/add-users-authentication.sql
```

Or using the command line directly:

```bash
psql -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql
```

### Step 2: Verify Tables

Verify the tables were created:

```sql
\dt
```

You should see:
- `users`
- `password_reset_tokens`
- `invoices`
- `expected_invoices`
- `contracts`

## Environment Configuration

### Step 1: Update Your .env File

Copy the `.env.example` to `.env` if you haven't already:

```bash
cp .env.example .env
```

### Step 2: Configure Required Settings

Edit your `.env` file and update the following:

```env
# JWT Secret - IMPORTANT: Use a strong random string in production
JWT_SECRET=generate-a-long-random-string-here

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

**Generate a secure JWT secret:**

```bash
# On Linux/Mac
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 64
```

## Email Configuration

Choose one of the following email providers:

### Option 1: Gmail (Easiest for Testing)

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com
```

### Option 2: SendGrid (Recommended for Production)

1. Create a SendGrid account: https://sendgrid.com/
2. Generate an API key
3. Update `.env`:

```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### Option 3: Generic SMTP

```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
```

### Option 4: Development Mode (No Email)

For local development without email, you can skip email configuration. Password reset tokens will still be generated and stored in the database, but emails won't be sent.

## Creating Your First Admin User

Use the provided script to create your first admin user:

```bash
node scripts/create-admin-user.js
```

Or manually via PostgreSQL:

```sql
-- First, generate a password hash using Node.js
-- Run this in Node.js console or create a small script:
-- const { hashPassword } = require('./utils/auth');
-- console.log(hashPassword('YourPassword123!'));

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'user_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_admin',
  'admin@yourdomain.com',
  'PASTE_HASHED_PASSWORD_HERE',
  'Admin',
  'User',
  'admin',
  TRUE
);
```

## API Endpoints

### Authentication Endpoints (Public)

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "YourPassword123!"
}

Response:
{
  "token": "jwt-token-here",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

#### Request Password Reset
```
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

#### Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "newPassword": "NewPassword123!"
}

Response:
{
  "message": "Password has been reset successfully"
}
```

#### Change Password (Authenticated)
```
POST /api/auth/change-password
Authorization: Bearer your-jwt-token
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}

Response:
{
  "message": "Password changed successfully"
}
```

#### Verify Token
```
GET /api/auth/verify
Authorization: Bearer your-jwt-token

Response:
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

### User Management Endpoints (Admin Only)

#### List All Users
```
GET /api/users
Authorization: Bearer admin-jwt-token

Response:
{
  "users": [...]
}
```

#### Get User by ID
```
GET /api/users/:id
Authorization: Bearer admin-jwt-token
```

#### Create User
```
POST /api/users
Authorization: Bearer admin-jwt-token
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "TempPassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "user",
  "sendEmail": true
}

Response:
{
  "message": "User created successfully",
  "user": {...}
}
```

#### Update User
```
PUT /api/users/:id
Authorization: Bearer admin-jwt-token
Content-Type: application/json

{
  "firstName": "Updated Name",
  "role": "admin",
  "isActive": true
}

Response:
{
  "message": "User updated successfully",
  "user": {...}
}
```

#### Delete User
```
DELETE /api/users/:id
Authorization: Bearer admin-jwt-token

Response:
{
  "message": "User deleted successfully"
}
```

### User Profile Endpoints (Authenticated)

#### Get My Profile
```
GET /api/users/profile/me
Authorization: Bearer your-jwt-token

Response:
{
  "user": {...}
}
```

#### Update My Profile
```
PUT /api/users/profile/me
Authorization: Bearer your-jwt-token
Content-Type: application/json

{
  "firstName": "Updated",
  "lastName": "Name",
  "email": "newemail@example.com"
}

Response:
{
  "message": "Profile updated successfully",
  "user": {...}
}
```

## Security Best Practices

### 1. JWT Secret
- Never commit your JWT secret to version control
- Use a strong random string (at least 64 characters)
- Rotate the secret periodically in production

### 2. Password Policy
The system enforces:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### 3. Email Configuration
- Use environment variables for all credentials
- Never commit email credentials to version control
- Use app-specific passwords for Gmail
- Consider using a dedicated email service for production

### 4. HTTPS
- Always use HTTPS in production
- Configure CORS properly for your frontend domain

### 5. Database Security
- Use strong database passwords
- Limit database user permissions
- Regularly backup your database
- Keep PostgreSQL updated

### 6. Token Expiration
- JWT tokens expire after 7 days by default
- Password reset tokens expire after 1 hour
- Adjust in code if needed for your security requirements

## Troubleshooting

### Email Not Sending
1. Check your `.env` configuration
2. Verify email credentials
3. For Gmail, ensure 2FA is enabled and you're using an app password
4. Check server logs for detailed error messages

### Cannot Create Admin User
1. Verify database migration ran successfully
2. Check database connection in `.env`
3. Ensure PostgreSQL is running

### Token Invalid Error
1. Verify JWT_SECRET is set correctly
2. Check token hasn't expired
3. Ensure user account is active
4. Verify user exists in database

## Next Steps

1. Install required dependencies: `npm install`
2. Run the database migration
3. Configure your `.env` file
4. Create your first admin user
5. Test the authentication endpoints
6. Update your frontend to integrate authentication

For frontend integration examples, see the frontend documentation.
