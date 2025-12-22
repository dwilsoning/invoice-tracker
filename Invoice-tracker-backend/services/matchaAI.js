const axios = require('axios');
const { generateContextString, getDetailedInvoiceData } = require('./chatbotContext');

/**
 * MatchaAI Integration Service
 * Handles communication with MatchaAI API
 */

const MATCHA_API_KEY = process.env.MATCHA_API_KEY;
const MATCHA_API_URL = process.env.MATCHA_API_URL;
const MATCHA_MISSION_ID = process.env.MATCHA_MISSION_ID;

if (!MATCHA_API_KEY || !MATCHA_API_URL || !MATCHA_MISSION_ID) {
  console.error('WARNING: MatchaAI configuration missing in environment variables');
}

/**
 * Detect if user query requests filtered data and extract filter parameters
 * @param {string} query - User's question
 * @returns {Object|null} - Filter parameters or null if no filtering detected
 */
function detectFilters(query) {
  const lowerQuery = query.toLowerCase();
  const filters = {};

  // Detect client name
  const clientMatches = query.match(/(?:for|from|about|client|invoices?\s+(?:for|from))\s+([A-Z][A-Za-z\s&]+?)(?:\s+(?:from|in|during|for|only|invoices?|$))/);
  if (clientMatches && clientMatches[1]) {
    filters.client = clientMatches[1].trim();
  }

  // Detect month and year (e.g., "November 2025", "Nov 25", "November 25")
  const monthMatch = query.match(/(?:from|in|during|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s*(\d{2,4})?/i);
  if (monthMatch) {
    const monthNames = {
      'january': 0, 'jan': 0,
      'february': 1, 'feb': 1,
      'march': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'may': 4,
      'june': 5, 'jun': 5,
      'july': 6, 'jul': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8,
      'october': 9, 'oct': 9,
      'november': 10, 'nov': 10,
      'december': 11, 'dec': 11
    };

    const monthNum = monthNames[monthMatch[1].toLowerCase()];
    let year = monthMatch[2] ? parseInt(monthMatch[2]) : new Date().getFullYear();

    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year += 2000;
    }

    // Create date range for the entire month
    const dateFrom = new Date(year, monthNum, 1);
    const dateTo = new Date(year, monthNum + 1, 0); // Last day of month

    filters.dateFrom = dateFrom.toISOString().split('T')[0];
    filters.dateTo = dateTo.toISOString().split('T')[0];
  }

  // Detect status
  if (lowerQuery.includes('pending') || lowerQuery.includes('unpaid')) {
    filters.status = 'Pending';
  } else if (lowerQuery.includes('paid')) {
    filters.status = 'Paid';
  }

  // Detect overdue
  if (lowerQuery.includes('overdue')) {
    filters.overdueOnly = true;
  }

  // Only return filters if at least one was detected
  return Object.keys(filters).length > 0 ? filters : null;
}

/**
 * Send a chat completion request to MatchaAI
 * @param {string} userMessage - The user's message/question
 * @param {Array} chatHistory - Previous messages in the conversation
 * @param {string} customContext - Optional additional context
 * @returns {Promise<Object>} - MatchaAI response
 */
async function sendChatCompletion(userMessage, chatHistory = [], customContext = null) {
  try {
    // Generate real-time analytics context
    const analyticsContext = await generateContextString();

    // Detect if user is requesting filtered data
    const filters = detectFilters(userMessage);
    let filteredDataContext = '';

    if (filters) {
      console.log('Detected filters in query:', filters);
      const filteredInvoices = await getDetailedInvoiceData(filters);

      // Format filtered data for context
      if (filteredInvoices.length > 0) {
        const totalUSD = filteredInvoices.reduce((sum, inv) => sum + inv.amountUSD, 0);
        filteredDataContext = `\n\n=== FILTERED INVOICE DATA ===\n`;
        filteredDataContext += `Query detected filters: ${JSON.stringify(filters)}\n`;
        filteredDataContext += `Found ${filteredInvoices.length} matching invoices\n`;
        filteredDataContext += `Total Amount: $${Math.round(totalUSD).toLocaleString('en-US')} USD\n\n`;
        filteredDataContext += `Invoice Details:\n`;
        filteredInvoices.forEach(inv => {
          filteredDataContext += `- ${inv.invoiceNumber}: ${inv.client}, ${inv.invoiceDate}, $${Math.round(inv.amountUSD).toLocaleString('en-US')} USD`;
          if (inv.currency !== 'USD') {
            filteredDataContext += ` (${inv.currency} ${Math.round(inv.amount).toLocaleString('en-US')})`;
          }
          filteredDataContext += `, ${inv.status}`;
          if (inv.agingBucket) {
            filteredDataContext += `, ${inv.agingBucket} days overdue`;
          }
          filteredDataContext += `\n`;
        });
      } else {
        filteredDataContext = `\n\n=== FILTERED INVOICE DATA ===\n`;
        filteredDataContext += `No invoices found matching filters: ${JSON.stringify(filters)}\n`;
      }
    }

    // Combine with any custom context
    const fullContext = customContext
      ? `${analyticsContext}\n\n${filteredDataContext}\n\n${customContext}`
      : `${analyticsContext}${filteredDataContext}`;

    // Prepare the request payload
    const payload = {
      mission_id: MATCHA_MISSION_ID,
      context: fullContext,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    };

    // Add chat history if provided
    if (chatHistory && chatHistory.length > 0) {
      payload.chat_history = chatHistory;
    }

    // Make the API request
    const response = await axios.post(
      `${MATCHA_API_URL}/completions`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'MATCHA-API-KEY': MATCHA_API_KEY
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Extract the response
    if (response.data.status === 'success' && response.data.output) {
      const assistantMessage = response.data.output[0];
      const textContent = assistantMessage.content.find(c => c.type === 'output_text');

      return {
        success: true,
        message: textContent ? textContent.text : 'No response text available',
        fullResponse: response.data
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Unknown error from MatchaAI',
        fullResponse: response.data
      };
    }
  } catch (error) {
    console.error('MatchaAI API Error:', error.message);

    if (error.response) {
      // API responded with an error
      const errorDetails = error.response.data?.error || error.response.statusText || error.message;
      return {
        success: false,
        error: `MatchaAI API Error (${error.response.status}): ${errorDetails}`,
        statusCode: error.response.status,
        details: error.response.data
      };
    } else if (error.request) {
      // No response received
      return {
        success: false,
        error: 'No response from MatchaAI API. Please check your connection.'
      };
    } else {
      // Error setting up request
      return {
        success: false,
        error: `Request setup error: ${error.message}`
      };
    }
  }
}

/**
 * Send a simple query without chat history
 * @param {string} query - The user's question
 * @returns {Promise<Object>} - MatchaAI response
 */
async function sendSimpleQuery(query) {
  return await sendChatCompletion(query, [], null);
}

/**
 * Test the MatchaAI connection
 * @returns {Promise<Object>} - Connection test result
 */
async function testConnection() {
  try {
    const testQuery = 'Hello, can you confirm you have access to the invoice tracker data?';
    const response = await sendSimpleQuery(testQuery);

    return {
      success: response.success,
      message: response.success
        ? 'MatchaAI connection successful'
        : 'MatchaAI connection failed',
      details: response
    };
  } catch (error) {
    return {
      success: false,
      message: 'MatchaAI connection test failed',
      error: error.message
    };
  }
}

module.exports = {
  sendChatCompletion,
  sendSimpleQuery,
  testConnection
};
