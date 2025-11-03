# Invoice Tracker - Azure Deployment Guide

Complete step-by-step guide for deploying Invoice Tracker to Microsoft Azure.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure Setup](#azure-setup)
3. [Azure App Service Deployment](#azure-app-service-deployment)
4. [Azure Database for PostgreSQL](#azure-database-for-postgresql)
5. [Azure Blob Storage](#azure-blob-storage)
6. [Data Migration](#data-migration)
7. [SSL & Custom Domain](#ssl--custom-domain)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### Required
- Azure account with active subscription
- Azure CLI installed
- Local PostgreSQL with data
- Git installed
- Node.js 18.x

### Estimated Monthly Costs
- App Service (B1 Basic): ~$13/month
- PostgreSQL (B_Gen5_1): ~$25/month
- Blob Storage: ~$1-5/month
- **Total: ~$40-45/month**

---

## Azure Setup

### Step 1: Install Azure CLI

**Windows:**
```powershell
# Download from: https://aka.ms/installazurecliwindows
# Run the installer
az --version
```

**Linux/WSL:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az --version
```

**macOS:**
```bash
brew install azure-cli
az --version
```

### Step 2: Login to Azure

```bash
az login
# Opens browser for authentication

# Set subscription (if multiple)
az account list --output table
az account set --subscription "Your-Subscription-Name"
```

### Step 3: Create Resource Group

```bash
# Create resource group
az group create \
  --name invoice-tracker-rg \
  --location eastus

# Verify
az group show --name invoice-tracker-rg
```

---

## Azure App Service Deployment

### Step 1: Create App Service Plan

```bash
# Create Linux-based App Service Plan
az appservice plan create \
  --name invoice-tracker-plan \
  --resource-group invoice-tracker-rg \
  --location eastus \
  --is-linux \
  --sku B1
```

### Step 2: Create Web Apps

**Backend API:**
```bash
az webapp create \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --plan invoice-tracker-plan \
  --runtime "NODE|18-lts"
```

**Frontend:**
```bash
az webapp create \
  --name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --plan invoice-tracker-plan \
  --runtime "NODE|18-lts"
```

Replace `YOUR_UNIQUE_NAME` with something unique (e.g., your company name).

### Step 3: Configure Deployment

**Enable Git deployment:**
```bash
# Backend
az webapp deployment source config-local-git \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg

# Frontend
az webapp deployment source config-local-git \
  --name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg
```

---

## Azure Database for PostgreSQL

### Step 1: Create PostgreSQL Server

```bash
az postgres flexible-server create \
  --name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --location eastus \
  --admin-user invoiceadmin \
  --admin-password "YOUR_STRONG_PASSWORD_HERE" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --public-access 0.0.0.0
```

**Note:** Save the password securely!

### Step 2: Create Database

```bash
az postgres flexible-server db create \
  --resource-group invoice-tracker-rg \
  --server-name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --database-name invoice_tracker
```

### Step 3: Configure Firewall

```bash
# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your IP for migration
az postgres flexible-server firewall-rule create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --rule-name AllowMyIP \
  --start-ip-address YOUR_PUBLIC_IP \
  --end-ip-address YOUR_PUBLIC_IP
```

### Step 4: Get Connection String

```bash
az postgres flexible-server show \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --query "fullyQualifiedDomainName" \
  --output tsv
```

**Connection String Format:**
```
postgresql://invoiceadmin:YOUR_PASSWORD@invoice-tracker-db-YOUR_UNIQUE_NAME.postgres.database.azure.com:5432/invoice_tracker?sslmode=require
```

---

## Azure Blob Storage

### Step 1: Create Storage Account

```bash
az storage account create \
  --name invoicetrackerstore \
  --resource-group invoice-tracker-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

### Step 2: Create Blob Containers

```bash
# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --resource-group invoice-tracker-rg \
  --account-name invoicetrackerstore \
  --query '[0].value' \
  --output tsv)

# Create containers
az storage container create \
  --name invoice-pdfs \
  --account-name invoicetrackerstore \
  --account-key $STORAGE_KEY

az storage container create \
  --name uploads \
  --account-name invoicetrackerstore \
  --account-key $STORAGE_KEY
```

### Step 3: Get Connection String

```bash
az storage account show-connection-string \
  --name invoicetrackerstore \
  --resource-group invoice-tracker-rg \
  --output tsv
```

---

## Data Migration

### Step 1: Export Local Data

**On local machine:**
```bash
cd Invoice-tracker-backend
node scripts/migrate-to-aws.js --export
```

**Output:** `invoice-tracker-data-[timestamp].tar.gz`

### Step 2: Import to Azure PostgreSQL

**Extract data:**
```bash
tar -xzf invoice-tracker-data-*.tar.gz
cd migration-export
gunzip database-dump.sql.gz
```

**Import database:**
```bash
# Install psql if needed
# Windows: Download from PostgreSQL website
# Linux: apt install postgresql-client
# macOS: brew install postgresql

psql "postgresql://invoiceadmin:YOUR_PASSWORD@invoice-tracker-db-YOUR_UNIQUE_NAME.postgres.database.azure.com:5432/invoice_tracker?sslmode=require" < database-dump.sql
```

### Step 3: Upload Files to Blob Storage

**Install Azure Storage SDK:**
```bash
npm install @azure/storage-blob
```

**Upload script (upload-to-blob.js):**
```javascript
const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

const AZURE_STORAGE_CONNECTION_STRING = 'your-connection-string-here';

async function uploadDirectory(localDir, containerName) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const files = fs.readdirSync(localDir);
  for (const file of files) {
    const filePath = path.join(localDir, file);
    if (fs.statSync(filePath).isFile()) {
      const blockBlobClient = containerClient.getBlockBlobClient(file);
      console.log(`Uploading ${file}...`);
      await blockBlobClient.uploadFile(filePath);
    }
  }
}

async function main() {
  await uploadDirectory('./migration-export/invoice_pdfs', 'invoice-pdfs');
  await uploadDirectory('./migration-export/uploads', 'uploads');
  console.log('Upload complete!');
}

main().catch(console.error);
```

**Run upload:**
```bash
node upload-to-blob.js
```

---

## Application Deployment

### Step 1: Configure Environment Variables

**Backend:**
```bash
az webapp config appsettings set \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --settings \
    DB_HOST="invoice-tracker-db-YOUR_UNIQUE_NAME.postgres.database.azure.com" \
    DB_PORT="5432" \
    DB_NAME="invoice_tracker" \
    DB_USER="invoiceadmin" \
    DB_PASSWORD="YOUR_PASSWORD" \
    JWT_SECRET="$(openssl rand -hex 64)" \
    FRONTEND_URL="https://invoice-tracker-app-YOUR_UNIQUE_NAME.azurewebsites.net" \
    AZURE_STORAGE_CONNECTION_STRING="your-connection-string" \
    NODE_ENV="production"
```

**Frontend:**
```bash
az webapp config appsettings set \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --settings \
    REACT_APP_API_URL="https://invoice-tracker-api-YOUR_UNIQUE_NAME.azurewebsites.net/api"
```

### Step 2: Deploy Backend

**Prepare for deployment:**
```bash
cd Invoice-tracker-backend

# Add Azure remote
git remote add azure-backend $(az webapp deployment source config-local-git \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --query url \
  --output tsv)

# Deploy
git push azure-backend main
```

### Step 3: Deploy Frontend

**Build and deploy:**
```bash
cd invoice-tracker-frontend

# Update API URL in code
# Edit src/contexts/AuthContext.jsx and src/App.jsx
# Change API_URL to: https://invoice-tracker-api-YOUR_UNIQUE_NAME.azurewebsites.net/api

# Build
npm run build

# Deploy using Azure CLI
cd dist
zip -r app.zip .

az webapp deployment source config-zip \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --src app.zip
```

---

## SSL & Custom Domain

### Step 1: Add Custom Domain

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --hostname yourdomain.com

# Add SSL binding (free managed certificate)
az webapp config ssl bind \
  --name invoice-tracker-app-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

### Step 2: Configure DNS

**Add CNAME records at your domain registrar:**
```
www.yourdomain.com → invoice-tracker-app-YOUR_UNIQUE_NAME.azurewebsites.net
api.yourdomain.com → invoice-tracker-api-YOUR_UNIQUE_NAME.azurewebsites.net
```

---

## Monitoring & Maintenance

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app invoice-tracker-insights \
  --location eastus \
  --resource-group invoice-tracker-rg

# Link to Web Apps
az monitor app-insights component connect-webapp \
  --app invoice-tracker-insights \
  --resource-group invoice-tracker-rg \
  --web-app invoice-tracker-api-YOUR_UNIQUE_NAME
```

### View Logs

```bash
# Stream logs
az webapp log tail \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg

# Download logs
az webapp log download \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME
```

### Automated Backups

```bash
# Enable database backup
az postgres flexible-server backup create \
  --resource-group invoice-tracker-rg \
  --name invoice-tracker-db-YOUR_UNIQUE_NAME \
  --backup-name daily-backup
```

---

## Useful Commands

### Restart Applications
```bash
az webapp restart \
  --name invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg
```

### Scale Up/Down
```bash
# Scale to Standard S1
az appservice plan update \
  --name invoice-tracker-plan \
  --resource-group invoice-tracker-rg \
  --sku S1
```

### View Metrics
```bash
az monitor metrics list \
  --resource invoice-tracker-api-YOUR_UNIQUE_NAME \
  --resource-group invoice-tracker-rg \
  --resource-type "Microsoft.Web/sites" \
  --metric "CpuPercentage"
```

---

## Troubleshooting

### Application Not Starting
```bash
# Check logs
az webapp log tail -n invoice-tracker-api-YOUR_UNIQUE_NAME -g invoice-tracker-rg

# Check configuration
az webapp config appsettings list -n invoice-tracker-api-YOUR_UNIQUE_NAME -g invoice-tracker-rg
```

### Database Connection Failed
```bash
# Test connection
psql "postgresql://invoiceadmin:PASSWORD@SERVER.postgres.database.azure.com:5432/invoice_tracker?sslmode=require"

# Check firewall rules
az postgres flexible-server firewall-rule list -g invoice-tracker-rg -n invoice-tracker-db-YOUR_UNIQUE_NAME
```

### Blob Storage Access Denied
```bash
# Regenerate access keys
az storage account keys renew \
  --resource-group invoice-tracker-rg \
  --account-name invoicetrackerstore \
  --key primary
```

---

## Cost Optimization

1. **Use Basic tier** for non-production environments
2. **Enable auto-scaling** based on load
3. **Use Azure Reserved Instances** for 40% savings
4. **Archive old data** to cold storage
5. **Monitor with Azure Advisor** for recommendations

---

## Security Checklist

- [ ] Enable HTTPS only
- [ ] Configure firewall rules
- [ ] Use managed identities
- [ ] Enable database SSL
- [ ] Set up Azure Key Vault for secrets
- [ ] Configure CORS properly
- [ ] Enable DDoS protection
- [ ] Regular security updates
- [ ] Monitor with Security Center

---

## Support Resources

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for PostgreSQL](https://docs.microsoft.com/azure/postgresql/)
- [Azure Blob Storage](https://docs.microsoft.com/azure/storage/blobs/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)

---

**Deployment Complete!** Your Invoice Tracker is now running on Microsoft Azure.

**Access:**
- Frontend: https://invoice-tracker-app-YOUR_UNIQUE_NAME.azurewebsites.net
- Backend API: https://invoice-tracker-api-YOUR_UNIQUE_NAME.azurewebsites.net/api
