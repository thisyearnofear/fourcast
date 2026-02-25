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
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {
    // Redis unavailable, proceed without cache
  }

  const data = await fetcher();
  if (!data) return null;

  // Cache result
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.setEx(cacheKey, ttl, JSON.stringify(data));
    }
  } catch (e) {
    // Cache write failed, non-critical
  }

  return data;
}

export const synthService = {
  SUPPORTED_ASSETS,
  detectAsset,

  /**
   * Check if SynthData is configured and available
   */
  isAvailable() {
    return !!process.env.SYNTH_API_KEY;
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
