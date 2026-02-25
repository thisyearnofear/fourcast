/**
 * SynthData Service - Probabilistic price forecasts from decentralized ML ensemble
 * Provides quantitative predictions for crypto/equity/commodity markets
 * via Bittensor Subnet 50 (200+ competing ML models)
 *
 * Supported assets: BTC, ETH, SOL, XAU, SPY, NVDA, GOOGL, TSLA, AAPL
 */

import { getRedisClient } from './redisService.js';

const BASE_URL = 'https://api.synthdata.co';
const CACHE_TTL = 15 * 60; // 15 minutes - predictions refresh frequently
const POLYMARKET_CACHE_TTL = 5 * 60; // 5 minutes for Polymarket comparisons
const TTL_VARIANCE = 0.1; // 10% variance to prevent thundering herd

/**
 * Add random variance to TTL to prevent cache stampede
 * @param {number} baseTTL - Base TTL in seconds
 * @returns {number} TTL with variance
 */
function getTTLWithVariance(baseTTL) {
  const variance = baseTTL * TTL_VARIANCE;
  const randomOffset = (Math.random() * 2 - 1) * variance; // -10% to +10%
  return Math.floor(baseTTL + randomOffset);
}

// Cache statistics for monitoring
const cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  lastReset: Date.now(),
};

/**
 * Get cache statistics
 * @returns {Object} Cache hit rate and stats
 */
function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? (cacheStats.hits / total * 100).toFixed(1) : 0;
  const uptime = Math.floor((Date.now() - cacheStats.lastReset) / 1000 / 60); // minutes
  
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    errors: cacheStats.errors,
    total,
    hitRate: `${hitRate}%`,
    uptimeMinutes: uptime,
  };
}

/**
 * Reset cache statistics
 */
function resetCacheStats() {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.errors = 0;
  cacheStats.lastReset = Date.now();
}

// Asset symbol mapping: market title keywords → SynthData asset codes
const ASSET_PATTERNS = [
  { asset: 'BTC', keywords: ['bitcoin', 'btc', '₿ '] },
  { asset: 'ETH', keywords: ['ethereum', 'eth', 'ether'] },
  { asset: 'SOL', keywords: ['solana', 'sol'] },
  { asset: 'XAU', keywords: ['gold', 'xau'] },
  { asset: 'SPY', keywords: ['s&p 500', 's&p500', 'spy', 'sp500', 'sp 500'] },
  { asset: 'NVDA', keywords: ['nvidia', 'nvda', 'nvdia'] },
  { asset: 'GOOGL', keywords: ['google', 'googl', 'alphabet'] },
  { asset: 'TSLA', keywords: ['tesla', 'tsla'] },
  { asset: 'AAPL', keywords: ['apple', 'aapl'] },
];

const SUPPORTED_ASSETS = ASSET_PATTERNS.map(p => p.asset);

// Categories where Synth is most relevant
const SYNTH_RELEVANT_CATEGORIES = [
  'Crypto',
  'Business', 
  'Finance',
  'Economics',
  'Technology',
  'Stocks',
  'Commodities'
];

/**
 * Check if a market category is likely to benefit from Synth analysis
 * @param {string} category - Market category
 * @returns {boolean}
 */
function isSynthRelevantCategory(category) {
  if (!category) return false;
  return SYNTH_RELEVANT_CATEGORIES.some(c => 
    category.toLowerCase().includes(c.toLowerCase())
  );
}

/**
 * Detect SynthData-supported asset from market title/description
 * @returns {string|null} Asset code (e.g., 'BTC') or null if unsupported
 */
function detectAsset(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  for (const { asset, keywords } of ASSET_PATTERNS) {
    if (keywords.some(kw => text.includes(kw))) return asset;
  }
  return null;
}

