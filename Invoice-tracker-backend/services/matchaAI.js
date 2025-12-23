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
 * Format date as YYYY-MM-DD in local timezone
 */
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Detect if user query requests filtered data and extract filter parameters
 * @param {string} query - User's question
 * @returns {Object|null} - Filter parameters or null if no filtering detected
 */
function detectFilters(query) {
  const lowerQuery = query.toLowerCase();
  const filters = {};
  const today = new Date();

  // Detect client name
  const clientMatches = query.match(/(?:for|from|about|client|invoices?\s+(?:for|from))\s+([A-Z][A-Za-z\s&]+?)(?:\s+(?:from|in|during|for|only|invoices?|issued|$))/);
  if (clientMatches && clientMatches[1]) {
    filters.client = clientMatches[1].trim();
  }

  // Detect relative date ranges FIRST (before specific months)

  // Specific Quarter (Q1, Q2, Q3, Q4)
  const specificQuarterMatch = lowerQuery.match(/\bq([1-4])\b/);
  if (specificQuarterMatch) {
    const quarter = parseInt(specificQuarterMatch[1]) - 1; // 0-indexed
    const year = today.getFullYear();

    const dateFrom = new Date(year, quarter * 3, 1);
    const dateTo = new Date(year, quarter * 3 + 3, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `Q${quarter + 1} ${year} (${dateFrom.toLocaleDateString('en-US', {month: 'short'})} - ${dateTo.toLocaleDateString('en-US', {month: 'short'})})`;
  }
  // First/Second/Third/Fourth Quarter
  else if (lowerQuery.match(/\b(first|second|third|fourth)\s+quarter\b/)) {
    const quarterNames = { 'first': 0, 'second': 1, 'third': 2, 'fourth': 3 };
    const quarterMatch = lowerQuery.match(/\b(first|second|third|fourth)\s+quarter\b/);
    const quarter = quarterNames[quarterMatch[1]];
    const year = today.getFullYear();

    const dateFrom = new Date(year, quarter * 3, 1);
    const dateTo = new Date(year, quarter * 3 + 3, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `Q${quarter + 1} ${year} (${dateFrom.toLocaleDateString('en-US', {month: 'short'})} - ${dateTo.toLocaleDateString('en-US', {month: 'short'})})`;
  }
  // Last/This/Next Quarter
  else if (lowerQuery.match(/\b(?:last|previous|past)\s+quarter\b/)) {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const lastQuarterYear = currentQuarter === 0 ? currentYear - 1 : currentYear;

    const dateFrom = new Date(lastQuarterYear, lastQuarter * 3, 1);
    const dateTo = new Date(lastQuarterYear, lastQuarter * 3 + 3, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `Last Quarter (${dateFrom.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})} - ${dateTo.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})})`;
  } else if (lowerQuery.match(/\b(?:this|current)\s+quarter\b/)) {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    const dateFrom = new Date(currentYear, currentQuarter * 3, 1);
    const dateTo = new Date(currentYear, currentQuarter * 3 + 3, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `This Quarter (${dateFrom.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})} - ${dateTo.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})})`;
  }
  // Last/This/Next Month
  else if (lowerQuery.match(/\b(?:last|previous|past)\s+month\b/)) {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const dateFrom = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const dateTo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `Last Month (${dateFrom.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})})`;
  } else if (lowerQuery.match(/\b(?:this|current)\s+month\b/)) {
    const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `This Month (${dateFrom.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})})`;
  }
  // Last N days
  else if (lowerQuery.match(/\b(?:last|past|previous)\s+(\d+)\s+days?\b/)) {
    const daysMatch = lowerQuery.match(/\b(?:last|past|previous)\s+(\d+)\s+days?\b/);
    const numDays = parseInt(daysMatch[1]);
    const dateFrom = new Date(today);
    dateFrom.setDate(dateFrom.getDate() - numDays);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(today);
    filters.dateDescription = `Last ${numDays} Days`;
  }
  // Last N months
  else if (lowerQuery.match(/\b(?:last|past|previous)\s+(\d+)\s+months?\b/)) {
    const monthsMatch = lowerQuery.match(/\b(?:last|past|previous)\s+(\d+)\s+months?\b/);
    const numMonths = parseInt(monthsMatch[1]);
    const dateFrom = new Date(today.getFullYear(), today.getMonth() - numMonths, 1);
    const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    filters.dateFrom = formatDateLocal(dateFrom);
    filters.dateTo = formatDateLocal(dateTo);
    filters.dateDescription = `Last ${numMonths} Months`;
  }
  // Detect specific month and year - MORE FLEXIBLE PATTERNS
  // Matches: "November 2025", "Nov 25", "November", "in November", "November invoices"
  else {
    const monthMatch = query.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s*(\d{2,4})?/i);
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

      // Format dates as YYYY-MM-DD in local timezone (not UTC)
      filters.dateFrom = `${year}-${String(monthNum + 1).padStart(2, '0')}-01`;
      filters.dateTo = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(dateTo.getDate()).padStart(2, '0')}`;
      filters.dateDescription = `${dateFrom.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}`;
    }
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
      const filteredInvoices = await getDetailedInvoiceData(filters);

      // Format filtered data for context
      if (filteredInvoices.length > 0) {
        const totalUSD = filteredInvoices.reduce((sum, inv) => sum + inv.amountUSD, 0);

        // Group by client for summary
        const clientTotals = {};
        filteredInvoices.forEach(inv => {
          if (!clientTotals[inv.client]) {
            clientTotals[inv.client] = { totalUSD: 0, count: 0 };
          }
          clientTotals[inv.client].totalUSD += inv.amountUSD;
          clientTotals[inv.client].count++;
        });

        filteredDataContext = `\n\n${'='.repeat(80)}\n`;
        filteredDataContext += `✅✅✅ YOU HAVE FILTERED INVOICE DATA - USE THIS DATA! ✅✅✅\n`;
        filteredDataContext += `${'='.repeat(80)}\n\n`;
        filteredDataContext += `🎯 CRITICAL INSTRUCTION: This is INDIVIDUAL INVOICE-LEVEL DATA filtered by the user's request.\n`;
        filteredDataContext += `You MUST use THIS data to answer the user's question.\n`;
        filteredDataContext += `DO NOT say you lack invoice-level details or cannot filter by date!\n`;
        filteredDataContext += `The data below IS the answer to the user's question!\n\n`;

        if (filters.dateDescription) {
          filteredDataContext += `📅 Date Filter: ${filters.dateDescription}\n`;
        } else if (filters.dateFrom && filters.dateTo) {
          filteredDataContext += `📅 Date Range: ${filters.dateFrom} to ${filters.dateTo}\n`;
        }
        if (filters.client) {
          filteredDataContext += `👤 Client Filter: ${filters.client}\n`;
        }
        if (filters.status) {
          filteredDataContext += `📊 Status Filter: ${filters.status}\n`;
        }

        filteredDataContext += `\n📈 SUMMARY OF FILTERED DATA:\n`;
        filteredDataContext += `Total Invoices Found: ${filteredInvoices.length}\n`;
        filteredDataContext += `Total Amount: $${Math.round(totalUSD).toLocaleString('en-US')} USD\n\n`;

        filteredDataContext += `💰 BREAKDOWN BY CLIENT:\n`;
        Object.entries(clientTotals)
          .sort((a, b) => b[1].totalUSD - a[1].totalUSD)
          .forEach(([client, data]) => {
            filteredDataContext += `  • ${client}: $${Math.round(data.totalUSD).toLocaleString('en-US')} USD (${data.count} invoice${data.count > 1 ? 's' : ''})\n`;
          });

        filteredDataContext += `\n📋 DETAILED INVOICE LIST:\n`;
        filteredInvoices.forEach(inv => {
          filteredDataContext += `- ${inv.invoiceNumber}: ${inv.client}, Issued: ${inv.invoiceDate}, $${Math.round(inv.amountUSD).toLocaleString('en-US')} USD`;
          if (inv.currency !== 'USD') {
            filteredDataContext += ` (${inv.currency} ${Math.round(inv.amount).toLocaleString('en-US')})`;
          }
          filteredDataContext += `, ${inv.status}`;
          if (inv.agingBucket) {
            filteredDataContext += `, Aging: ${inv.agingBucket}`;
          }
          filteredDataContext += `\n`;
        });

        filteredDataContext += `\n✅ END OF FILTERED DATA - Use the CLIENT BREAKDOWN above to answer questions about expected payments!\n`;
      } else {
        filteredDataContext = `\n\n=== FILTERED INVOICE DATA ===\n`;
        filteredDataContext += `No invoices found matching the specified filters.\n`;
        if (filters.dateDescription) {
          filteredDataContext += `Date Filter: ${filters.dateDescription}\n`;
        }
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
