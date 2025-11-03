# Authentication API Reference

Quick reference guide for all authentication and user management endpoints.

## Authentication Flow

### 1. Login Flow
```
User enters credentials
    ↓
POST /api/auth/login
    ↓
Receive JWT token
    ↓
Store token in frontend (localStorage/cookie)
    ↓
Include token in Authorization header for protected requests
```

### 2. Password Reset Flow
```
User requests password reset
    ↓
POST /api/auth/request-password-reset
    ↓
Email sent with reset token
    ↓
User clicks link in email
    ↓
POST /api/auth/reset-password with token
    ↓
Password updated
```

## Base URL

All endpoints are relative to your API base URL (default: `http://localhost:3001`)

## Authentication Header

For protected endpoints, include the JWT token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Public Endpoints

### Login

**POST** `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

**Errors:**
- `400` - Email and password are required
- `401` - Invalid email or password
- `403` - Account is inactive

---

### Request Password Reset

**POST** `/api/auth/request-password-reset`

Request a password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Note:** Always returns success to prevent email enumeration.

---

### Reset Password

**POST** `/api/auth/reset-password`

Reset password using a token from email.

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0...",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "message": "Password has been reset successfully"
}
```

**Errors:**
- `400` - Token and new password are required
- `400` - Password doesn't meet requirements
- `400` - Invalid or expired reset token

---

## Protected Endpoints (Require Authentication)

### Verify Token

**GET** `/api/auth/verify`

Verify if the current token is valid and get user info.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

**Errors:**
- `401` - Access token required
- `403` - Invalid or expired token

---

### Change Password

**POST** `/api/auth/change-password`

Change password for the authenticated user.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
- `401` - Authentication required / Current password is incorrect
- `400` - Password doesn't meet requirements

---

### Get My Profile

**GET** `/api/users/profile/me`

Get the current user's profile.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "lastLogin": "2025-11-03T10:30:00Z",
    "createdAt": "2025-11-01T08:00:00Z"
  }
}
```

---

### Update My Profile

**PUT** `/api/users/profile/me`

Update the current user's profile.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "newemail@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "isActive": true,
    "lastLogin": "2025-11-03T10:30:00Z",
    "createdAt": "2025-11-01T08:00:00Z"
  }
}
```

**Errors:**
- `400` - Invalid email format / No fields to update
- `409` - Email already in use

---

## Admin-Only Endpoints

All endpoints below require `role: "admin"`.

### List All Users

**GET** `/api/users`

Get a list of all users.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Response (200):**
```json
{
  "users": [
    {
      "id": "user_1699123456789_abc123",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin",
      "isActive": true,
      "lastLogin": "2025-11-03T10:30:00Z",
      "createdAt": "2025-11-01T08:00:00Z"
    },
    {
      "id": "user_1699123456790_def456",
      "email": "user@example.com",
      "firstName": "Regular",
      "lastName": "User",
      "role": "user",
      "isActive": true,
      "lastLogin": "2025-11-03T09:15:00Z",
      "createdAt": "2025-11-02T14:00:00Z"
    }
  ]
}
```

---

### Get User by ID

**GET** `/api/users/:id`

Get details of a specific user.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "lastLogin": "2025-11-03T10:30:00Z",
    "createdAt": "2025-11-01T08:00:00Z"
  }
}
```

**Errors:**
- `404` - User not found

---

### Create User

**POST** `/api/users`

Create a new user.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "TempPassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "user",
  "sendEmail": true
}
```

**Fields:**
- `email` (required) - User's email address
- `password` (required) - Initial password
- `firstName` (optional) - User's first name
- `lastName` (optional) - User's last name
- `role` (optional) - "admin" or "user" (default: "user")
- `sendEmail` (optional) - Send welcome email with credentials (default: false)

**Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "user_1699123456791_ghi789",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-11-03T11:00:00Z"
  }
}
```

**Errors:**
- `400` - Email is required / Invalid email / Password required / Invalid role
- `400` - Password doesn't meet requirements
- `409` - User with this email already exists

---

### Update User

**PUT** `/api/users/:id`

Update a user's information.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Request:**
```json
{
  "firstName": "UpdatedName",
  "role": "admin",
  "isActive": false,
  "password": "NewPassword123!"
}
```

**Fields (all optional):**
- `email` - New email address
- `firstName` - New first name
- `lastName` - New last name
- `role` - "admin" or "user"
- `isActive` - true or false
- `password` - New password

**Response (200):**
```json
{
  "message": "User updated successfully",
  "user": {
    "id": "user_1699123456789_abc123",
    "email": "user@example.com",
    "firstName": "UpdatedName",
    "lastName": "Doe",
    "role": "admin",
    "isActive": false,
    "lastLogin": "2025-11-03T10:30:00Z",
    "createdAt": "2025-11-01T08:00:00Z"
  }
}
```

**Errors:**
- `404` - User not found
- `400` - Invalid email / Invalid role / No fields to update
- `400` - Password doesn't meet requirements
- `409` - Email already in use

---

### Delete User

**DELETE** `/api/users/:id`

Delete a user account.

**Headers:**
```
Authorization: Bearer {admin-token}
```

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```

**Errors:**
- `404` - User not found
- `400` - Cannot delete your own account

---

## Password Requirements

All passwords must meet these requirements:

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

Example valid passwords:
- `Password123!`
- `MySecure2025Pass`
- `Admin@Invoice42`

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required or failed)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

## Frontend Integration Example

### React/JavaScript Example

```javascript
// Login
async function login(email, password) {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  // Store token
  localStorage.setItem('token', data.token);
  return data.user;
}

// Make authenticated request
async function getInvoices() {
  const token = localStorage.getItem('token');

  const response = await fetch('http://localhost:3001/api/invoices', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid - redirect to login
      window.location.href = '/login';
      return;
    }
    throw new Error('Failed to fetch invoices');
  }

  return response.json();
}
```

## Token Expiration

- JWT tokens expire after **7 days** by default
- Password reset tokens expire after **1 hour**
- When a token expires, the user must log in again
- Frontend should handle 401/403 errors and redirect to login

## Security Notes

1. Always use HTTPS in production
2. Store JWT tokens securely (httpOnly cookies recommended)
3. Implement token refresh if needed for longer sessions
4. Never expose JWT_SECRET
5. Use strong passwords and encourage 2FA for production
6. Rotate JWT_SECRET periodically in production
7. Monitor for suspicious login attempts