async function fetchSynth(endpoint, params = {}) {
  const apiKey = process.env.SYNTH_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Apikey ${apiKey}` },
  });

  if (!response.ok) {
    console.error(`SynthData ${endpoint} failed: ${response.status}`);
    return null;
  }

  return response.json();
}

async function cachedFetch(cacheKey, ttl, fetcher) {
  // Try Redis first
  try {
    const redis = await getRedisClient();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        cacheStats.hits++;
        if (cacheStats.hits % 10 === 0) {
          // Log every 10th hit to avoid spam
          console.log(`[Synth Cache] Stats:`, getCacheStats());
        }
        return JSON.parse(cached);
      }
    }
  } catch (e) {
    cacheStats.errors++;
    // Redis unavailable, proceed without cache
  }

  cacheStats.misses++;
  const data = await fetcher();
  if (!data) return null;

  // Cache result
  try {
    const redis = await getRedisClient();
    if (redis) {
      const ttlWithVariance = getTTLWithVariance(ttl);
      await redis.setEx(cacheKey, ttlWithVariance, JSON.stringify(data));
    }
  } catch (e) {
    cacheStats.errors++;
    // Cache write failed, non-critical
  }

  return data;
}

export const synthService = {
  SUPPORTED_ASSETS,
  SYNTH_RELEVANT_CATEGORIES,
  detectAsset,
  isSynthRelevantCategory,
  getCacheStats,
  resetCacheStats,

  /**
   * Invalidate cache for a specific asset
   * Useful when you know data is stale (e.g., major price movement)
   * @param {string} asset - Asset code to invalidate
   * @returns {Promise<Object>} Invalidation results
   */
  async invalidateCache(asset) {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return { success: false, reason: 'Redis not available' };
      }

      // Find all keys for this asset
      const patterns = [
        `synth:percentiles:${asset}:*`,
        `synth:volatility:${asset}:*`,
        `synth:polymarket:*:${asset}:*`,
        `synth:liquidation:${asset}:*`,
        `synth:lp-probs:${asset}:*`,
      ];

      let deletedCount = 0;
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map(k => redis.del(k)));
          deletedCount += keys.length;
        }
      }

      console.log(`[Synth Cache] Invalidated ${deletedCount} keys for ${asset}`);
      return { success: true, deletedCount, asset };
    } catch (err) {
      console.error(`[Synth Cache] Invalidation failed for ${asset}:`, err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Invalidate all Synth cache
   * Nuclear option - use sparingly
   */
  async invalidateAllCache() {
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return { success: false, reason: 'Redis not available' };
      }

      const keys = await redis.keys('synth:*');
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }

      console.log(`[Synth Cache] Invalidated all cache (${keys.length} keys)`);
      return { success: true, deletedCount: keys.length };
    } catch (err) {
      console.error('[Synth Cache] Full invalidation failed:', err);
      return { success: false, error: err.message };
    }
  },
   * Pre-fetches forecasts for high-traffic assets to reduce latency
   * @param {Array<string>} assets - Asset codes to warm (defaults to top 3)
   * @returns {Promise<Object>} Warming results
   */
  async warmCache(assets = ['BTC', 'ETH', 'SOL']) {
    if (!this.isAvailable()) {
      return { success: false, reason: 'SynthData not available' };
    }

    console.log(`[Synth Cache] Warming cache for ${assets.length} assets...`);
    const results = { success: 0, failed: 0, assets: {} };

    await Promise.allSettled(
      assets.map(async (asset) => {
        try {
          const forecast = await this.buildForecast(asset, { 
            horizon: '24h',
            includePolymarket: true 
          });
          
          if (forecast) {
            results.success++;
            results.assets[asset] = 'warmed';
          } else {
            results.failed++;
            results.assets[asset] = 'failed';
          }
        } catch (err) {
          results.failed++;
          results.assets[asset] = `error: ${err.message}`;
        }
      })
    );

    console.log(`[Synth Cache] Warming complete:`, results);
    return results;
  },

  /**
   * Get prediction percentiles for an asset (p0.5 through p99.5)
   * Core endpoint: full probability distribution of expected price movements
   */
  async getPredictionPercentiles(asset, horizon = '24h') {
    return cachedFetch(
      `synth:percentiles:${asset}:${horizon}`,
      CACHE_TTL,
      () => fetchSynth('/prediction-percentiles', { asset, horizon })
    );
  },

  /**
   * Get volatility forecast and realized volatility comparison
   */
  async getVolatility(asset, horizon = '24h') {
    return cachedFetch(
      `synth:volatility:${asset}:${horizon}`,
      CACHE_TTL,
      () => fetchSynth('/insights/volatility', { asset, horizon })
    );
  },

  /**
   * Get Polymarket up/down comparison with SynthData fair probabilities
   * Directly compares ML-derived fair odds vs. live Polymarket odds
   */
  async getPolymarketUpDown(asset, horizon = '24h') {
    return cachedFetch(
      `synth:polymarket:updown:${asset}:${horizon}`,
      POLYMARKET_CACHE_TTL,
      () => fetchSynth(`/insights/polymarket/up-down/${horizon === '1h' ? 'hourly' : 'daily'}`, { asset, horizon })
    );
  },

  /**
   * Get Polymarket price range comparison
   */
  async getPolymarketRange(asset, horizon = '24h') {
    return cachedFetch(
      `synth:polymarket:range:${asset}:${horizon}`,
      POLYMARKET_CACHE_TTL,
      () => fetchSynth('/insights/polymarket/range', { asset, horizon })
    );
  },

  /**
   * Get liquidation probability estimates at various price levels
   */
  async getLiquidationProbability(asset, horizon = '24h') {
    return cachedFetch(
      `synth:liquidation:${asset}:${horizon}`,
      CACHE_TTL,
      () => fetchSynth('/insights/liquidation', { asset, horizon })
    );
  },

  /**
   * Get directional probabilities (probability above/below price targets)
   */
  async getDirectionalProbabilities(asset, horizon = '24h') {
    return cachedFetch(
      `synth:lp-probs:${asset}:${horizon}`,
      CACHE_TTL,
      () => fetchSynth('/insights/lp-probabilities', { asset, horizon })
    );
  },

  /**
   * Build a comprehensive forecast for a market by combining relevant SynthData endpoints.
   * Returns structured quantitative data for the agent loop to use.
   *
   * @param {string} asset - SynthData asset code
   * @param {Object} [options]
   * @param {string} [options.horizon] - '1h' or '24h'
   * @param {boolean} [options.includePolymarket] - Include Polymarket comparison
   * @returns {{ percentiles, volatility, polymarketEdge, confidence, source }}
   */
  async buildForecast(asset, options = {}) {
    const { horizon = '24h', includePolymarket = true } = options;

    // Fetch percentiles + volatility in parallel (always needed)
    const fetches = [
      this.getPredictionPercentiles(asset, horizon),
      this.getVolatility(asset, horizon),
    ];

    if (includePolymarket) {
      fetches.push(this.getPolymarketUpDown(asset, horizon));
    }

    const [percentiles, volatility, polymarketData] = await Promise.all(fetches);

    if (!percentiles) return null;

    // Extract key metrics from percentiles
    const pData = percentiles.data || percentiles;
    const pList = pData?.percentiles || [];

    const currentPrice = volatility?.current_price || pList[4]?.price;
    const p5 = pList.find(p => p.percentile === 5 || p.percentile === '5')?.price;
    const p50 = pList.find(p => p.percentile === 50 || p.percentile === '50')?.price;
    const p95 = pList.find(p => p.percentile === 95 || p.percentile === '95')?.price;

    // Derive directional probability from percentile distribution shape
    let upProbability = null;
    if (currentPrice && pList.length > 0) {
      const above = pList.filter(p => p.price > currentPrice).length;
      upProbability = above / pList.length;
    }

    // Extract Polymarket edge if available
    let polymarketEdge = null;
    if (polymarketData) {
      const pmData = polymarketData.data || polymarketData;
      if (pmData?.synth_probability != null && pmData?.polymarket_probability != null) {
        polymarketEdge = {
          synthFairProb: pmData.synth_probability,
          polymarketProb: pmData.polymarket_probability,
          edge: pmData.synth_probability - pmData.polymarket_probability,
          asset: pmData.asset,
          market: pmData.market_title || pmData.question,
        };
      }
      // Handle array response (multiple contracts)
      if (Array.isArray(pmData)) {
        polymarketEdge = pmData
          .filter(c => c.synth_probability != null && c.polymarket_probability != null)
          .map(c => ({
            synthFairProb: c.synth_probability,
            polymarketProb: c.polymarket_probability,
            edge: c.synth_probability - c.polymarket_probability,
            outcome: c.outcome || c.question,
            market: c.market_title || c.question,
          }));
      }
    }

    // Volatility-derived confidence
    const forecastVol = volatility?.forecast_future?.average_volatility;
    const realizedVol = volatility?.realized?.average_volatility;
    let confidence = 'MEDIUM';
    if (forecastVol && realizedVol) {
      const volRatio = forecastVol / realizedVol;
      if (volRatio < 0.8) confidence = 'HIGH';      // Decreasing vol = more predictable
      else if (volRatio > 1.5) confidence = 'LOW';   // Spiking vol = high uncertainty
    }

    return {
      asset,
      currentPrice,
      percentiles: { p5, p50, p95, raw: pList },
      upProbability,
      volatility: {
        forecast: forecastVol,
        realized: realizedVol,
      },
      polymarketEdge,
      confidence,
      horizon,
      source: 'synthdata',
      timestamp: Date.now(),
    };
  },
};
