/**
 * User Stats Service - Calculate prediction accuracy, win rate, and insights
 * 
 * Movement M1 Hackathon alignment:
 * - Single source of truth for user reputation metrics
 * - Foundation for on-chain reputation system
 * - Enables shareable content with verified stats
 */

import { db } from './db.js';

/**
 * Calculate comprehensive user stats from signal history
 * Used for Personal Stats Dashboard, sharing, and on-chain reputation
 */
export async function getUserStats(userAddress) {
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
        userAddress,
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
      };
    }

    let wins = 0;
    let losses = 0;
    let currentStreak = 0;
    let longestWinStreak = 0;
    let streakType = null;

    // Count wins/losses and calculate streaks
    for (const signal of signals) {
      const isCorrect = signal.outcome === 'WIN';
      if (isCorrect) {
        wins++;
      } else {
        losses++;
      }

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

    // Get best and worst markets
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
      recentPredictions: signals.slice(0, 5),
      streak: currentStreak && streakType === 'WIN' ? currentStreak : 0,
      longestWinStreak,
      calibrationScore: calculateCalibration(signals),
      tier: calculateTier(winRate),
    };
  } catch (error) {
    console.error('Failed to calculate user stats:', error);
    return null;
  }
}

/**
 * Get user's recent wins for celebration/sharing
 * Returns signals that resolved in user's favor within last N days
 */
export async function getUserRecentWins(userAddress, days = 7) {
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
 * Get user's prediction history with market resolutions
 * For Market Insights Timeline
 */
export async function getUserPredictionHistory(userAddress, limit = 50) {
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
    }));
  } catch (error) {
    console.error('Failed to fetch prediction history:', error);
    return [];
  }
}

/**
 * Calculate calibration score
 * How well confidence levels match outcomes
 */
function calculateCalibration(signals) {
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

  // Calculate expected vs actual
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

  // Score: 100 = perfect calibration, 0 = terrible
  const avgError = totalCount > 0 ? totalError / totalCount : 0;
  return Math.max(0, 100 - avgError);
}

/**
 * Calculate reputation tier based on win rate
 * Used for badges and on-chain reputation
 */
function calculateTier(winRate) {
  if (winRate >= 85) return { name: 'Sage', emoji: '👑', color: 'gold' };
  if (winRate >= 75) return { name: 'Elite Analyst', emoji: '🌟', color: 'blue' };
  if (winRate >= 60) return { name: 'Forecaster', emoji: '🎯', color: 'green' };
  if (winRate >= 50) return { name: 'Predictor', emoji: '📊', color: 'gray' };
  return { name: 'Novice', emoji: '🌱', color: 'silver' };
}

/**
 * Get leaderboard rankings
 * Integrates with existing leaderboard but adds stats
 */
export async function getUserRanking(userAddress) {
  if (!userAddress) return null;

  try {
    const stats = await getUserStats(userAddress);
    if (!stats) return null;

    // Get all users' stats to calculate rank
    const allStats = await db.query(
      `SELECT DISTINCT author_address FROM signals WHERE author_address IS NOT NULL`
    );

    if (!allStats || allStats.length === 0) {
      return { ...stats, rank: 1, totalRanked: 1 };
    }

    // Simple ranking by win rate
    let rank = 1;
    const userAddr = userAddress.toLowerCase();

    for (const stat of allStats) {
      if (stat.author_address && stat.author_address !== userAddr) {
        const otherStats = await getUserStats(stat.author_address);
        if (otherStats && otherStats.winRate > stats.winRate) {
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

export default {
  getUserStats,
  getUserRecentWins,
  getUserPredictionHistory,
  getUserRanking,
};
