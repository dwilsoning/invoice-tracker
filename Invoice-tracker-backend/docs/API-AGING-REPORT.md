# Aging Invoice Report API

## Overview

This API endpoint provides real-time access to aging invoice data from the Invoice Tracker system. It returns client names and amounts organized by aging buckets, with all amounts converted to USD.

## Endpoint

```
GET /api/aging-report
```

## Authentication

This endpoint requires authentication using a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Getting a JWT Token

To obtain a JWT token, first authenticate with the login endpoint:

```bash
curl -X POST http://your-ec2-instance:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "your-username",
    "role": "user"
  }
}
```

## Usage

### Basic Request

```bash
curl -X GET http://your-ec2-instance:3001/api/aging-report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using in Your Application

#### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_URL = 'http://your-ec2-instance:3001';
const USERNAME = 'your-username';
const PASSWORD = 'your-password';

async function getAgingReport() {
  try {
    // Step 1: Login to get JWT token
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      username: USERNAME,
      password: PASSWORD
    });

    const token = loginResponse.data.token;

    // Step 2: Fetch aging report using the token
    const reportResponse = await axios.get(`${API_URL}/api/aging-report`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return reportResponse.data;
  } catch (error) {
    console.error('Error fetching aging report:', error.message);
    throw error;
  }
}

// Usage
getAgingReport()
  .then(data => {
    console.log('Generated At:', data.generatedAt);
    console.log('Grand Total:', data.grandTotal, data.currency);

    // Access specific bucket data
    const currentBucket = data.buckets['Current'];
    console.log('Current Bucket Total:', currentBucket.totalUSD);

    // Access specific client data within a bucket
    Object.keys(currentBucket.clients).forEach(clientName => {
      const clientData = currentBucket.clients[clientName];
      console.log(`${clientName}: $${clientData.totalUSD} (${clientData.invoiceCount} invoices)`);
    });
  })
  .catch(err => console.error('Failed:', err));
```

#### Python Example

```python
import requests

API_URL = 'http://your-ec2-instance:3001'
USERNAME = 'your-username'
PASSWORD = 'your-password'

def get_aging_report():
    # Step 1: Login to get JWT token
    login_response = requests.post(
        f'{API_URL}/api/auth/login',
        json={'username': USERNAME, 'password': PASSWORD}
    )
    login_response.raise_for_status()
    token = login_response.json()['token']

    # Step 2: Fetch aging report using the token
    headers = {'Authorization': f'Bearer {token}'}
    report_response = requests.get(f'{API_URL}/api/aging-report', headers=headers)
    report_response.raise_for_status()

    return report_response.json()

# Usage
try:
    data = get_aging_report()
    print(f"Generated At: {data['generatedAt']}")
    print(f"Grand Total: ${data['grandTotal']} {data['currency']}")

    # Access specific bucket data
    current_bucket = data['buckets']['Current']
    print(f"Current Bucket Total: ${current_bucket['totalUSD']}")

    # Access specific client data
    for client_name, client_data in current_bucket['clients'].items():
        print(f"{client_name}: ${client_data['totalUSD']} ({client_data['invoiceCount']} invoices)")

except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
```

## Response Format

The API returns a JSON object with the following structure:

```json
{
  "generatedAt": "2025-12-08T12:34:56.789Z",
  "currency": "USD",
  "grandTotal": 1234567,
  "buckets": {
    "Current": {
      "totalUSD": 500000,
      "clients": {
        "Client A": {
          "totalUSD": 250000,
          "invoiceCount": 5,
          "invoices": [
            {
              "invoiceNumber": "INV-001",
              "invoiceDate": "2025-11-15",
              "dueDate": "2025-12-15",
              "amountDue": 50000,
              "currency": "USD",
              "amountUSD": 50000,
              "daysOverdue": 0
            }
          ]
        },
        "Client B": {
          "totalUSD": 250000,
          "invoiceCount": 3,
          "invoices": [...]
        }
      }
    },
    "31-60": {
      "totalUSD": 200000,
      "clients": {...}
    },
    "61-90": {
      "totalUSD": 150000,
      "clients": {...}
    },
    "91-120": {
      "totalUSD": 100000,
      "clients": {...}
    },
    "121-180": {
      "totalUSD": 75000,
      "clients": {...}
    },
    "181-270": {
      "totalUSD": 50000,
      "clients": {...}
    },
    "271-365": {
      "totalUSD": 25000,
      "clients": {...}
    },
    ">365": {
      "totalUSD": 134567,
      "clients": {...}
    }
  },
  "exchangeRates": {
    "USD": 1,
    "AUD": 0.65,
    "EUR": 1.08,
    "GBP": 1.27,
    "SGD": 0.74,
    "NZD": 0.61
  }
}
```

## Response Fields

