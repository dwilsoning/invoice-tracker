# Invoice Tracker - Cloud Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Azure Deployment (Recommended)](#azure-deployment)
4. [AWS Deployment (Alternative)](#aws-deployment)
5. [Database Migration](#database-migration)
6. [Environment Configuration](#environment-configuration)
7. [Frontend Deployment](#frontend-deployment)
8. [Post-Deployment Testing](#post-deployment-testing)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Rollback Procedures](#rollback-procedures)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying the Invoice Tracker application to a cloud environment. The application consists of:

- **Backend**: Node.js/Express API with PostgreSQL database
- **Frontend**: React application
- **Storage**: PDF file storage for invoice documents
- **Database**: PostgreSQL 14+ with invoice and exchange rate data

**Architecture:**
```
[React Frontend] → [Node.js Backend API] → [PostgreSQL Database]
                                        ↓
                                [Blob/S3 Storage for PDFs]
```

---

## Prerequisites

### Required Software
- Node.js 16.x or higher
- PostgreSQL 14.x or higher
- Git
- Azure CLI (for Azure) or AWS CLI (for AWS)
- npm or yarn package manager

### Access Requirements
- Azure subscription with appropriate permissions (or AWS account)
- Domain name (optional, for custom URL)
- SSL certificate (can be generated via Let's Encrypt)

### Before You Begin
1. ✅ Export all data from development PostgreSQL database
2. ✅ Test the application locally with PostgreSQL
3. ✅ Document all environment variables
4. ✅ Backup all invoice PDFs
5. ✅ Review and update `package.json` dependencies

---

## Azure Deployment (Recommended)

### Option 1: Azure App Service + Azure Database for PostgreSQL

#### Step 1: Create Azure Resources

**1.1 Create Resource Group**
```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name invoice-tracker-rg \
  --location eastus
```

**1.2 Create PostgreSQL Database**
```bash
# Create Azure Database for PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db \
  --location eastus \
  --admin-user invoiceadmin \
  --admin-password <STRONG_PASSWORD> \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 14

# Configure firewall to allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create the database
az postgres flexible-server db create \
  --resource-group invoice-tracker-rg \
  --server-name invoice-tracker-db \
  --database-name invoice_tracker
```

**1.3 Create Storage Account for PDFs**
```bash
# Create storage account
az storage account create \
  --name invoicetrackerstore \
  --resource-group invoice-tracker-rg \
  --location eastus \
  --sku Standard_LRS

# Create blob container for invoices
az storage container create \
  --name invoice-pdfs \
  --account-name invoicetrackerstore \
  --public-access off
```

**1.4 Create App Service for Backend**
```bash
# Create App Service Plan
az appservice plan create \
  --name invoice-tracker-plan \
  --resource-group invoice-tracker-rg \
  --location eastus \
  --sku B1 \
  --is-linux

# Create Web App for Backend
az webapp create \
  --resource-group invoice-tracker-rg \
  --plan invoice-tracker-plan \
  --name invoice-tracker-api \
  --runtime "NODE|18-lts"
```

**1.5 Create Static Web App for Frontend**
```bash
# Create Static Web App
az staticwebapp create \
  --name invoice-tracker-frontend \
  --resource-group invoice-tracker-rg \
  --location eastus
```

#### Step 2: Configure Backend Environment Variables

```bash
# Set environment variables for the backend Web App
az webapp config appsettings set \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api \
  --settings \
    DB_USER=invoiceadmin \
    DB_PASSWORD=<STRONG_PASSWORD> \
    DB_HOST=invoice-tracker-db.postgres.database.azure.com \
    DB_PORT=5432 \
    DB_NAME=invoice_tracker \
    PORT=8080 \
    NODE_ENV=production \
    AZURE_STORAGE_CONNECTION_STRING=<CONNECTION_STRING>
```

To get the storage connection string:
```bash
az storage account show-connection-string \
  --name invoicetrackerstore \
  --resource-group invoice-tracker-rg
```

#### Step 3: Deploy Backend Code

**3.1 Prepare Backend for Deployment**

Create a `.deployment` file in the backend root:
```
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

Create a `web.config` file in the backend root:
```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="server.js"/>
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <remove segment="bin"/>
        </hiddenSegments>
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
```

**3.2 Deploy Backend**
```bash
cd /path/to/Invoice-tracker-backend

# Install dependencies
npm install --production

# Create deployment zip
zip -r deploy.zip . -x "*.git*" -x "node_modules/*" -x "invoice_pdfs/*"

# Deploy to Azure
az webapp deployment source config-zip \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api \
  --src deploy.zip
```

#### Step 4: Deploy Frontend

**4.1 Update Frontend API URL**

Edit `invoice-tracker-frontend/src/App.jsx`:
```javascript
// Change API_URL to point to Azure backend
const API_URL = process.env.REACT_APP_API_URL || 'https://invoice-tracker-api.azurewebsites.net/api';
```

Create `.env.production` in frontend root:
```
REACT_APP_API_URL=https://invoice-tracker-api.azurewebsites.net/api
```

**4.2 Build and Deploy Frontend**
```bash
cd /path/to/invoice-tracker-frontend

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Static Web App
az staticwebapp deploy \
  --name invoice-tracker-frontend \
  --resource-group invoice-tracker-rg \
  --app-location ./build
```

---

## AWS Deployment (Alternative)

### Option 1: Elastic Beanstalk + RDS

#### Step 1: Create RDS PostgreSQL Instance

**1.1 Via AWS Console:**
1. Navigate to RDS → Create Database
2. Choose PostgreSQL 14.x
3. Select template: Production or Dev/Test
4. Settings:
   - DB instance identifier: `invoice-tracker-db`
   - Master username: `invoiceadmin`
   - Master password: (set strong password)
5. Instance configuration: db.t3.micro (for dev) or db.t3.medium (production)
6. Storage: 50 GB, enable autoscaling
7. VPC: Default or create new
8. Public access: Yes (or configure VPN)
9. VPC security group: Create new or use existing
10. Database name: `invoice_tracker`
11. Backup retention: 7 days
12. Create database

**1.2 Configure Security Group**
- Add inbound rule: PostgreSQL (5432) from your IP
- Add inbound rule: PostgreSQL (5432) from Elastic Beanstalk security group

#### Step 2: Create S3 Bucket for PDFs

```bash
# Create S3 bucket
aws s3 mb s3://invoice-tracker-pdfs --region us-east-1

# Set bucket policy for private access
aws s3api put-bucket-policy \
  --bucket invoice-tracker-pdfs \
  --policy file://bucket-policy.json
```

**bucket-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PrivateAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/aws-elasticbeanstalk-ec2-role"
      },
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::invoice-tracker-pdfs",
        "arn:aws:s3:::invoice-tracker-pdfs/*"
      ]
    }
  ]
}
```

#### Step 3: Deploy Backend with Elastic Beanstalk

**3.1 Initialize Elastic Beanstalk**
```bash
cd /path/to/Invoice-tracker-backend

# Initialize EB
eb init -p node.js-18 invoice-tracker-api --region us-east-1

# Create environment
eb create invoice-tracker-prod \
  --instance-type t3.small \
  --envvars \
    DB_USER=invoiceadmin,\
    DB_PASSWORD=<STRONG_PASSWORD>,\
    DB_HOST=<RDS_ENDPOINT>,\
    DB_PORT=5432,\
    DB_NAME=invoice_tracker,\
    NODE_ENV=production,\
    AWS_REGION=us-east-1,\
    S3_BUCKET=invoice-tracker-pdfs
```

**3.2 Deploy Backend**
```bash
eb deploy
```

#### Step 4: Deploy Frontend to S3 + CloudFront

**4.1 Create S3 Bucket for Frontend**
```bash
aws s3 mb s3://invoice-tracker-frontend --region us-east-1

# Enable static website hosting
aws s3 website s3://invoice-tracker-frontend \
  --index-document index.html \
  --error-document index.html
```

**4.2 Build and Upload Frontend**
```bash
cd /path/to/invoice-tracker-frontend

# Update API URL
echo "REACT_APP_API_URL=http://invoice-tracker-prod.us-east-1.elasticbeanstalk.com/api" > .env.production

# Build
npm run build

# Upload to S3
aws s3 sync ./build s3://invoice-tracker-frontend --delete

# Set public read access
aws s3api put-bucket-policy \
  --bucket invoice-tracker-frontend \
  --policy file://frontend-policy.json
```

**4.3 Create CloudFront Distribution (Optional)**
```bash
aws cloudfront create-distribution \
  --origin-domain-name invoice-tracker-frontend.s3.amazonaws.com \
  --default-root-object index.html
```

---

## Database Migration

### Step 1: Export Data from Local PostgreSQL

```bash
# Export schema
pg_dump -h localhost -U postgres -d invoice_tracker --schema-only -f schema.sql

# Export data
pg_dump -h localhost -U postgres -d invoice_tracker --data-only -f data.sql

# Or export everything
pg_dump -h localhost -U postgres -d invoice_tracker -f full_backup.sql
```

### Step 2: Import to Cloud PostgreSQL

**For Azure:**
```bash
# Get connection string
psql "host=invoice-tracker-db.postgres.database.azure.com port=5432 dbname=invoice_tracker user=invoiceadmin password=<PASSWORD> sslmode=require"

# Import schema
psql "host=invoice-tracker-db.postgres.database.azure.com port=5432 dbname=invoice_tracker user=invoiceadmin password=<PASSWORD> sslmode=require" < schema.sql

# Import data
psql "host=invoice-tracker-db.postgres.database.azure.com port=5432 dbname=invoice_tracker user=invoiceadmin password=<PASSWORD> sslmode=require" < data.sql
```

**For AWS RDS:**
```bash
# Connect to RDS
psql -h <RDS_ENDPOINT> -U invoiceadmin -d invoice_tracker

# Import
psql -h <RDS_ENDPOINT> -U invoiceadmin -d invoice_tracker < full_backup.sql
```

### Step 3: Verify Data Migration

```sql
-- Check invoice count
SELECT COUNT(*) FROM invoices;

-- Check date ranges
SELECT MIN(invoice_date), MAX(invoice_date) FROM invoices;

-- Check clients
SELECT COUNT(DISTINCT client) FROM invoices;

-- Verify exchange rates
SELECT COUNT(*) FROM exchange_rates;
```

### Step 4: Migrate PDF Files

**For Azure Blob Storage:**
```bash
# Upload PDFs to Azure Blob Storage
az storage blob upload-batch \
  --account-name invoicetrackerstore \
  --destination invoice-pdfs \
  --source ./invoice_pdfs
```

**For AWS S3:**
```bash
# Upload PDFs to S3
aws s3 sync ./invoice_pdfs s3://invoice-tracker-pdfs/
```

### Step 5: Update Database PDF Paths

```sql
-- For Azure Blob Storage
UPDATE invoices
SET pdf_path = REPLACE(pdf_path, './invoice_pdfs/', 'https://invoicetrackerstore.blob.core.windows.net/invoice-pdfs/');

-- For AWS S3
UPDATE invoices
SET pdf_path = REPLACE(pdf_path, './invoice_pdfs/', 'https://invoice-tracker-pdfs.s3.amazonaws.com/');
```

---

## Environment Configuration

### Backend Environment Variables

Create a `.env` file or configure via cloud provider:

```bash
# Database Configuration
DB_USER=invoiceadmin
DB_PASSWORD=<STRONG_PASSWORD>
DB_HOST=<DATABASE_ENDPOINT>
DB_PORT=5432
DB_NAME=invoice_tracker

# Server Configuration
PORT=8080
NODE_ENV=production

# Azure Storage (if using Azure)
AZURE_STORAGE_CONNECTION_STRING=<CONNECTION_STRING>
AZURE_STORAGE_CONTAINER=invoice-pdfs

# AWS S3 (if using AWS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<ACCESS_KEY>
AWS_SECRET_ACCESS_KEY=<SECRET_KEY>
S3_BUCKET=invoice-tracker-pdfs

# CORS Configuration (adjust for your frontend domain)
ALLOWED_ORIGINS=https://invoice-tracker-frontend.azurestaticapps.net,https://your-custom-domain.com
```

### Frontend Environment Variables

Create `.env.production`:

```bash
REACT_APP_API_URL=https://invoice-tracker-api.azurewebsites.net/api
# Or for AWS: http://invoice-tracker-prod.us-east-1.elasticbeanstalk.com/api
```

---

## Post-Deployment Testing

### Checklist

#### Backend API Testing
```bash
# Test health endpoint
curl https://invoice-tracker-api.azurewebsites.net/health

# Test invoices endpoint
curl https://invoice-tracker-api.azurewebsites.net/api/invoices

# Test exchange rates
curl https://invoice-tracker-api.azurewebsites.net/api/exchange-rates
```

#### Frontend Testing
1. ✅ Navigate to frontend URL
2. ✅ Verify invoices load correctly
3. ✅ Test file upload functionality
4. ✅ Test PDF viewing
5. ✅ Test analytics page
6. ✅ Verify filters work
7. ✅ Test natural language search
8. ✅ Check production mode (after Nov 1, 2025)

#### Database Testing
```sql
-- Verify all tables exist
\dt

-- Check row counts
SELECT
  'invoices' as table_name, COUNT(*) as row_count FROM invoices
UNION ALL
SELECT
  'exchange_rates', COUNT(*) FROM exchange_rates;

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM invoices WHERE status = 'Pending';
```

#### Integration Testing
1. ✅ Upload a test invoice PDF
2. ✅ Verify it appears in the database
3. ✅ Verify PDF is accessible
4. ✅ Test invoice editing
5. ✅ Test invoice deletion
6. ✅ Verify analytics update

---

## Monitoring and Maintenance

### Azure Monitoring

**Application Insights:**
```bash
# Enable Application Insights
az monitor app-insights component create \
  --app invoice-tracker-insights \
  --location eastus \
  --resource-group invoice-tracker-rg \
  --application-type web

# Link to Web App
az webapp config appsettings set \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=<INSTRUMENTATION_KEY>
```

**Database Monitoring:**
- Navigate to Azure Portal → PostgreSQL Server → Monitoring
- Set up alerts for:
  - High CPU usage (> 80%)
  - High memory usage (> 80%)
  - Failed connections
  - Slow queries (> 5 seconds)

### AWS Monitoring

**CloudWatch:**
```bash
# Enable detailed monitoring
aws elasticbeanstalk update-environment \
  --environment-name invoice-tracker-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:healthreporting:system,OptionName=SystemType,Value=enhanced
```

**RDS Monitoring:**
- Enable Enhanced Monitoring
- Set up CloudWatch alarms for:
  - High CPU (> 80%)
  - Low storage space (< 10 GB)
  - High connection count
  - Slow query logs

### Backup Strategy

**Daily Automated Backups:**

**Azure:**
```bash
# Backups are automatic, but you can create on-demand backup
az postgres flexible-server backup create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db \
  --backup-name manual-backup-$(date +%Y%m%d)
```

**AWS:**
```bash
# Create snapshot
aws rds create-db-snapshot \
  --db-instance-identifier invoice-tracker-db \
  --db-snapshot-identifier invoice-tracker-snapshot-$(date +%Y%m%d)
```

### Maintenance Windows

Schedule weekly maintenance:
- **Azure**: Portal → PostgreSQL Server → Maintenance window
- **AWS**: RDS Console → Maintenance window

Recommended: Sunday 2:00 AM - 4:00 AM (your timezone)

---

## Rollback Procedures

### Emergency Rollback Steps

**If Backend Deployment Fails:**

**Azure:**
```bash
# Get previous deployment
az webapp deployment list \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api

# Rollback to previous version
az webapp deployment slot swap \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api \
  --slot production \
  --target-slot staging
```

**AWS:**
```bash
# Rollback Elastic Beanstalk
eb deploy --version <PREVIOUS_VERSION_LABEL>
```

**If Database Migration Fails:**
```bash
# Restore from backup
# Azure:
az postgres flexible-server restore \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db-restored \
  --source-server invoice-tracker-db \
  --restore-time "2025-10-27T00:00:00Z"

# AWS:
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier invoice-tracker-db-restored \
  --db-snapshot-identifier invoice-tracker-snapshot-20251027
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Database Connection Failures

**Symptoms:**
- Backend returns 500 errors
- Logs show "ECONNREFUSED" or "Connection timeout"

**Solutions:**
1. Check database firewall rules
2. Verify environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)
3. Test connection manually:
   ```bash
   psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME>
   ```
4. Check if database is running
5. Verify SSL/TLS requirements (Azure requires `sslmode=require`)

#### Issue 2: CORS Errors

**Symptoms:**
- Frontend shows network errors
- Browser console: "CORS policy blocked"

**Solutions:**
1. Update backend CORS configuration in `server.js`:
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: [
       'https://invoice-tracker-frontend.azurestaticapps.net',
       'https://your-domain.com'
     ],
     credentials: true
   }));
   ```
2. Clear browser cache
3. Verify frontend is making requests to correct API URL

#### Issue 3: PDF Upload Failures

**Symptoms:**
- File upload returns error
- PDFs don't appear after upload

**Solutions:**
1. Check storage account permissions
2. Verify environment variables for storage
3. Check file size limits (increase if needed)
4. Verify storage connection string is correct

#### Issue 4: Performance Issues

**Symptoms:**
- Slow page loads
- Timeouts on analytics page

**Solutions:**
1. Add database indexes:
   ```sql
   CREATE INDEX idx_invoices_status ON invoices(status);
   CREATE INDEX idx_invoices_date ON invoices(invoice_date);
   CREATE INDEX idx_invoices_client ON invoices(client);
   CREATE INDEX idx_invoices_due_date ON invoices(due_date);
   ```
2. Scale up database tier
3. Enable caching for exchange rates
4. Optimize slow queries (use EXPLAIN ANALYZE)

#### Issue 5: Production Mode Not Working

**Symptoms:**
- Production mode shows old data
- Toggle buttons still visible after Nov 1

**Solutions:**
1. Clear browser cache
2. Check system date/time is correct
3. Verify frontend build has latest code:
   ```bash
   npm run build
   # Re-deploy
   ```

---

## Security Best Practices

### 1. Database Security
- ✅ Use strong passwords (minimum 16 characters, mix of upper/lower/numbers/symbols)
- ✅ Enable SSL/TLS for database connections
- ✅ Restrict database access to specific IP ranges
- ✅ Enable audit logging
- ✅ Regular security updates

### 2. Application Security
- ✅ Store secrets in Azure Key Vault or AWS Secrets Manager
- ✅ Enable HTTPS only (disable HTTP)
- ✅ Implement rate limiting
- ✅ Regular dependency updates (`npm audit`)
- ✅ Enable application firewall (WAF)

### 3. Storage Security
- ✅ Private blob/bucket access
- ✅ Generate time-limited SAS tokens for PDF access
- ✅ Enable encryption at rest
- ✅ Enable versioning for backups

### 4. Network Security
- ✅ Use VNet/VPC for database isolation
- ✅ Configure network security groups
- ✅ Enable DDoS protection
- ✅ Use private endpoints where possible

---

## Support and Resources

### Azure Resources
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for PostgreSQL](https://docs.microsoft.com/azure/postgresql/)
- [Azure Blob Storage](https://docs.microsoft.com/azure/storage/blobs/)

### AWS Resources
- [Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [Amazon RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Amazon S3 Documentation](https://docs.aws.amazon.com/s3/)

### PostgreSQL Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgAdmin](https://www.pgadmin.org/) - Database management tool

---

## Appendix A: Cost Estimates

### Azure Monthly Costs (Approximate)

| Resource | Tier | Cost (USD/month) |
|----------|------|------------------|
| App Service | B1 Basic | $13 |
| PostgreSQL Flexible Server | Standard_B2s | $30 |
| Blob Storage | 50 GB | $1 |
| Static Web App | Free tier | $0 |
| **Total** | | **~$44/month** |

### AWS Monthly Costs (Approximate)

| Resource | Tier | Cost (USD/month) |
|----------|------|------------------|
| Elastic Beanstalk | t3.small | $15 |
| RDS PostgreSQL | db.t3.micro | $15 |
| S3 Storage | 50 GB | $1 |
| CloudFront | 10 GB transfer | $1 |
| **Total** | | **~$32/month** |

*Note: Costs are estimates and may vary based on usage, region, and current pricing.*

---

## Appendix B: Database Schema

```sql
-- Invoices table
CREATE TABLE invoices (
    id VARCHAR(255) PRIMARY KEY,
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    invoice_date DATE,
    client VARCHAR(255),
    customer_contract VARCHAR(255),
    oracle_contract VARCHAR(255),
    po_number VARCHAR(255),
    invoice_type VARCHAR(100),
    amount_due NUMERIC(15, 2),
    currency VARCHAR(10),
    due_date DATE,
    status VARCHAR(50),
    payment_date DATE,
    frequency VARCHAR(50),
    upload_date DATE,
    services TEXT,
    pdf_path VARCHAR(500),
    pdf_original_name VARCHAR(255),
    contract_value NUMERIC(15, 2),
    contract_currency VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exchange rates table
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    rate NUMERIC(15, 6) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, date)
);

-- Expected invoices table
CREATE TABLE expected_invoices (
    id SERIAL PRIMARY KEY,
    client VARCHAR(255) NOT NULL,
    expected_amount NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    expected_date DATE,
    frequency VARCHAR(50),
    notes TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_client ON invoices(client);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
```

---

## Appendix C: Pre-Deployment Checklist

### Code Preparation
- [ ] All dependencies updated and tested
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] CORS configured for production domain
- [ ] Error logging configured
- [ ] Production build tested locally

### Data Preparation
- [ ] Database backup created
- [ ] PDF files organized and ready
- [ ] Test data cleaned (if needed)
- [ ] Exchange rates up to date

### Cloud Infrastructure
- [ ] Resource group/account created
- [ ] Database provisioned and tested
- [ ] Storage account/bucket created
- [ ] Firewall rules configured
- [ ] SSL certificates obtained

### Security
- [ ] Strong passwords generated
- [ ] Secrets stored securely
- [ ] Access controls configured
- [ ] Backup strategy defined
- [ ] Monitoring alerts configured

### Testing
- [ ] API endpoints tested
- [ ] Frontend tested with production API
- [ ] PDF upload/download tested
- [ ] Analytics tested
- [ ] Production mode verified (after Nov 1)

### Documentation
- [ ] Deployment guide reviewed
- [ ] Runbook created for operations team
- [ ] Support contacts documented
- [ ] Rollback procedures tested

---

**Document Version:** 1.0
**Last Updated:** October 27, 2025
**Author:** Invoice Tracker Development Team
**Contact:** finance.support@alterahealth.com
