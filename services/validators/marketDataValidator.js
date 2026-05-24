/**
 * Market Data Validator - Validates market data integrity and consistency
 * 
 * ENHANCEMENT: Consolidates validation logic scattered across polymarketService.js
 * CONSOLIDATION: Single source for all market data validation
 */

export class MarketDataValidator {
  
  /**
   * Main market data validation entry point
   * @param {string} dataType - Type of market data (market, pricing, metadata, orderbook)
   * @param {object} data - Market data to validate
   * @param {object} context - Additional validation context
   */
  static validateMarketData(dataType, data, context = {}) {
    switch (dataType) {
      case 'market':
        return this.validateMarket(data, context);
      case 'pricing':
        return this.validatePricing(data, context);
      case 'metadata':
        return this.validateMetadata(data, context);
      case 'orderbook':
        return this.validateOrderBook(data, context);
      case 'volume':
        return this.validateVolume(data, context);
      default:
        return {
          valid: false,
          errors: [`Unknown market data type: ${dataType}`],
          warnings: [],
          category: 'market-data'
        };
    }
  }
  
  /**
   * MARKET VALIDATION - Core market structure
   */
  static validateMarket(marketData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      id,
      tokenID,
      title,
      description,
      endDate,
      resolutionDate,
      closed,
      resolved,
      tags
    } = marketData;
    
    // VALIDATION 1: Required fields
    if (!id && !tokenID) errors.push('Market must have ID or tokenID');
    if (!title && !marketData.question) errors.push('Market must have title or question');
    
    // VALIDATION 2: Date validation
    if (endDate) {
      const endDateTime = new Date(endDate);
      if (isNaN(endDateTime.getTime())) {
        errors.push('Invalid end date format');
      } else {
        const now = new Date();
        if (endDateTime < now && !closed) {
          warnings.push('Market end date has passed but market not marked as closed');
        }
      }
    }
    
    if (resolutionDate) {
      const resDateTime = new Date(resolutionDate);
      if (isNaN(resDateTime.getTime())) {
        errors.push('Invalid resolution date format');
      }
    }
    
    // VALIDATION 3: Status consistency
    if (resolved && !closed) {
      warnings.push('Market is resolved but not closed - potential data inconsistency');
    }
    
    // VALIDATION 4: Title/description quality
    if (title) {
      if (title.length < 10) {
        warnings.push('Very short market title - may lack context');
      }
      if (title.length > 200) {
        warnings.push('Very long market title - may be truncated in UI');
      }
      
      // Check for placeholder text
      const placeholderPatterns = [/test/i, /example/i, /placeholder/i, /lorem ipsum/i];
      if (placeholderPatterns.some(pattern => pattern.test(title))) {
        errors.push('Market title appears to contain placeholder text');
      }
    }
    
