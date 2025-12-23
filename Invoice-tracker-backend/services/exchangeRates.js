/**
 * Exchange Rates Service
 * Provides access to current exchange rates for currency conversion
 */

// In-memory cache of current exchange rates (shared across application)
let currentExchangeRates = {
  USD: 1,
  AUD: 0.65,
  EUR: 1.08,
  GBP: 1.27,
  SGD: 0.74,
  NZD: 0.61
};

/**
 * Get the current exchange rates
 * @returns {Object} Exchange rates object
 */
function getExchangeRates() {
  return { ...currentExchangeRates };
}

/**
 * Update the exchange rates
 * @param {Object} rates - New exchange rates object
 */
function setExchangeRates(rates) {
  currentExchangeRates = { ...rates };
}

/**
 * Convert amount to USD using current exchange rates
 * Rate represents: how much USD you get for 1 unit of foreign currency
 * Example: If AUD rate is 0.65, then AUD 100 × 0.65 = USD 65
 * @param {number} amount - Amount in foreign currency
 * @param {string} currency - Currency code (USD, AUD, EUR, etc.)
 * @returns {number} Amount in USD
 */
function convertToUSD(amount, currency) {
  if (!amount || !currency) return 0;
  const rate = currentExchangeRates[currency] || 1;
  return amount * rate;
}

module.exports = {
  getExchangeRates,
  setExchangeRates,
  convertToUSD
};
