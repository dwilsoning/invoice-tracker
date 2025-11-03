# Authentication System

This is a simple JWT-based authentication system for the Invoice Tracker application. All user management is handled within the application - no email functionality required.

## Features

- JWT token-based authentication
- Role-based access control (admin/user)
- Password hashing with bcrypt
- User management (create, update, delete users)
- Self-service password change

## Quick Start

### 1. Run the migration

```bash
psql -U invoice_tracker_user -d invoice_tracker -f migrations/add-users-authentication.sql
```

### 2. Create an admin user

Interactive mode:
```bash
node scripts/create-admin.js
```

Command-line mode:
```bash
node scripts/create-admin.js admin@example.com SecurePassword123! Admin User
```

### 3. Start the server

```bash
npm run start:postgres
```

## API Endpoints

### Public Endpoints

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_abc123",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }
}
```

### Authenticated Endpoints

Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

#### POST /api/auth/change-password
Change your own password (requires authentication).

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

#### GET /api/auth/verify
Verify if the current token is valid.

**Response:**
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }
}
```

### Admin Endpoints

These endpoints require admin role.

#### GET /api/users
List all users.

**Response:**
```json
{
  "users": [
    {
      "id": "usr_abc123",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin",
      "isActive": true,
      "lastLogin": "2025-11-03T10:30:00Z",
      "createdAt": "2025-11-01T08:00:00Z"
    }
  ]
}
```

#### GET /api/users/:id
Get a specific user by ID.

#### POST /api/users
Create a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "firstName": "New",
  "lastName": "User",
  "role": "user"
}
```

#### PUT /api/users/:id
Update a user.

**Request:**
```json
{
  "email": "updated@example.com",
  "firstName": "Updated",
  "lastName": "Name",
  "role": "admin",
  "isActive": true,
  "password": "NewPassword123!"
}
```

Note: All fields are optional. Only include fields you want to update.

#### DELETE /api/users/:id
Delete a user (cannot delete your own account).

## User Roles

- **admin**: Full access to all features and user management
- **user**: Standard user access (can be customized based on your needs)

## Password Requirements

Passwords must:
- Be at least 8 characters long
- Contain at least one uppercase letter
- Contain at least one lowercase letter
- Contain at least one number
- Contain at least one special character

## Security Notes

1. **JWT Secret**: Always set a strong, random `JWT_SECRET` in your `.env` file for production.
2. **HTTPS**: Use HTTPS in production to protect tokens in transit.
3. **Token Expiry**: Tokens expire after 7 days. Users will need to log in again.
4. **Password Storage**: Passwords are hashed using bcrypt before storage.
5. **Account Deactivation**: Instead of deleting users, consider deactivating them by setting `isActive: false`.

## User Management Workflow

### Creating Users

Admins can create users through the API:

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "TempPassword123!",
    "firstName": "New",
    "lastName": "User",
    "role": "user"
  }'
```

The admin should communicate the password to the new user securely (in person, phone, encrypted message, etc.). The user can then change their password using the `/api/auth/change-password` endpoint.

### Resetting Passwords

If a user forgets their password, an admin can reset it:

```bash
curl -X PUT http://localhost:3001/api/users/<user-id> \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "NewTempPassword123!"
  }'
```

The admin should communicate the new password to the user securely.

## Troubleshooting

### "User not found" after migration

Make sure you've created at least one admin user using the `scripts/create-admin.js` script.

### "Invalid or expired token"

The token may have expired (7 day lifetime). Log in again to get a new token.

### Permission errors

Make sure the database user has the correct permissions. Run:

```bash
psql -U postgres -d invoice_tracker -c "GRANT ALL PRIVILEGES ON users TO invoice_tracker_user;"
```
