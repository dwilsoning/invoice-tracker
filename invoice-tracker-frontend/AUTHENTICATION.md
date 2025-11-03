# Frontend Authentication

The Invoice Tracker frontend now includes a complete authentication system with login, user management, and role-based access control.

## Features

- **Login Screen**: Users must log in before accessing the application
- **User Menu**: Access to profile, password change, and logout in the top-right corner
- **User Management**: Admin users can create, edit, and delete users
- **Change Password**: Users can change their own password
- **Auto-logout**: Invalid or expired tokens automatically redirect to login
- **Protected Routes**: All pages require authentication

## User Interface

### Login Page
- Clean, modern login interface
- Email and password fields
- Error messaging for failed logins

### Header
Located at the top of every page when logged in:
- User email and avatar displayed
- Dropdown menu with:
  - User information (email, name, role)
  - **Manage Users** (admin only)
  - **Change Password**
  - **Sign Out**

### User Management (Admin Only)
Admins can access user management from the header menu:
- View all users in a table
- Create new users with email, password, name, and role
- Edit existing users (update info, reset passwords, change roles)
- Activate/deactivate users
- Delete users (except yourself)

## Default Login

Use the admin account created during backend setup:

```
Email: admin@invoicetracker.local
Password: AdminPass123!
```

(Or whatever credentials you used when running the create-admin script)

## For Users

### First Time Login
1. Your administrator will provide you with:
   - Email address
   - Temporary password
2. Log in with these credentials
3. Click your email in the top-right corner
4. Select "Change Password"
5. Enter your current (temporary) password and choose a new one

### Changing Your Password
1. Click your email in the top-right corner
2. Select "Change Password"
3. Enter:
   - Current password
   - New password (must meet requirements)
   - Confirm new password
4. Click "Change Password"

Password requirements:
- At least 8 characters
- Contains uppercase letter
- Contains lowercase letter
- Contains number
- Contains special character

### Signing Out
1. Click your email in the top-right corner
2. Select "Sign Out"

## For Administrators

### Creating New Users
1. Click your email in the top-right corner
2. Select "Manage Users"
3. Click "+ Create New User"
4. Fill in:
   - Email (required)
   - Password (required) - Give this to the user securely
   - First Name (optional)
   - Last Name (optional)
   - Role (User or Admin)
   - Status (Active or Inactive)
5. Click "Create User"
6. Communicate the credentials to the user securely

### Editing Users
1. Open "Manage Users"
2. Click "Edit" on the user you want to modify
3. Update any fields:
   - Email
   - Password (leave blank to keep current)
   - Name
   - Role
   - Status
4. Click "Update User"

### Resetting a User's Password
1. Open "Manage Users"
2. Click "Edit" on the user
3. Enter a new password
4. Click "Update User"
5. Communicate the new password to the user securely

### Deactivating vs Deleting Users
- **Deactivate**: Set Status to "Inactive" - preserves user data, prevents login
- **Delete**: Permanently removes the user - cannot be undone

## Technical Details

### Authentication Flow
1. User enters credentials on login page
2. Frontend sends POST request to `/api/auth/login`
3. Backend validates and returns JWT token
4. Token is stored in localStorage
5. Token is included in all subsequent API requests via Authorization header
6. Token is verified on page load to maintain session

### Token Management
- Tokens expire after 7 days
- Expired tokens automatically trigger logout
- Tokens are cleared on logout
- Invalid tokens redirect to login page

### Components

- `AuthContext.jsx` - Authentication state management
- `Login.jsx` - Login page component
- `Header.jsx` - Top navigation with user menu
- `UserManagement.jsx` - Admin interface for managing users
- `ChangePassword.jsx` - Password change modal

### Protected Access
The entire application is protected - users must be logged in to access any page. The App component checks authentication status and shows:
- Login page if not authenticated
- Full application if authenticated
- Loading screen while checking auth status

## Troubleshooting

### Can't Login
- Verify email and password are correct
- Check that your account is Active (ask an admin)
- Ensure the backend server is running
- Check browser console for errors

### Locked Out
- Contact an administrator to reset your password
- Administrator can log in and reset your password via User Management

### Token Expired
- Simply log in again to get a new token
- Tokens last 7 days from login

## Security Best Practices

1. **Strong Passwords**: Enforce password requirements
2. **Secure Communication**: Share passwords in person or via secure channels
3. **Regular Password Changes**: Encourage users to change passwords periodically
4. **Deactivate Unused Accounts**: Disable accounts for users who no longer need access
5. **Admin Accounts**: Limit the number of admin accounts
6. **HTTPS**: Use HTTPS in production to protect tokens in transit