### Top Level
- `generatedAt` (string): ISO 8601 timestamp when the report was generated
- `currency` (string): Currency for all amounts (always "USD")
- `grandTotal` (number): Total of all unpaid invoices across all buckets in USD
- `buckets` (object): Aging buckets containing invoice data
- `exchangeRates` (object): Current exchange rates used for USD conversion

### Aging Buckets

The following buckets are available:
- `Current`: Invoices not yet due or up to 30 days overdue
- `31-60`: Invoices 31-60 days overdue
- `61-90`: Invoices 61-90 days overdue
- `91-120`: Invoices 91-120 days overdue
- `121-180`: Invoices 121-180 days overdue
- `181-270`: Invoices 181-270 days overdue
- `271-365`: Invoices 271-365 days overdue
- `>365`: Invoices more than 365 days overdue

### Bucket Fields
- `totalUSD` (number): Total amount in this bucket in USD (rounded to nearest dollar)
- `clients` (object): Client-level breakdown within this bucket

### Client Fields (within each bucket)
- `totalUSD` (number): Total amount for this client in this bucket in USD (rounded)
- `invoiceCount` (number): Number of invoices for this client in this bucket
- `invoices` (array): Detailed invoice information

### Invoice Fields
- `invoiceNumber` (string): Invoice number
- `invoiceDate` (string): Date invoice was issued (YYYY-MM-DD)
- `dueDate` (string): Date invoice is due (YYYY-MM-DD)
- `amountDue` (number): Original invoice amount in original currency
- `currency` (string): Original currency (USD, AUD, EUR, GBP, SGD, NZD)
- `amountUSD` (number): Amount converted to USD (rounded)
- `daysOverdue` (number): Number of days overdue (negative if not yet due)

## Important Notes

### Data Exclusions

The following invoice types are automatically excluded from the aging report:
- Credit Memos
- Vendor Invoices
- Purchase Orders (POs)

Only unpaid invoices (status = "Pending") are included in the report.

### Currency Conversion

All amounts are automatically converted to USD using the latest exchange rates. The exchange rates are updated automatically at:
- 2 AM AEST/AEDT
- 8 AM AEST/AEDT
- 2 PM AEST/AEDT
- 8 PM AEST/AEDT

Current exchange rates are included in the response for reference.

### Real-Time Data

The API queries the database in real-time and calculates aging buckets based on the current date. The aging calculation is:
- Days overdue = Today's date - Due date
- If days overdue ≤ 0, the invoice is not yet due
- If days overdue ≤ 30, it's in the "Current" bucket

### Performance

The endpoint is optimized for quick responses and should return data in under 1 second for databases with up to 10,000 invoices.

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "error": "No token provided"
}
```
Solution: Include a valid JWT token in the Authorization header.

**403 Forbidden**
```json
{
  "error": "Invalid or expired token"
}
```
Solution: Login again to get a fresh token.

**500 Internal Server Error**
```json
{
  "error": "Database connection lost. Please try again."
}
```
Solution: Retry the request. If the error persists, contact the system administrator.

## Token Management

JWT tokens expire after 24 hours. Your application should:
1. Store the token securely
2. Reuse the token for multiple requests
3. Implement token refresh logic when receiving 403 errors
4. Never hardcode tokens in your application

## Security Considerations

1. Always use HTTPS in production (not HTTP)
2. Store credentials securely (use environment variables)
3. Implement proper error handling to avoid exposing sensitive information
4. Consider implementing API rate limiting in your application
5. Rotate passwords regularly
6. Use read-only database credentials if possible

## Example Use Cases

### Dashboard Integration

```javascript
// Refresh aging data every 5 minutes
setInterval(async () => {
  const data = await getAgingReport();
  updateDashboard(data);
}, 5 * 60 * 1000);
```

### Exporting to CSV

```javascript
function exportToCSV(data) {
  const rows = [];
  rows.push(['Bucket', 'Client', 'Total USD', 'Invoice Count']);

  Object.keys(data.buckets).forEach(bucket => {
    Object.keys(data.buckets[bucket].clients).forEach(client => {
      const clientData = data.buckets[bucket].clients[client];
      rows.push([
        bucket,
        client,
        clientData.totalUSD,
        clientData.invoiceCount
      ]);
    });
  });

  return rows.map(row => row.join(',')).join('\n');
}
```

### Alerting on Overdue Invoices

```python
def check_high_overdue_amounts(data, threshold=100000):
    alerts = []

    # Check buckets older than 90 days
    high_risk_buckets = ['91-120', '121-180', '181-270', '271-365', '>365']

    for bucket in high_risk_buckets:
        bucket_data = data['buckets'][bucket]
        for client_name, client_data in bucket_data['clients'].items():
            if client_data['totalUSD'] > threshold:
                alerts.append({
                    'bucket': bucket,
                    'client': client_name,
                    'amount': client_data['totalUSD'],
                    'invoiceCount': client_data['invoiceCount']
                })

    return alerts
```

## Support

For issues or questions about this API, please contact your system administrator or refer to the main Invoice Tracker documentation.
