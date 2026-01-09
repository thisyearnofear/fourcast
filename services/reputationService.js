/**
 * Reputation Service - Unified user stats, signal resolution, and reputation tracking
 * 
 * Consolidates userStatsService and resolutionService into single source of truth
 * for analyst reputation metrics and signal outcomes
 */

import axios from 'axios';
import { db } from './db.js';

class ReputationService {
  constructor() {
    this.polymarketBaseURL = 'https://gamma-api.polymarket.com';
    this.kalshiBaseURL = 'https://api.kalshi.com';
    this.cache = new Map();
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  }

  // ==================== REPUTATION & STATS ====================

  /**
   * Get comprehensive user stats from signal history
   * Returns: wins, losses, win rate, streaks, tiers, accuracy
   */
  async getUserStats(userAddress) {
    if (!userAddress) return null;

    try {
      // Get all signals by this user
      const signals = await db.query(
        `SELECT * FROM signals 
         WHERE author_address = ? AND outcome != 'PENDING'
         ORDER BY resolved_at DESC`,
        [userAddress.toLowerCase()]
      );

      if (!signals || signals.length === 0) {
        return {
          userAddress: userAddress.toLowerCase(),
          totalPredictions: 0,
          totalResolved: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          accuracyPercent: 0,
          bestMarket: null,
          worstMarket: null,
          recentPredictions: [],
          streak: 0,
          longestWinStreak: 0,
          calibrationScore: 0,
          tier: { name: 'Novice', emoji: '🌱', color: 'silver' },
          totalEarnings: 0,
          totalTipsReceived: 0,
        };
      }

      let wins = 0;
      let losses = 0;
      let currentStreak = 0;
      let longestWinStreak = 0;
      let streakType = null;
      let totalTipsReceived = 0;

      // Count wins/losses and calculate streaks
      for (const signal of signals) {
        const isCorrect = signal.outcome === 'WIN';
        if (isCorrect) {
          wins++;
        } else {
          losses++;
        }

        // Track tips
        const tips = parseFloat(signal.total_tips || 0);
        totalTipsReceived += tips;

        // Track current streak
        if (isCorrect) {
          if (streakType === 'WIN' || streakType === null) {
            currentStreak++;
            streakType = 'WIN';
            longestWinStreak = Math.max(longestWinStreak, currentStreak);
          } else {
            currentStreak = 1;
            streakType = 'WIN';
          }
        } else {
          if (streakType === 'LOSS' || streakType === null) {
            currentStreak++;
            streakType = 'LOSS';
          } else {
            currentStreak = 1;
            streakType = 'LOSS';
          }
        }
      }

      const totalResolved = wins + losses;
      const winRate = totalResolved > 0 ? (wins / totalResolved) * 100 : 0;

      // Get best and worst markets by confidence
      const confidenceMap = {};
      for (const signal of signals) {
        const confidence = signal.confidence || 'unknown';
        if (!confidenceMap[confidence]) {
          confidenceMap[confidence] = { wins: 0, losses: 0, market: signal.market_title };
        }
        if (signal.outcome === 'WIN') {
          confidenceMap[confidence].wins++;
        } else {
          confidenceMap[confidence].losses++;
        }
      }

      let bestMarket = null;
      let worstMarket = null;
      let bestWinRate = 0;
      let worstWinRate = 100;

      for (const [confidence, stats] of Object.entries(confidenceMap)) {
        const rate = stats.wins + stats.losses > 0 
          ? (stats.wins / (stats.wins + stats.losses)) * 100 
          : 0;

        if (rate > bestWinRate) {
          bestWinRate = rate;
          bestMarket = { confidence, winRate: rate, market: stats.market };
        }
        if (rate < worstWinRate) {
          worstWinRate = rate;
          worstMarket = { confidence, winRate: rate, market: stats.market };
        }
      }

      return {
        userAddress: userAddress.toLowerCase(),
        totalPredictions: signals.length,
        totalResolved,
        wins,
        losses,
        winRate: Math.round(winRate * 100) / 100,
        accuracyPercent: Math.round(winRate * 100) / 100,
        bestMarket,
        worstMarket,
        recentPredictions: (signals || []).slice(0, 5),
        streak: currentStreak && streakType === 'WIN' ? currentStreak : 0,
        longestWinStreak,
        calibrationScore: this.calculateCalibration(signals),
        tier: this.calculateTier(winRate),
        totalEarnings: (totalTipsReceived / 1000000).toFixed(2), // Convert octa to APT
        totalTipsReceived: Math.round(totalTipsReceived),
      };
    } catch (error) {
      console.error('Failed to calculate user stats:', error);
      return null;
    }
  }

  /**
   * Get user's recent wins for sharing
   */
  async getUserRecentWins(userAddress, days = 7) {
    if (!userAddress) return [];

    try {
      const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

      const wins = await db.query(
        `SELECT * FROM signals 
         WHERE author_address = ? 
         AND outcome = 'WIN'
         AND resolved_at > ?
         ORDER BY resolved_at DESC
         LIMIT 10`,
        [userAddress.toLowerCase(), since]
      );

      return wins || [];
    } catch (error) {
      console.error('Failed to fetch recent wins:', error);
      return [];
    }
  }

