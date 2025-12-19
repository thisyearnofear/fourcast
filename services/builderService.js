/**
 * Builder Service - Consolidated Polymarket Builder Program integration
 * Handles order attribution, volume tracking, relayer operations
 * Single source of truth for all builder-related operations
 */

import axios from 'axios';
import { Builder, SigningMethod } from '@polymarket/builder-signing-sdk';

class BuilderService {
  constructor() {
    this.builderKey = process.env.POLY_BUILDER_API_KEY;
    this.builderSecret = process.env.POLY_BUILDER_SECRET;
    this.builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE;
    this.dataApiBaseURL = 'https://gamma-api.polymarket.com';
    this.cacheEnabled = true;
    this.volumeCache = new Map();
    this.VOLUME_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Check if builder credentials are configured
   */
  isConfigured() {
    return !!(this.builderKey && this.builderSecret && this.builderPassphrase);
  }

  /**
   * Get builder authentication headers for order attribution
   * These headers tell Polymarket which builder submitted the order
   */
  async getBuilderHeaders(orderID) {
    if (!this.isConfigured()) {
      console.warn('Builder credentials not configured. Orders will not be attributed.');
      return {};
    }

    try {
      // Initialize builder signing with credentials
      const builder = new Builder({
        apiKey: this.builderKey,
        secret: this.builderSecret,
        passphrase: this.builderPassphrase
      });

      // Sign the order for attribution
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await builder.signOrder(orderID, timestamp);

      return {
        'X-Builder-Key': this.builderKey,
        'X-Builder-Signature': signature,
        'X-Builder-Timestamp': timestamp.toString()
      };
    } catch (error) {
      console.error('Failed to generate builder headers:', error.message);
      return {};
    }
  }

  /**
   * Get daily volume for this builder
   * Used for leaderboard tracking and performance metrics
   */
  async getDailyVolume(date = new Date()) {
    const cacheKey = `volume_${date.toISOString().split('T')[0]}`;

    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.volumeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.VOLUME_CACHE_DURATION) {
        return cached.data;
      }
    }

    if (!this.isConfigured()) {
      return { volume: 0, orders: [], cached: false };
    }

    try {
      // Query builder volume via Data API
      const response = await axios.get(
        `${this.dataApiBaseURL}/builder-volume`,
        {
          params: {
            builder_key: this.builderKey,
            date: date.toISOString().split('T')[0]
          },
          timeout: 10000
        }
      );

      const result = {
        volume: response.data.totalVolume || 0,
        orders: response.data.orders || [],
        orderCount: response.data.orderCount || 0,
        cached: false
      };

      // Cache result
      if (this.cacheEnabled) {
        this.volumeCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to fetch builder volume:', error.message);
      return { volume: 0, orders: [], cached: false, error: error.message };
    }
  }

  /**
   * Get builder leaderboard position
   * Shows performance relative to other builders
   */
  async getLeaderboardPosition(timeframe = '7d') {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await axios.get(
        `${this.dataApiBaseURL}/builder-leaderboard`,
        {
          params: {
            builder_key: this.builderKey,
            timeframe // '24h', '7d', '30d', 'all'
          },
          timeout: 10000
        }
      );

      return {
        rank: response.data.rank,
        totalVolume: response.data.totalVolume,
        orderCount: response.data.orderCount,
        avgOrderSize: response.data.avgOrderSize,
        timeframe
      };
    } catch (error) {
      console.error('Failed to fetch leaderboard position:', error.message);
      return null;
    }
  }

  /**
   * Get builder stats for dashboard/UI
   */
  async getBuilderStats() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        message: 'Builder credentials not configured'
      };
    }

    try {
      const [daily, leaderboard] = await Promise.allSettled([
        this.getDailyVolume(),
        this.getLeaderboardPosition('7d')
      ]);

      return {
        configured: true,
        dailyVolume: daily.status === 'fulfilled' ? daily.value : null,
        leaderboard: leaderboard.status === 'fulfilled' ? leaderboard.value : null,
        builderKey: this.builderKey,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch builder stats:', error.message);
      return {
        configured: true,
        error: error.message
      };
    }
  }

  /**
   * Initialize relayer client for gasless operations
   * Returns configuration for frontend to use Relayer Client
   */
  getRelayerConfig() {
    if (!this.isConfigured()) {
      return null;
    }

    return {
      builderKey: this.builderKey,
      relayerApiUrl: 'https://clob.polymarket.com/relayer',
      gasless: true,
      features: [
        'Deploy Gnosis Safe (FREE)',
        'Deploy Magic Link Wallet (FREE)',
        'USDC Approvals (FREE)',
        'Order Execution (FREE)',
        'CTF Operations (FREE)'
      ]
    };
  }

  /**
   * Clear volume cache (for manual refresh)
   */
  clearVolumeCache() {
    this.volumeCache.clear();
  }

  /**
   * Get builder performance metrics for analytics
   */
  async getPerformanceMetrics() {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const [vol24h, vol7d, leaderboard] = await Promise.allSettled([
        this.getDailyVolume(new Date()),
        this.getDailyVolume(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        this.getLeaderboardPosition('7d')
      ]);

      return {
        volume24h: vol24h.status === 'fulfilled' ? vol24h.value.volume : 0,
        volume7d: vol7d.status === 'fulfilled' ? vol7d.value.volume : 0,
        leaderboardRank: leaderboard.status === 'fulfilled' ? leaderboard.value?.rank : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error.message);
      return null;
    }
  }
}

export const builderService = new BuilderService();
