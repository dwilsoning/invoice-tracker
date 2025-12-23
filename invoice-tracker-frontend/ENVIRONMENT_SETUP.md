# Environment Setup Guide

The Invoice Tracker frontend uses environment variables to distinguish between local test and production EC2 environments.

## Environment Indicator

When running in **TEST/DEVELOPMENT** mode, a yellow "TEST ENVIRONMENT" badge will appear in the header with a pulsing animation to clearly indicate you're not on production.

## Local Development Setup

1. The `.env` file is already configured for local development:
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

1. On your EC2 instance, create a `.env.production` file in the frontend directory:
   ```bash
   cd /path/to/invoice-tracker-frontend
   nano .env.production
   ```

2. Add the following content (update the URL to match your EC2 instance):
   ```
   VITE_API_URL=http://your-ec2-ip:3001
   VITE_ENVIRONMENT=production
   ```

3. Build the production version:
   ```bash
   npm run build
   ```

4. The production build will **NOT** show the "TEST ENVIRONMENT" badge.

## Environment Variables

| Variable | Purpose | Values |
|----------|---------|--------|
| `VITE_API_URL` | Backend API URL | Local: `http://localhost:3001`<br>EC2: `http://your-ec2-ip:3001` |
| `VITE_ENVIRONMENT` | Environment type | `development` or `production` |

## Visual Indicators

- **Local/Test**: Yellow pulsing "TEST ENVIRONMENT" badge in header
- **Production**: No badge, clean interface
- **Both**: Version number and edition name displayed

## Notes

- The `.env` file is gitignored and won't be committed to the repository
- The `.env.production` file is included as a template
- Remember to update the EC2 IP address in `.env.production` before deploying