  /**
   * Get user's prediction history
   */
  async getUserPredictionHistory(userAddress, limit = 50) {
    if (!userAddress) return [];

    try {
      const predictions = await db.query(
        `SELECT * FROM signals 
         WHERE author_address = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [userAddress.toLowerCase(), limit]
      );

      return (predictions || []).map(p => ({
        id: p.id,
        marketTitle: p.market_title,
        venue: p.venue,
        confidence: p.confidence,
        reasoning: p.ai_digest,
        outcome: p.outcome,
        timestamp: p.timestamp,
        resolvedAt: p.resolved_at,
        eventTime: p.event_time,
        createdAt: p.created_at,
        totalTips: p.total_tips || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch prediction history:', error);
      return [];
    }
  }

  /**
   * Get user's ranking among all analysts
   */
  async getUserRanking(userAddress) {
    if (!userAddress) return null;

    try {
      const stats = await this.getUserStats(userAddress);
      if (!stats) return null;

      // Get all users' stats to calculate rank
      const allStats = await db.query(
        `SELECT DISTINCT author_address FROM signals WHERE author_address IS NOT NULL`
      );

      if (!allStats || allStats.length === 0) {
        return { ...stats, rank: 1, totalRanked: 1 };
      }

      // Simple ranking by win rate (then by total predictions)
      let rank = 1;
      const userAddr = userAddress.toLowerCase();

      for (const stat of allStats) {
        if (stat.author_address && stat.author_address !== userAddr) {
          const otherStats = await this.getUserStats(stat.author_address);
          if (otherStats && (otherStats.winRate > stats.winRate ||
            (otherStats.winRate === stats.winRate && otherStats.totalPredictions > stats.totalPredictions))) {
            rank++;
          }
        }
      }

      return { ...stats, rank, totalRanked: allStats.length };
    } catch (error) {
      console.error('Failed to get user ranking:', error);
      return null;
    }
  }

  // ==================== RESOLUTION ====================

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
      console.error(`[ReputationService] Failed to fetch Polymarket resolution for ${marketID}:`, err.message);
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
      console.error(`[ReputationService] Failed to fetch Kalshi resolution for ${marketID}:`, err.message);
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
      console.error('[ReputationService] Failed to resolve signal:', err);
      return { status: 'ERROR', signal_id: signal.id, error: err.message };
    }
  }

  /**
   * Resolve all pending signals for an event
   */
  async resolveEventSignals(eventID) {
    try {
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
      console.error('[ReputationService] Failed to resolve event signals:', err);
      return [];
    }
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

  // ==================== HELPERS ====================

  /**
   * Calculate calibration score (how well confidence levels match outcomes)
   */
  calculateCalibration(signals) {
    const confidenceLevels = {
      'very-high': { min: 80, max: 100 },
      'high': { min: 60, max: 80 },
      'medium': { min: 40, max: 60 },
      'low': { min: 20, max: 40 },
      'very-low': { min: 0, max: 20 },
    };

    const buckets = {};

    for (const signal of signals) {
      const confidence = signal.confidence || 'unknown';
      if (!buckets[confidence]) {
        buckets[confidence] = { total: 0, correct: 0 };
      }

      buckets[confidence].total++;
      if (signal.outcome === 'WIN') {
        buckets[confidence].correct++;
      }
    }

    let totalError = 0;
    let totalCount = 0;

    for (const [confidence, stats] of Object.entries(buckets)) {
      if (stats.total === 0) continue;

      const actualAccuracy = (stats.correct / stats.total) * 100;
      const expectedAccuracy = (confidenceLevels[confidence]?.min || 50 + 
                               (confidenceLevels[confidence]?.max || 50)) / 2;

      totalError += Math.abs(actualAccuracy - expectedAccuracy);
      totalCount++;
    }

    const avgError = totalCount > 0 ? totalError / totalCount : 0;
    return Math.max(0, 100 - avgError);
  }

  /**
   * Calculate reputation tier based on win rate
   */
  calculateTier(winRate) {
    if (winRate >= 85) return { name: 'Sage', emoji: '👑', color: 'gold' };
    if (winRate >= 75) return { name: 'Elite Analyst', emoji: '🌟', color: 'blue' };
    if (winRate >= 60) return { name: 'Forecaster', emoji: '🎯', color: 'green' };
    if (winRate >= 50) return { name: 'Predictor', emoji: '📊', color: 'gray' };
    return { name: 'Novice', emoji: '🌱', color: 'silver' };
  }

  /**
   * Parse Polymarket outcome
   */
  parsePolymarketOutcome(market) {
    if (!market.resolutionSource) return null;
    if (market.resolutionSource === 1) return 'YES';
    if (market.resolutionSource === 0) return 'NO';
    return market.resolutionSource || null;
  }

  /**
   * Determine if a signal correctly predicted the outcome
   */
  determineSignalOutcome(signal, resolution) {
    if (!resolution.outcome) return 'PENDING';
    return resolution.outcome;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const reputationService = new ReputationService();

// Export individual functions for backward compatibility
export async function getUserStats(userAddress) {
  return reputationService.getUserStats(userAddress);
}

export async function getUserRecentWins(userAddress, days) {
  return reputationService.getUserRecentWins(userAddress, days);
}

export async function getUserPredictionHistory(userAddress, limit) {
  return reputationService.getUserPredictionHistory(userAddress, limit);
}

export async function getUserRanking(userAddress) {
  return reputationService.getUserRanking(userAddress);
}

export default reputationService;