    // VALIDATION 5: Tags validation
    if (tags && Array.isArray(tags)) {
      tags.forEach((tag, index) => {
        if (!tag || (typeof tag === 'object' && !tag.label)) {
          warnings.push(`Empty or invalid tag at index ${index}`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'market-data'
    };
  }
  
  /**
   * PRICING VALIDATION - Validates odds, prices, and probabilities
   */
  static validatePricing(pricingData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      currentOdds,
      outcomePrices,
      bestBid,
      bestAsk,
      lastPrice,
      midPrice
    } = pricingData;
    
    // VALIDATION 1: Odds structure
    if (currentOdds) {
      const { yes, no } = currentOdds;
      
      if (yes !== undefined) {
        if (isNaN(parseFloat(yes))) {
          errors.push('Yes odds must be numeric');
        } else {
          const yesNum = parseFloat(yes);
          if (yesNum < 0 || yesNum > 1) {
            errors.push('Yes odds must be between 0 and 1');
          }
        }
      }
      
      if (no !== undefined) {
        if (isNaN(parseFloat(no))) {
          errors.push('No odds must be numeric');
        } else {
          const noNum = parseFloat(no);
          if (noNum < 0 || noNum > 1) {
            errors.push('No odds must be between 0 and 1');
          }
        }
      }
      
      // Check for probability consistency
      if (yes !== undefined && no !== undefined) {
        const yesNum = parseFloat(yes);
        const noNum = parseFloat(no);
        const total = yesNum + noNum;
        
        if (Math.abs(total - 1) > 0.1) {
          warnings.push(`Yes/No probabilities sum to ${total.toFixed(3)}, expected ~1.0`);
        }
      }
    }
    
    // VALIDATION 2: Outcome prices array
    if (outcomePrices && Array.isArray(outcomePrices)) {
      outcomePrices.forEach((price, index) => {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum)) {
          errors.push(`Invalid price at outcome ${index}: ${price}`);
        } else if (priceNum < 0 || priceNum > 1) {
          errors.push(`Price at outcome ${index} out of range: ${priceNum}`);
        }
      });
    }
    
    // VALIDATION 3: Bid/Ask validation
    if (bestBid !== undefined && bestAsk !== undefined) {
      const bidNum = parseFloat(bestBid);
      const askNum = parseFloat(bestAsk);
      
      if (!isNaN(bidNum) && !isNaN(askNum)) {
        if (bidNum > askNum) {
          errors.push(`Best bid (${bidNum}) greater than best ask (${askNum}) - invalid market`);
        }
        
        const spread = askNum - bidNum;
        if (spread > 0.2) {
          warnings.push(`Wide spread: ${(spread * 100).toFixed(1)}% - low liquidity market`);
        }
      }
    }
    
    // VALIDATION 4: Price reasonableness
    if (lastPrice !== undefined) {
      const lastNum = parseFloat(lastPrice);
      if (!isNaN(lastNum)) {
        if (lastNum < 0.001) {
          warnings.push('Very low last price - market may be illiquid');
        }
        if (lastNum > 0.999) {
          warnings.push('Very high last price - limited upside potential');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'market-data'
    };
  }
  
  /**
   * METADATA VALIDATION - Validates market metadata and enrichment
   */
  static validateMetadata(metadataData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      location,
      teams,
      eventType,
      venue,
      extractedData
    } = metadataData;
    
    // VALIDATION 1: Location data
    if (location) {
      if (typeof location !== 'string' || location.length < 2) {
        warnings.push('Location appears invalid or too short');
      }
      
      // Check for obviously incorrect locations
      const suspiciousLocations = ['unknown', 'n/a', 'null', 'undefined', 'test'];
      if (suspiciousLocations.includes(location.toLowerCase())) {
        warnings.push('Location appears to be placeholder data');
      }
    }
    
    // VALIDATION 2: Teams data structure
    if (teams && Array.isArray(teams)) {
      teams.forEach((team, index) => {
        if (!team.name || typeof team.name !== 'string') {
          warnings.push(`Invalid team name at index ${index}`);
        }
        if (!team.sport || typeof team.sport !== 'string') {
          warnings.push(`Missing sport for team at index ${index}`);
        }
      });
      
      // Check for duplicate teams
      const teamNames = teams.map(t => t.name).filter(Boolean);
      const uniqueNames = [...new Set(teamNames)];
      if (teamNames.length !== uniqueNames.length) {
        warnings.push('Duplicate teams detected');
      }
    }
    
    // VALIDATION 3: Event type consistency
    if (eventType && teams && teams.length > 0) {
      const teamSports = [...new Set(teams.map(t => t.sport))];
      if (teamSports.length > 1) {
        warnings.push('Teams from different sports in same event');
      } else if (teamSports[0] !== eventType) {
        warnings.push(`Event type (${eventType}) doesn't match team sport (${teamSports[0]})`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'market-data'
    };
  }
  
  /**
   * ORDER BOOK VALIDATION - Validates order book data structure
   */
  static validateOrderBook(orderBookData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      bids,
      asks,
      bestBid,
      bestAsk,
      spread,
      totalDepth
    } = orderBookData;
    
    // VALIDATION 1: Basic structure
    if (bids && !Array.isArray(bids)) {
      errors.push('Bids must be an array');
    }
    if (asks && !Array.isArray(asks)) {
      errors.push('Asks must be an array');
    }
    
    // VALIDATION 2: Bid validation
    if (bids && Array.isArray(bids)) {
      bids.forEach((bid, index) => {
        if (!bid.price || !bid.size) {
          errors.push(`Invalid bid at index ${index}: missing price or size`);
        } else {
          const price = parseFloat(bid.price);
          const size = parseFloat(bid.size);
          if (isNaN(price) || isNaN(size)) {
            errors.push(`Invalid bid at index ${index}: non-numeric values`);
          } else if (price <= 0 || size <= 0) {
            errors.push(`Invalid bid at index ${index}: price or size <= 0`);
          }
        }
      });
      
      // Check bid ordering (should be descending by price)
      for (let i = 1; i < bids.length; i++) {
        const prevPrice = parseFloat(bids[i-1].price);
        const currPrice = parseFloat(bids[i].price);
        if (!isNaN(prevPrice) && !isNaN(currPrice) && currPrice > prevPrice) {
          warnings.push('Bids not properly ordered (should be descending by price)');
          break;
        }
      }
    }
    
    // VALIDATION 3: Ask validation
    if (asks && Array.isArray(asks)) {
      asks.forEach((ask, index) => {
        if (!ask.price || !ask.size) {
          errors.push(`Invalid ask at index ${index}: missing price or size`);
        } else {
          const price = parseFloat(ask.price);
          const size = parseFloat(ask.size);
          if (isNaN(price) || isNaN(size)) {
            errors.push(`Invalid ask at index ${index}: non-numeric values`);
          } else if (price <= 0 || size <= 0) {
            errors.push(`Invalid ask at index ${index}: price or size <= 0`);
          }
        }
      });
      
      // Check ask ordering (should be ascending by price)
      for (let i = 1; i < asks.length; i++) {
        const prevPrice = parseFloat(asks[i-1].price);
        const currPrice = parseFloat(asks[i].price);
        if (!isNaN(prevPrice) && !isNaN(currPrice) && currPrice < prevPrice) {
          warnings.push('Asks not properly ordered (should be ascending by price)');
          break;
        }
      }
    }
    
    // VALIDATION 4: Best bid/ask consistency
    if (bestBid && bids && bids.length > 0) {
      const topBidPrice = parseFloat(bids[0].price);
      const bestBidPrice = parseFloat(bestBid);
      if (!isNaN(topBidPrice) && !isNaN(bestBidPrice) && Math.abs(topBidPrice - bestBidPrice) > 0.001) {
        warnings.push('Best bid price inconsistent with top bid in order book');
      }
    }
    
    if (bestAsk && asks && asks.length > 0) {
      const topAskPrice = parseFloat(asks[0].price);
      const bestAskPrice = parseFloat(bestAsk);
      if (!isNaN(topAskPrice) && !isNaN(bestAskPrice) && Math.abs(topAskPrice - bestAskPrice) > 0.001) {
        warnings.push('Best ask price inconsistent with top ask in order book');
      }
    }
    
    // VALIDATION 5: Depth analysis
    if (totalDepth !== undefined) {
      const totalDepthNum = parseFloat(totalDepth);
      if (isNaN(totalDepthNum) || totalDepthNum < 0) {
        errors.push('Invalid total depth value');
      } else if (totalDepthNum < 100) {
        warnings.push('Low market depth - expect high price impact');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'market-data'
    };
  }
  
  /**
   * VOLUME VALIDATION - Validates trading volume data
   */
  static validateVolume(volumeData, context = {}) {
    const errors = [];
    const warnings = [];
    
    const {
      volume24h,
      volume1wk,
      volume1mo,
      volumeTrend,
      lastUpdated
    } = volumeData;
    
    // VALIDATION 1: Volume values
    [
      { key: 'volume24h', value: volume24h, name: '24-hour volume' },
      { key: 'volume1wk', value: volume1wk, name: '1-week volume' },
      { key: 'volume1mo', value: volume1mo, name: '1-month volume' }
    ].forEach(({ key, value, name }) => {
      if (value !== undefined) {
        const volNum = parseFloat(value);
        if (isNaN(volNum)) {
          errors.push(`Invalid ${name}: ${value}`);
        } else if (volNum < 0) {
          errors.push(`${name} cannot be negative`);
        }
      }
    });
    
    // VALIDATION 2: Volume consistency
    if (volume24h !== undefined && volume1wk !== undefined) {
      const daily = parseFloat(volume24h);
      const weekly = parseFloat(volume1wk);
      if (!isNaN(daily) && !isNaN(weekly) && daily > weekly) {
        warnings.push('24h volume greater than 1-week volume - unusual pattern');
      }
    }
    
    // VALIDATION 3: Volume trend
    if (volumeTrend !== undefined) {
      const trendNum = parseFloat(volumeTrend);
      if (isNaN(trendNum)) {
        errors.push('Invalid volume trend value');
      } else if (Math.abs(trendNum) > 1000) {
        warnings.push('Extreme volume trend - verify data accuracy');
      }
    }
    
    // VALIDATION 4: Data freshness
    if (lastUpdated) {
      const updateTime = new Date(lastUpdated);
      if (isNaN(updateTime.getTime())) {
        warnings.push('Invalid last updated timestamp');
      } else {
        const hoursSinceUpdate = (Date.now() - updateTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          warnings.push('Volume data may be stale (>24 hours old)');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      category: 'market-data'
    };
  }
}