# MatchaAI Chatbot Integration Guide

## Overview

This integration adds an AI-powered chatbot to the Invoice Tracker application. The chatbot, named **Finley**, is an expert Finance Specialist that provides real-time analytics insights by querying your invoice data using MatchaAI's API.

## Meet Finley

Finley is your dedicated finance assistant with expertise in:
- Invoice lifecycle management
- Accounts receivable analytics
- Aged debt recovery and collection strategies
- Cash flow optimisation
- Payment pattern analysis

Finley provides professional, action-oriented financial insights and proactively alerts you to critical issues like overdue invoices, payment pattern deterioration, and concentration risks.

## Features

- **Expert Finance Persona**: Finley acts as both an analyst and advisor, combining technical knowledge with clear communication
- **Real-time Analytics**: Access to live invoice data following the same rules as your analytics dashboard
- **Proactive Alerting**: Critical, warning, and informational alerts based on data patterns
- **Actionable Insights**: Responses follow a structured framework (Summarise → Quantify → Contextualise → Recommend → Alert)
- **Conversational Interface**: Full chat history support for multi-turn conversations
- **Comprehensive Data**: Access to DSO, aging analysis, cash flow projections, risk metrics, and more
- **Authenticated Access**: All users can access the chatbot (requires JWT authentication)
- **Responsive UI**: Floating chat button accessible from anywhere in the application

## Architecture

### Backend Components

1. **services/matchaAI.js** - MatchaAI API integration
   - Handles API communication with MatchaAI
   - Manages chat history and context
   - Comprehensive error handling

2. **services/chatbotContext.js** - Analytics data preparation
   - Generates real-time analytics context from database
   - Follows same rules as Analytics.jsx dashboard
   - Applies production mode filtering and invoice type exclusions

3. **API Endpoints** (server-postgres.js:3078-3193)
   - `POST /api/chatbot/query` - Send chat messages
   - `GET /api/chatbot/context` - View analytics context
   - `GET /api/chatbot/test` - Test connection
   - `POST /api/chatbot/invoices` - Get detailed invoice data

### Frontend Components

1. **components/Chatbot.jsx** - Main chat UI
   - Modal chat interface
   - Message history with timestamps
   - Suggested questions
   - Loading states and error handling

2. **App.jsx** - Integration point
   - Floating chat button (bottom-right corner)
   - State management for chat visibility

## Setup Instructions

### 1. Environment Configuration

Add the following to your `.env` file in the backend directory:

```env
# MatchaAI Configuration
MATCHA_API_KEY=6fbc03d59fb547fab912cdff1ad0cd00
MATCHA_API_URL=https://matcha.harriscomputer.com/rest/api/v1
MATCHA_MISSION_ID=12477
```

### 2. Verify MatchaAI Mission Setup

Ensure your MatchaAI mission (ID: 12477) is properly configured:

1. Log into MatchaAI dashboard at https://matcha.harriscomputer.com
2. Navigate to your workspace
3. Verify mission ID 12477 exists and is accessible
4. Check that your API key has permissions for this mission

### 3. Test the Integration

Run the test script to verify everything is working:

```bash
cd Invoice-tracker-backend
node scripts/test-chatbot.js
```

Expected output:
```
🧪 Testing MatchaAI Chatbot Integration

1️⃣ Checking environment variables...
   ✓ MATCHA_API_KEY: ✅ Set
   ✓ MATCHA_API_URL: ✅ Set
   ✓ MATCHA_MISSION_ID: ✅ Set

2️⃣ Testing analytics context generation...
   ✅ Context generated successfully
   📊 Total Invoices: 1684
   💵 Total Pending: $22,666,307.07
   📅 DSI: 8 days

3️⃣ Testing MatchaAI connection...
   ✅ Connection successful
   💬 Response: [AI response]

4️⃣ Sending test query...
   ✅ Query successful
   💬 Response: [AI response about DSI]

🎉 All tests completed!
```

### 4. Start the Application

```bash
# Start backend
cd Invoice-tracker-backend
npm start

# Start frontend (in a new terminal)
cd invoice-tracker-frontend
npm run dev
```

### 5. Using the Chatbot

1. Log into the Invoice Tracker application
2. Look for the floating chat button (💬) in the bottom-right corner
3. Click to open the chatbot
4. Try suggested questions or ask your own

## Analytics Data Available to Chatbot

The chatbot has access to the following real-time analytics:

### Summary Metrics
- Total invoices, pending invoices, paid invoices
- Total pending amount (USD)
- Total revenue (USD)
- Days Invoices Outstanding (DSI)

### Aging Analysis
- Invoice aging buckets (Current, 31-60, 61-90, 91-120, 121-180, 181-270, 271-365, >365 days)
- Count and total amount per bucket
- Breakdown by client within each bucket

### Top Clients
- Top 10 clients by revenue
- Revenue amounts in USD

### Payment Velocity
- Average days to pay per client
- Sorted by slowest payers

### Risk Metrics
- High-risk clients (>$50k overdue)
- Total overdue amount
- Number of clients at risk
- Risk levels (Critical >$200k, High >$100k, Medium ≤$100k)

### Cash Flow Projection
- Overdue amounts
- Next 30 days expected
- 31-60 days expected
- 61-90 days expected
- Beyond 90 days expected

### Currency Exposure
- Breakdown of pending invoices by currency
- Current exchange rates

## Data Rules and Filters

The chatbot follows the **exact same rules** as the Analytics dashboard:

1. **Excluded Invoice Types**:
   - Credit Memo
   - Vendor Invoice
   - Purchase Order

2. **Production Mode** (after January 1, 2026):
   - Only shows invoices from 2026 onwards
   - Automatically enabled when current date >= 2026-01-01

