// Resolution Service - Fetches market outcomes to resolve signals
import axios from 'axios';
import { db } from './db.js';

class ResolutionService {
  constructor() {
    this.polymarketBaseURL = 'https://gamma-api.polymarket.com';
    this.kalshiBaseURL = 'https://api.kalshi.com';
    this.cache = new Map();
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get market resolution from Polymarket
   */
  async getPolymarketResolution(marketID) {
    try {
      const cacheKey = `polymarket_${marketID}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const response = await axios.get(`${this.polymarketBaseURL}/markets/${marketID}`);
      const market = response.data;

      const resolution = {
        marketID,
        platform: 'polymarket',
        resolved: market.closedTime && market.resolutionSource,
        outcome: market.acceptingOrders ? null : this.parsePolymarketOutcome(market),
        resolvedAt: market.closedTime ? new Date(market.closedTime).getTime() / 1000 : null,
        rawData: market
      };

      this.cache.set(cacheKey, { data: resolution, timestamp: Date.now() });
      return resolution;
    } catch (err) {
      console.error(`[ResolutionService] Failed to fetch Polymarket resolution for ${marketID}:`, err.message);
      return null;
    }
  }

  /**
   * Get market resolution from Kalshi
   */
  async getKalshiResolution(marketID) {
    try {
      const cacheKey = `kalshi_${marketID}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      const response = await axios.get(`${this.kalshiBaseURL}/markets/${marketID}`);
      const market = response.data;

      const resolution = {
        marketID,
        platform: 'kalshi',
        resolved: market.result !== null,
        outcome: market.result, // 'YES', 'NO', or null
        resolvedAt: market.resolvedTime ? new Date(market.resolvedTime).getTime() / 1000 : null,
        rawData: market
      };

      this.cache.set(cacheKey, { data: resolution, timestamp: Date.now() });
      return resolution;
    } catch (err) {
      console.error(`[ResolutionService] Failed to fetch Kalshi resolution for ${marketID}:`, err.message);
      return null;
    }
  }

  /**
   * Resolve a signal by fetching market outcome
   */
  async resolveSignal(signal) {
    try {
      let resolution = null;

      // Determine platform and fetch resolution
      if (signal.market_title?.includes('Kalshi') || signal.event_id?.startsWith('kalshi')) {
        resolution = await this.getKalshiResolution(signal.event_id);
      } else {
        // Default to Polymarket
        resolution = await this.getPolymarketResolution(signal.event_id);
      }

      if (!resolution || !resolution.resolved) {
        return { status: 'PENDING', signal_id: signal.id };
      }

      // Determine if signal was correct
      const outcome = this.determineSignalOutcome(signal, resolution);

      // Update signal in database
      if (db) {
        const query = db.prepare(`
          UPDATE signals 
          SET outcome = ?, resolved_at = ?
          WHERE id = ?
        `);
        query.run(outcome, Math.floor(Date.now() / 1000), signal.id);
      }

      return {
        status: 'RESOLVED',
        signal_id: signal.id,
        outcome,
        resolved_at: resolution.resolvedAt
      };
    } catch (err) {
      console.error('[ResolutionService] Failed to resolve signal:', err);
      return { status: 'ERROR', signal_id: signal.id, error: err.message };
    }
  }

  /**
   * Resolve all pending signals for an event
   */
  async resolveEventSignals(eventID) {
    try {
      // Get all pending signals for this event
      const query = db.prepare(`
        SELECT * FROM signals 
        WHERE event_id = ? AND outcome = 'PENDING'
      `);
      const signals = query.all(eventID);

      const results = [];
      for (const signal of signals) {
        const result = await this.resolveSignal(signal);
        results.push(result);
      }

      return results;
    } catch (err) {
      console.error('[ResolutionService] Failed to resolve event signals:', err);
      return [];
    }
  }

  /**
   * Parse Polymarket outcome
   */
  parsePolymarketOutcome(market) {
    if (!market.resolutionSource) return null;

    // Polymarket outcomes are 1 for YES, 0 for NO
    if (market.resolutionSource === 1) return 'YES';
    if (market.resolutionSource === 0) return 'NO';
    return market.resolutionSource || null;
  }

  /**
   * Determine if a signal correctly predicted the outcome
   */
  determineSignalOutcome(signal, resolution) {
    // For now, simple comparison
    // In future, could parse the AI digest to extract the actual prediction
    
    if (!resolution.outcome) return 'PENDING';

    // This is a placeholder - would need to parse signal.ai_digest
    // to determine what the signal actually predicted
    // For now, marking all resolved signals as outcomes
    return resolution.outcome;
  }

  /**
   * Batch resolve multiple signals
   */
  async resolveBatch(signals) {
    const results = [];
    for (const signal of signals) {
      const result = await this.resolveSignal(signal);
      results.push(result);
    }
    return results;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const resolutionService = new ResolutionService();
