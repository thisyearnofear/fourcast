/**
 * Shared market filtering utilities following DRY principle
 * Single source of truth for volume and quality filtering logic
 */

/**
 * Normalize and filter market volume across different platforms
 * @param {Array} markets - Array of market objects
 * @param {Object} filters - Filtering criteria
 * @param {number} filters.minVolume - Minimum volume threshold
 * @param {string} platform - Platform identifier ('polymarket' or 'kalshi')
 * @returns {Array} Filtered markets
 */
export function filterMarketsByVolume(markets, filters, platform = 'polymarket') {
  const { minVolume = 50000 } = filters;
  
  return markets.filter(market => {
    const volume = parseFloat(market.volume24h || market.volume || 0);
    
    // Platform-specific volume normalization
    if (platform === 'kalshi') {
      // Kalshi volume is in contracts (~$1 each), so we scale appropriately
      // Lower threshold for Kalshi to capture more active markets
      const minContracts = Math.max(5, minVolume / 1000);
      return volume >= minContracts;
    } else {
      // Polymarket and others use dollar volume
      return volume >= minVolume;
    }
  });
}

/**
 * Apply comprehensive market quality filters
 * @param {Array} markets - Array of market objects
 * @param {Object} filters - Various filtering criteria
 * @returns {Array} High-quality markets
 */
export function applyMarketQualityFilters(markets, filters) {
  const {
    minLiquidity = 1000,
    maxDaysToResolution = 30,
    excludeFutures = true,
    searchText = null
  } = filters;

  return markets.filter(market => {
    // Liquidity check
    const liquidity = parseFloat(market.liquidity || 0);
    if (liquidity < minLiquidity) return false;

    // Resolution date check
    if (market.resolutionDate) {
      const resolutionTime = new Date(market.resolutionDate).getTime();
      const now = Date.now();
      const daysToResolution = (resolutionTime - now) / (1000 * 60 * 60 * 24);
      
      if (daysToResolution > maxDaysToResolution || daysToResolution < 0) {
        return false;
      }
    }

    // Futures filtering
    if (excludeFutures && isFutureMarket(market)) {
      return false;
    }

    // Text search filtering
    if (searchText) {
      const searchableText = `${market.title} ${market.description} ${market.tags?.join(' ') || ''}`.toLowerCase();
      if (!searchableText.includes(searchText.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if a market is a future/long-term market
 * @param {Object} market - Market object
 * @returns {boolean} True if market is a future
 */
function isFutureMarket(market) {
  const title = (market.title || '').toLowerCase();
  const description = (market.description || '').toLowerCase();
  
  const futureKeywords = [
    '2027', '2028', '2029', '2030', 'long-term', 'future',
    'presidential election 2028', 'next president', '2028 election'
  ];
  
  return futureKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  );
}

/**
 * Sort markets by quality score (volume + liquidity + recency)
 * @param {Array} markets - Array of market objects
 * @returns {Array} Sorted markets
 */
export function sortMarketsByQuality(markets) {
  return [...markets].sort((a, b) => {
    const scoreA = calculateMarketQualityScore(a);
    const scoreB = calculateMarketQualityScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Calculate a quality score for a market based on multiple factors
 * @param {Object} market - Market object
 * @returns {number} Quality score
 */
function calculateMarketQualityScore(market) {
  const volume = parseFloat(market.volume24h || market.volume || 0);
  const liquidity = parseFloat(market.liquidity || 0);
  
  // Weight different factors
  let score = 0;
  score += volume * 0.4;      // 40% weight to volume
  score += liquidity * 0.3;   // 30% weight to liquidity
  score += Math.random() * 0.3; // 30% random factor for discovery
  
  return score;
}

/**
 * Merge and deduplicate markets from multiple platforms
 * @param {Array} polymarketMarkets - Polymarket markets
 * @param {Array} kalshiMarkets - Kalshi markets
 * @returns {Array} Merged unique markets
 */
export function mergeAndDeduplicateMarkets(polymarketMarkets, kalshiMarkets) {
  const marketMap = new Map();
  
  // Add Polymarket markets
  polymarketMarkets.forEach(market => {
    const key = `${market.title}-${market.platform}`.toLowerCase();
    if (!marketMap.has(key)) {
      marketMap.set(key, { ...market, sourcePlatforms: ['polymarket'] });
    }
  });
  
  // Add Kalshi markets, merge if similar
  kalshiMarkets.forEach(market => {
    const key = `${market.title}-${market.platform}`.toLowerCase();
    if (marketMap.has(key)) {
      // Merge with existing market
      const existing = marketMap.get(key);
      existing.sourcePlatforms.push('kalshi');
      // Keep the version with higher volume
      if ((market.volume24h || 0) > (existing.volume24h || 0)) {
        marketMap.set(key, { ...market, sourcePlatforms: existing.sourcePlatforms });
      }
    } else {
      marketMap.set(key, { ...market, sourcePlatforms: ['kalshi'] });
    }
  });
  
  return Array.from(marketMap.values());
}