3. **Currency Conversion**:
   - All amounts converted to USD for aggregations
   - Uses **live exchange rates** fetched from API
   - Rates updated **4 times daily** at 2 AM, 8 AM, 2 PM, 8 PM AEST/AEDT
   - Same rates used by both server and chatbot (centralized service)
   - Negative amounts (credits, adjustments) are excluded from calculations

4. **Status Filtering**:
   - Pending invoices for DSI, aging, cash flow
   - Paid invoices for payment velocity, collection efficiency

## Example Queries

Here are some questions you can ask Finley:

**Quick Insights:**
- "What is my current DSO?"
- "Show me the aging analysis"
- "Which clients are high risk?"
- "How much is overdue?"

**Cash Flow & Revenue:**
- "What is my cash flow for the next 30 days?"
- "Who are my top 5 clients by revenue?"
- "What is my total pending amount?"
- "What's my currency exposure in AUD?"

**Collection Strategy:**
- "Which clients should I chase this week?"
- "Which clients pay the slowest?"
- "Which clients have invoices over 90 days old?"
- "Are there any critical alerts I should know about?"

**Trend Analysis:**
- "Is our DSO improving?"
- "Are there any customers with deteriorating payment patterns?"
- "Do we have concentration risk with any clients?"

Finley will provide structured responses with summaries, specific data points, contextual analysis, actionable recommendations, and relevant alerts.

## Troubleshooting

### 403 Forbidden Error

**Problem**: MatchaAI returns 403 when testing connection

**Solutions**:
1. Verify your API key is correct in `.env`
2. Check that mission ID 12477 exists and you have access
3. Ensure your API key has permissions for this mission
4. Verify the mission is in an accessible workspace

### No Response from Chatbot

**Problem**: Chatbot doesn't respond or shows error

**Solutions**:
1. Check backend logs for errors
2. Verify environment variables are loaded
3. Run the test script to identify the issue
4. Check network connectivity to MatchaAI API

### Context Generation Errors

**Problem**: Test script fails at context generation

**Solutions**:
1. Verify database connection is working
2. Check that invoices table exists and has data
3. Ensure db-postgres.js is properly configured
4. Review PostgreSQL connection settings in `.env`

### Frontend Not Showing Chatbot Button

**Problem**: Chat button (💬) doesn't appear

**Solutions**:
1. Check that you're logged in (authentication required)
2. Verify Chatbot.jsx is in components directory
3. Check browser console for import errors
4. Clear browser cache and reload

## API Documentation

### POST /api/chatbot/query

Send a message to the AI chatbot.

**Authentication**: Required (JWT Bearer token)

**Request Body**:
```json
{
  "message": "What is my current DSI?",
  "chatHistory": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Previous response"
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Your current DSI is 8 days...",
  "timestamp": "2025-01-25T10:30:00.000Z"
}
```

### GET /api/chatbot/context

Get the current analytics context used by the chatbot.

**Authentication**: Required (JWT Bearer token)

**Response**:
```json
{
  "success": true,
  "context": {
    "summary": { ... },
    "aging": { ... },
    "topClients": [ ... ],
    "paymentVelocity": [ ... ],
    "riskMetrics": { ... },
    "cashFlow": { ... },
    "currencyExposure": { ... },
    "exchangeRates": { ... },
    "generatedAt": "2025-01-25T10:30:00.000Z"
  },
  "timestamp": "2025-01-25T10:30:00.000Z"
}
```

### GET /api/chatbot/test

Test the MatchaAI connection.

**Authentication**: Required (JWT Bearer token)

**Response**:
```json
{
  "success": true,
  "message": "MatchaAI connection successful",
  "details": { ... }
}
```

### POST /api/chatbot/invoices

Get detailed invoice data with filters.

**Authentication**: Required (JWT Bearer token)

**Request Body**:
```json
{
  "filters": {
    "client": "Acme Corp",
    "status": "Pending",
    "invoiceType": "PS",
    "dateFrom": "2025-01-01",
    "dateTo": "2025-12-31",
    "overdueOnly": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "count": 42,
  "invoices": [ ... ],
  "timestamp": "2025-01-25T10:30:00.000Z"
}
```

## Files Modified/Created

### Backend
- ✅ `.env` - Added MatchaAI configuration
- ✅ `server-postgres.js` - Added chatbot endpoints
- ✅ `services/matchaAI.js` - MatchaAI API integration (new)
- ✅ `services/chatbotContext.js` - Analytics context service (new)
- ✅ `scripts/test-chatbot.js` - Integration test script (new)

### Frontend
- ✅ `src/App.jsx` - Added chatbot button and state
- ✅ `src/components/Chatbot.jsx` - Chat UI component (new)

## Security Considerations

1. **API Key Protection**: Never commit `.env` file to git
2. **Authentication**: All endpoints require valid JWT token
3. **Rate Limiting**: Consider adding rate limiting for chatbot endpoints
4. **Data Access**: Chatbot follows same access rules as analytics dashboard

## Future Enhancements

Potential improvements to consider:

1. **User-specific filtering**: Restrict data based on user roles or permissions
2. **Chat history persistence**: Save conversations to database
3. **Export functionality**: Allow users to export chat transcripts
4. **Advanced queries**: Support for complex multi-filter queries
5. **Voice input**: Add speech-to-text capability
6. **Suggested actions**: Chatbot can suggest actions based on insights
7. **Real-time notifications**: Alert users about critical issues identified by AI

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review backend logs for error details
3. Test individual components using test script
4. Verify MatchaAI dashboard settings

---

**Last Updated**: January 25, 2025
**Version**: 1.0.0
**Branch**: jan-25-changes
