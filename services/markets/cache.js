// Cache management utilities for market data

export class MarketCache {
  constructor() {
    this.cache = new Map();
    this.detailsCache = new Map();
    this.catalogCache = {};
  }

  // Generate cache key for markets
  generateKey(location) {
    return `markets_${location}`;
  }

  // Check if cached data is valid
  get(location, duration = 5 * 60 * 1000) {
    const cacheKey = this.generateKey(location);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > duration;
    return isExpired ? null : cached.data;
  }

  // Store data in cache
  set(location, data) {
    const cacheKey = this.generateKey(location);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear expired entries
  cleanup(duration = 5 * 60 * 1000) {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > duration) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.detailsCache.clear();
    this.catalogCache = {};
  }
}