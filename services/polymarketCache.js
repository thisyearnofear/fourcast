// Polymarket Cache State — shared singleton for all sub-modules
// Extracted from PolymarketService constructor + cache methods

// Singleton state object (mutable — modules mutate properties, never reassign the binding)
export const cache = {
  baseURL: 'https://gamma-api.polymarket.com',
  clobBaseURL: 'https://clob.polymarket.com',
  marketsCache: new Map(),
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes for market data
  marketDetailsCache: new Map(),
  MARKET_DETAILS_CACHE_DURATION: 10 * 60 * 1000, // 10 minutes for market details
  marketCatalogCache: {},
  MARKET_CATALOG_CACHE_DURATION: 30 * 60 * 1000, // 30 minutes for full catalog
  sportsMetadata: null,
  SPORTS_METADATA_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours for sports metadata
};

// Generate cache key for markets (location-based, for backward compatibility)
export function generateCacheKey(location) {
  return `markets_${location}`;
}

// Check if cached data is valid
export function getCachedMarkets(location) {
  const cacheKey = generateCacheKey(location);
  const cached = cache.marketsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cache.CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// Cache market data
export function setCachedMarkets(location, markets) {
  const cacheKey = generateCacheKey(location);
  cache.marketsCache.set(cacheKey, {
    data: markets,
    timestamp: Date.now()
  });
}

// Get market catalog from cache
export function getCachedCatalog(eventTypeFilter = null) {
  const cacheKey = eventTypeFilter || 'default';
  const cached = cache.marketCatalogCache?.[cacheKey];
  if (cached && Date.now() - cached.timestamp < cache.MARKET_CATALOG_CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// Cache the full market catalog
export function setCachedCatalog(markets, eventTypeFilter = null) {
  const cacheKey = eventTypeFilter || 'default';
  if (!cache.marketCatalogCache) {
    cache.marketCatalogCache = {};
  }
  cache.marketCatalogCache[cacheKey] = {
    data: markets,
    timestamp: Date.now()
  };
}

// Get status of Polymarket service
export function getStatus() {
  return {
    service: 'Polymarket Data & Trading Service',
    available: true,
    markets: {
      cache: cache.marketsCache.size,
      duration: `${cache.CACHE_DURATION / (60 * 1000)} minutes`
    },
    marketDetails: {
      cache: cache.marketDetailsCache.size,
      duration: `${cache.MARKET_DETAILS_CACHE_DURATION / (60 * 1000)} minutes`
    },
    baseURL: cache.baseURL,
    clobBaseURL: cache.clobBaseURL
  };
}
