/**
 * API Input Validator - Validates API request inputs and parameters
 * 
 * ENHANCEMENT: Centralizes input validation scattered across API routes
 * CONSOLIDATION: Single source for all API input validation logic
 */

export class APIInputValidator {
  
  /**
   * Main API input validation entry point
   * @param {string} endpoint - API endpoint being validated
   * @param {object} input - Request input data
   * @param {object} context - Additional validation context
   */
  static validateAPIInput(endpoint, input, context = {}) {
    switch (endpoint) {
      case 'analyze':
        return this.validateAnalyzeRequest(input, context);
      case 'markets':
        return this.validateMarketsRequest(input, context);
      case 'orders':
        return this.validateOrdersRequest(input, context);
      case 'predictions':
        return this.validatePredictionsRequest(input, context);
      case 'weather':
        return this.validateWeatherRequest(input, context);
      case 'wallet':
        return this.validateWalletRequest(input, context);
      default:
        return this.validateGenericRequest(input, context);
    }
  }
  
  /**
   * ANALYZE ENDPOINT VALIDATION (/api/analyze)
   */
  static validateAnalyzeRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      marketId,
      location,
      weatherData,
      eventType,
      mode
    } = input;
    
    // VALIDATION 1: Required fields
    if (marketId === undefined || marketId === null) {
      errors.push('marketId is required');
    } else if (typeof marketId === 'string') {
      const trimmed = marketId.trim();
      if (trimmed.length < 2) {
        errors.push('marketId appears invalid');
      }
    } else if (typeof marketId === 'number') {
      if (!Number.isFinite(marketId) || marketId <= 0) {
        errors.push('marketId must be a positive number');
      }
    }
    
    // VALIDATION 2: Location validation
    if (!location) {
      warnings.push('No location provided - analysis may be limited');
    } else {
      if (typeof location === 'string') {
        if (location.length < 2) {
          errors.push('Location too short');
        }
        if (location.toLowerCase() === 'unknown') {
          warnings.push('Location is unknown - analysis may be inaccurate');
        }
      } else if (typeof location === 'object') {
        if (!location.name && !location.lat && !location.lon) {
          errors.push('Location object must have name or coordinates');
        }
      }
    }
    
    // VALIDATION 3: Weather data validation
    if (weatherData) {
      if (typeof weatherData !== 'object') {
        errors.push('weatherData must be an object');
      } else if (!weatherData.current && !weatherData.forecast) {
        warnings.push('Weather data lacks current or forecast information');
      }
    }
    
    // VALIDATION 4: Event type validation
    if (eventType && typeof eventType !== 'string') {
      errors.push('eventType must be a string');
    }
    
    // VALIDATION 5: Mode validation
    if (mode && !['basic', 'detailed', 'stream', 'deep'].includes(mode)) {
      errors.push('mode must be one of: basic, detailed, stream, deep');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * MARKETS ENDPOINT VALIDATION (/api/markets)
   */
  static validateMarketsRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      location,
      eventType,
      limit,
      minVolume,
      tags,
      filters
    } = input;
    
    // VALIDATION 1: Limit validation
    if (limit !== undefined) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum <= 0) {
        errors.push('limit must be a positive integer');
      } else if (limitNum > 100) {
        warnings.push('limit >100 may impact performance');
      }
    }
    
    // VALIDATION 2: Volume filter validation
    if (minVolume !== undefined) {
      const volumeNum = parseFloat(minVolume);
      if (isNaN(volumeNum) || volumeNum < 0) {
        errors.push('minVolume must be a non-negative number');
      } else if (volumeNum > 1000000) {
        warnings.push('Very high minVolume may return no results');
      }
    }
    
    // VALIDATION 3: Tags validation
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        errors.push('tags must be an array');
      } else {
        tags.forEach((tag, index) => {
          if (typeof tag !== 'string' || tag.length === 0) {
            errors.push(`Invalid tag at index ${index}`);
          }
        });
      }
    }
    
    // VALIDATION 4: Filters validation
    if (filters && typeof filters === 'object') {
      // Validate confidence filter
      if (filters.confidence && !['LOW', 'MEDIUM', 'HIGH', 'all'].includes(filters.confidence)) {
        errors.push('filters.confidence must be one of: LOW, MEDIUM, HIGH, all');
      }
      
      // Validate date range filters
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (isNaN(startDate.getTime())) {
          errors.push('filters.startDate invalid date format');
        }
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (isNaN(endDate.getTime())) {
          errors.push('filters.endDate invalid date format');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * ORDERS ENDPOINT VALIDATION (/api/orders)
   */
  static validateOrdersRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      marketID,
      price,
      side,
      size,
      walletAddress,
      chainId
    } = input;
    
    // VALIDATION 1: Required order fields
    if (!marketID) errors.push('marketID is required');
    if (!walletAddress) errors.push('walletAddress is required');
    if (price === undefined) errors.push('price is required');
    if (!side) errors.push('side is required');
    if (!size) errors.push('size is required');
    
    // VALIDATION 2: Price validation
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum)) {
        errors.push('price must be numeric');
      } else if (priceNum < 0 || priceNum > 1) {
        errors.push('price must be between 0 and 1');
      }
    }
    
    // VALIDATION 3: Side validation
    if (side && !['buy', 'sell', 'BUY', 'SELL'].includes(side)) {
      errors.push('side must be buy or sell');
    }
    
    // VALIDATION 4: Size validation
    if (size !== undefined) {
      const sizeNum = parseFloat(size);
      if (isNaN(sizeNum)) {
        errors.push('size must be numeric');
      } else if (sizeNum <= 0) {
        errors.push('size must be greater than 0');
      }
    }
    
    // VALIDATION 5: Wallet address validation
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      errors.push('Invalid wallet address format');
    }
    
    // VALIDATION 6: Chain ID validation
    if (chainId !== undefined) {
      const chainNum = parseInt(chainId);
      if (isNaN(chainNum) || chainNum <= 0) {
        errors.push('chainId must be a positive integer');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * PREDICTIONS ENDPOINT VALIDATION (/api/predictions)
   */
  static validatePredictionsRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { method } = context;
    
    if (method === 'GET') {
      // GET requests for retrieving predictions
      const { userId, marketId, limit, offset } = input;
      
      if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
          errors.push('limit must be between 1 and 1000');
        }
      }
      
      if (offset !== undefined) {
        const offsetNum = parseInt(offset);
        if (isNaN(offsetNum) || offsetNum < 0) {
          errors.push('offset must be non-negative');
        }
      }
    } else if (method === 'POST') {
      // POST requests for creating predictions
      return this.validateOrdersRequest(input, context); // Same validation as orders
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * WEATHER ENDPOINT VALIDATION (/api/weather)
   */
  static validateWeatherRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { location, lat, lon, days } = input;
    
    // VALIDATION 1: Location specification
    if (!location && (lat === undefined || lon === undefined)) {
      errors.push('Either location name or lat/lon coordinates required');
    }
    
    // VALIDATION 2: Coordinate validation
    if (lat !== undefined) {
      const latNum = parseFloat(lat);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        errors.push('lat must be between -90 and 90');
      }
    }
    
    if (lon !== undefined) {
      const lonNum = parseFloat(lon);
      if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        errors.push('lon must be between -180 and 180');
      }
    }
    
    // VALIDATION 3: Forecast days validation
    if (days !== undefined) {
      const daysNum = parseInt(days);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 10) {
        errors.push('days must be between 1 and 10');
      }
    }
    
    // VALIDATION 4: Location format validation
    if (location) {
      if (typeof location !== 'string') {
        errors.push('location must be a string');
      } else if (location.length < 2) {
        errors.push('location too short');
      } else if (location.length > 100) {
        warnings.push('Very long location name - may not be found');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * WALLET ENDPOINT VALIDATION (/api/wallet)
   */
  static validateWalletRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { walletAddress, chainId } = input;
    
    // VALIDATION 1: Wallet address validation
    if (!walletAddress) {
      errors.push('walletAddress is required');
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      errors.push('Invalid wallet address format');
    }
    
    // VALIDATION 2: Chain ID validation
    if (!chainId) {
      errors.push('chainId is required');
    } else {
      const chainNum = parseInt(chainId);
      if (isNaN(chainNum)) {
        errors.push('chainId must be numeric');
      } else {
        const supportedChains = [1, 137, 56]; // Ethereum, Polygon, BSC
        if (!supportedChains.includes(chainNum)) {
          warnings.push(`Chain ID ${chainNum} may not be fully supported`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
  
  /**
   * GENERIC REQUEST VALIDATION
   * Fallback validation for endpoints not explicitly handled
   */
  static validateGenericRequest(input, context = {}) {
    const errors = [];
    const warnings = [];
    
    // VALIDATION 1: Input type validation
    if (input && typeof input !== 'object') {
      errors.push('Request body must be an object');
    }
    
    // VALIDATION 2: Common field validation
    if (input && typeof input === 'object') {
      // Check for common problematic values
      Object.entries(input).forEach(([key, value]) => {
        if (value === null) {
          warnings.push(`Field '${key}' is null`);
        }
        if (typeof value === 'string' && value.trim() === '') {
          warnings.push(`Field '${key}' is empty string`);
        }
        if (typeof value === 'string' && value.length > 1000) {
          warnings.push(`Field '${key}' very long (${value.length} chars)`);
        }
      });
    }
    
    // VALIDATION 3: Request size validation
    if (input) {
      const inputSize = JSON.stringify(input).length;
      if (inputSize > 100000) { // 100KB
        warnings.push('Large request size may impact performance');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'api-input'
    };
  }
}
