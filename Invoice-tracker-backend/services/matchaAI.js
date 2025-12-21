const axios = require('axios');
const { generateContextString } = require('./chatbotContext');

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

    // Combine with any custom context
    const fullContext = customContext
      ? `${analyticsContext}\n\n${customContext}`
      : analyticsContext;

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
