/**
 * Trading Validator - Comprehensive validation for trading operations
 * 
 * ENHANCEMENT: Consolidates and extends validation from tradingService.js and polymarketService.js
 * CONSOLIDATION: Removes duplicated order validation logic
 */

export class TradingValidator {
  
  /**
   * Main trading validation entry point
   * @param {string} operation - Type of trading operation (order, wallet, market-access)
   * @param {object} data - Trading operation data
   * @param {object} context - Additional context (market data, user preferences, etc.)
   */
  static validateTradingOperation(operation, data, context = {}) {
    switch (operation) {
      case 'order':
        return this.validateOrder(data, context);
      case 'wallet':
        return this.validateWallet(data, context);
      case 'market-access':
        return this.validateMarketAccess(data, context);
      case 'price-impact':
        return this.validatePriceImpact(data, context);
      default:
        return {
          valid: false,
          errors: [`Unknown trading operation: ${operation}`],
          warnings: [],
          category: 'trading'
        };
    }
  }
  
  /**
   * ORDER VALIDATION - Enhanced from existing logic
   * Consolidates validation from tradingService.js (lines 45-65) and polymarketService.js (lines 1599-1632)
   */
  static validateOrder(orderData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { 
      price, 
      size, 
      side, 
      marketID, 
      walletAddress, 
      chainId 
    } = orderData;
    
    const { 
      walletStatus, 
      marketData, 
      userPreferences = {} 
    } = context;
    
    // VALIDATION 1: Required fields
    if (!marketID) errors.push('Market ID is required');
    if (!walletAddress) errors.push('Wallet address is required');
    if (!price && price !== 0) errors.push('Price is required');
    if (!size) errors.push('Order size is required');
    if (!side) errors.push('Order side (buy/sell) is required');
    
    // VALIDATION 2: Price constraints
    if (typeof price === 'number') {
      if (price < 0) errors.push('Price cannot be negative');
      if (price > 1) errors.push('Price cannot exceed 1.00 (100%)');
      
      // Check for unusual pricing patterns
      if (price < 0.01) warnings.push('Very low price - ensure this is intentional');
      if (price > 0.99) warnings.push('Very high price - limited upside potential');
    }
    
    // VALIDATION 3: Size constraints
    if (typeof size === 'number') {
      if (size <= 0) errors.push('Order size must be greater than zero');
      
      // Check for large position sizes
      if (size > 10000) warnings.push('Large position size - consider market impact');
    }
    
    // VALIDATION 4: Market-specific validation
    if (marketData) {
      const tickSize = parseFloat(marketData.tradingMetadata?.tickSize || '0.001');
      
      // Price precision validation
      if (typeof price === 'number' && tickSize > 0) {
        const remainder = price % tickSize;
        if (Math.abs(remainder) > 0.000001) { // Allow for floating point precision
          errors.push(`Price must align with tick size ${tickSize}. Nearest valid prices: ${Math.floor(price / tickSize) * tickSize}, ${Math.ceil(price / tickSize) * tickSize}`);
        }
      }
      
      // Market status validation
      if (marketData.closed) {
        errors.push('Cannot place orders on closed markets');
      }
      
      if (marketData.resolved) {
        errors.push('Cannot place orders on resolved markets');
      }
      
      // Expiration validation
      if (marketData.endDate) {
        const expirationDate = new Date(marketData.endDate);
        const now = new Date();
        if (expirationDate <= now) {
          errors.push('Market has expired');
        } else if (expirationDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
          warnings.push('Market expires within 24 hours');
        }
      }
    }
    
    // VALIDATION 5: Wallet and balance validation (enhanced from tradingService.js)
    if (walletStatus) {
      const orderCost = this.calculateOrderCost(price, size);
      const availableBalance = parseFloat(walletStatus.balance?.formatted || '0');
      
      if (orderCost.total > availableBalance) {
        errors.push(`Insufficient balance. Need ${orderCost.total} but have ${availableBalance}`);
      } else if (orderCost.total > availableBalance * 0.9) {
        warnings.push('Order uses >90% of available balance');
      }
      
      // Check for wallet approval status
      if (!walletStatus.approved && walletStatus.approved !== undefined) {
        errors.push('Wallet not approved for trading');
      }
    }
    
    // VALIDATION 6: Risk management checks
    if (userPreferences.maxPositionSize && size > userPreferences.maxPositionSize) {
      warnings.push(`Order size exceeds your maximum position limit (${userPreferences.maxPositionSize})`);
    }
    
    if (userPreferences.riskLevel === 'conservative') {
      if ((price < 0.1 || price > 0.9) && side === 'buy') {
        warnings.push('Conservative risk profile: Consider avoiding extreme probability trades');
      }
    }
    
    // VALIDATION 7: Market liquidity and impact
    if (marketData?.liquidity) {
      const liquidityRatio = size / parseFloat(marketData.liquidity);
      if (liquidityRatio > 0.1) {
        warnings.push('Large order relative to market liquidity - expect price impact');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'trading',
      orderCost: this.calculateOrderCost(price, size),
      riskLevel: this.assessOrderRisk(orderData, context)
    };
  }
  
  /**
   * WALLET VALIDATION
   */
  static validateWallet(walletData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { address, chainId, balance } = walletData;
    
    // Basic wallet validation
    if (!address) errors.push('Wallet address is required');
    if (address && !this.isValidAddress(address)) {
      errors.push('Invalid wallet address format');
    }
    
    // Chain validation
    const supportedChains = [1, 137, 56]; // Ethereum, Polygon, BSC
    if (chainId && !supportedChains.includes(chainId)) {
      errors.push(`Unsupported chain ID: ${chainId}`);
    }
    
    // Balance validation
    if (balance !== undefined) {
      const balanceNum = parseFloat(balance);
      if (isNaN(balanceNum)) {
        errors.push('Invalid balance format');
      } else if (balanceNum < 0) {
        errors.push('Balance cannot be negative');
      } else if (balanceNum < 10) {
        warnings.push('Low balance - may limit trading options');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'trading'
    };
  }
  
  /**
   * MARKET ACCESS VALIDATION
   * Validates if user can access specific markets based on location, regulations, etc.
   */
  static validateMarketAccess(accessData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const { 
      userLocation, 
      marketType, 
      marketJurisdiction,
      userAge 
    } = accessData;
    
    // Age restrictions
    if (userAge && userAge < 18) {
      errors.push('Must be 18 or older to participate in prediction markets');
    }
    
    // Geographic restrictions (simplified - would need real compliance data)
    const restrictedRegions = ['NY', 'Washington']; // Example restrictions
    if (userLocation && restrictedRegions.includes(userLocation)) {
      errors.push(`Prediction markets may not be available in ${userLocation}`);
    }
    
    // Market-specific restrictions
    if (marketType === 'sports' && userLocation) {
      // Sports betting restrictions vary by jurisdiction
      const sportsBettingRestricted = ['ID', 'UT', 'WA'];
      if (sportsBettingRestricted.includes(userLocation)) {
        warnings.push('Sports-related markets may have additional restrictions in your area');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'trading'
    };
  }
  
  /**
   * PRICE IMPACT VALIDATION
   * Validates potential market impact of large orders
   */
  static validatePriceImpact(orderData, context = {}) {
    const warnings = [];
    const { size, price, side } = orderData;
    const { marketData } = context;
    
    if (!marketData?.orderBookMetrics) {
      return {
        valid: true,
        errors: [],
        warnings: ['Cannot assess price impact - order book data unavailable'],
        category: 'trading'
      };
    }
    
    const { bidDepth, askDepth, spread } = marketData.orderBookMetrics;
    const relevantDepth = side === 'buy' ? askDepth : bidDepth;
    
    if (size > relevantDepth * 0.5) {
      warnings.push('Order size >50% of market depth - expect significant price impact');
    }
    
    if (spread > 0.05) {
      warnings.push('Wide bid-ask spread - consider market timing');
    }
    
    // Calculate estimated price impact
    const estimatedImpact = this.estimatePriceImpact(size, relevantDepth, spread);
    if (estimatedImpact > 0.02) {
      warnings.push(`Estimated price impact: ${(estimatedImpact * 100).toFixed(1)}%`);
    }
    
    return {
      valid: true,
      errors: [],
      warnings,
      category: 'trading',
      estimatedPriceImpact: estimatedImpact
    };
  }
  
  /**
   * Helper: Calculate order cost (enhanced from tradingService.js)
   */
  static calculateOrderCost(price, size, feeRateBps = 0) {
    if (!price || !size) return { baseCost: 0, fee: 0, total: 0 };
    
    const baseCost = price * size;
    const fee = baseCost * (feeRateBps / 10000);
    
    return {
      baseCost: parseFloat(baseCost.toFixed(6)),
      fee: parseFloat(fee.toFixed(6)),
      total: parseFloat((baseCost + fee).toFixed(6))
    };
  }
  
  /**
   * Helper: Assess order risk level
   */
  static assessOrderRisk(orderData, context = {}) {
    const { price, size } = orderData;
    const { marketData } = context;
    
    let riskScore = 0;
    
    // Price-based risk
    if (price < 0.1 || price > 0.9) riskScore += 2;
    else if (price < 0.2 || price > 0.8) riskScore += 1;
    
    // Size-based risk
    const orderValue = price * size;
    if (orderValue > 1000) riskScore += 2;
    else if (orderValue > 500) riskScore += 1;
    
    // Liquidity risk
    if (marketData?.liquidity) {
      const liquidityRatio = size / parseFloat(marketData.liquidity);
      if (liquidityRatio > 0.1) riskScore += 2;
      else if (liquidityRatio > 0.05) riskScore += 1;
    }
    
    if (riskScore >= 4) return 'HIGH';
    if (riskScore >= 2) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Helper: Validate Ethereum address format
   */
  static isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
  
  /**
   * Helper: Estimate price impact
   */
  static estimatePriceImpact(orderSize, marketDepth, spread) {
    if (!marketDepth || marketDepth === 0) return 0;
    
    const depthImpact = Math.min(orderSize / marketDepth, 1) * 0.1; // Max 10% impact from depth
    const spreadImpact = spread * 0.5; // Half of spread as baseline impact
    
    return Math.min(depthImpact + spreadImpact, 0.2); // Cap at 20% impact
  }
}