// Validation utilities

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate wallet address
 * @param {string} address - Wallet address to validate
 * @returns {boolean} True if valid wallet address
 */
export function isValidWalletAddress(address) {
  // Basic Ethereum address validation
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  // Basic Aptos address validation
  const aptosRegex = /^0x[a-fA-F0-9]{1,64}$/;
  
  return ethRegex.test(address) || aptosRegex.test(address);
}

/**
 * Validate numeric input
 * @param {any} value - Value to validate
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {boolean} options.allowZero - Allow zero values
 * @returns {boolean} True if valid
 */
export function isValidNumber(value, options = {}) {
  const num = Number(value);
  
  if (isNaN(num)) return false;
  if (!options.allowZero && num === 0) return false;
  if (options.min !== undefined && num < options.min) return false;
  if (options.max !== undefined && num > options.max) return false;
  
  return true;
}

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Array<string>} Array of missing field names
 */
export function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!data[field] || data[field] === '') {
      missing.push(field);
    }
  });
  
  return missing;
}

/**
 * Validate market data structure
 * @param {Object} market - Market object to validate
 * @returns {boolean} True if valid market structure
 */
export function isValidMarket(market) {
  const requiredFields = ['marketID', 'title', 'currentOdds'];
  return validateRequiredFields(market, requiredFields).length === 0;
}