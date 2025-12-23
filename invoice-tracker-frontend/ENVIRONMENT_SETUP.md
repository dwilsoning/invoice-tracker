# Environment Setup Guide

The Invoice Tracker frontend uses environment variables to distinguish between local test and production EC2 environments.

## Environment Indicator

When running in **TEST/DEVELOPMENT** mode, a yellow "TEST ENVIRONMENT" badge will appear in the header with a pulsing animation to clearly indicate you're not on production.

## How It Works

**Default Behavior**: If `VITE_ENVIRONMENT` is **not set**, the application assumes it's running in **production** (no TEST badge).

**Development Mode**: Only when explicitly set to `development` will the TEST badge appear.

This approach ensures:
- Production is the safe default
- No configuration needed on EC2
- Only local environment needs setup

## Local Development Setup

1. Create a `.env` file in the frontend directory (already created for you):
   ```
   VITE_API_URL=http://localhost:3001
   VITE_ENVIRONMENT=development
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. You'll see the **TEST ENVIRONMENT** badge in the header.

## Production (EC2) Setup

**No `.env` file needed!**

The application will automatically default to production mode when `VITE_ENVIRONMENT` is not set.

1. Simply build and deploy:
   ```bash
   npm run build
   ```

2. The production build will **NOT** show the "TEST ENVIRONMENT" badge.

3. (Optional) If you need to configure the API URL on EC2, you can create a `.env` file with just:
   ```
   VITE_API_URL=http://your-ec2-ip:3001
   ```
   (Do NOT include `VITE_ENVIRONMENT` - leave it unset for production)

## Environment Variables

| Variable | Purpose | Default | Local Value |
|----------|---------|---------|-------------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001` | `http://localhost:3001` |
| `VITE_ENVIRONMENT` | Environment type | Unset (production) | `development` |

## Visual Indicators

- **Local/Test**: Yellow pulsing "TEST ENVIRONMENT" badge in header
- **Production**: No badge, clean interface
- **Both**: Version number and edition name displayed

## Notes

- The `.env` file is gitignored and won't be committed to the repository
- Production EC2 does **not** need a `.env` file
- If `VITE_ENVIRONMENT` is unset or set to anything other than `development`, it's treated as production
