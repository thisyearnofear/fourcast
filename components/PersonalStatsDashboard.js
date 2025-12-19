'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

/**
 * Personal Stats Dashboard
 * 
 * Shows user's prediction stats:
 * - Win rate, accuracy %, total predictions
 * - Best/worst confidence levels
 * - Current streak
 * - Calibration score
 * - Reputation tier
 * 
 * Used in profile, signals page, and as shareable widget
 */
export function PersonalStatsDashboard({ userAddress, isNight = true, compact = false }) {
  const { address: connectedAddress } = useAccount();
  const displayAddress = userAddress || connectedAddress;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!displayAddress) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `/api/stats?address=${displayAddress}&includeRanking=true`
        );
        const result = await response.json();

        if (result.success) {
          setStats(result.stats);
          setError(null);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Unable to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [displayAddress]);

  if (loading) {
    return <StatsSkeleton isNight={isNight} compact={compact} />;
  }

  if (error || !stats) {
    return null;
  }

  const bgColor = isNight ? 'bg-white/5' : 'bg-black/5';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';
  const textColor = isNight ? 'text-white' : 'text-black';
  const tier = stats.tier || { name: 'Predictor', emoji: '📊', color: 'gray' };

  if (compact) {
    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-xs ${textColor} opacity-60`}>Accuracy</p>
            <p className={`text-2xl font-light ${textColor}`}>
              {stats.accuracyPercent}%
            </p>
          </div>
          <div className="text-center">
            <p className={`text-xs ${textColor} opacity-60`}>Predictions</p>
            <p className={`text-2xl font-light ${textColor}`}>
              {stats.totalPredictions}
            </p>
          </div>
          <div>
            <p className={`text-xs ${textColor} opacity-60`}>Tier</p>
            <p className={`text-lg ${textColor}`}>{tier.emoji}</p>
          </div>
        </div>
        
        {stats.streak > 0 && (
          <div className={`${isNight ? 'bg-green-500/20' : 'bg-green-400/20'} rounded px-2 py-1 text-center`}>
            <p className={`text-xs ${textColor} opacity-70`}>
              🔥 {stats.streak}-day winning streak
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full dashboard
  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-6 space-y-6`}>
      {/* Header with Tier */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs ${textColor} opacity-60 uppercase tracking-wider`}>
            Your Tier
          </p>
          <p className={`text-3xl font-light ${textColor} flex items-center gap-3 mt-1`}>
            {tier.emoji} {tier.name}
          </p>
        </div>
        {stats.rank && (
          <div className="text-right">
            <p className={`text-xs ${textColor} opacity-60 uppercase tracking-wider`}>
              Leaderboard Rank
            </p>
            <p className={`text-3xl font-light ${textColor} mt-1`}>
              #{stats.rank}
            </p>
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          subtext={`${stats.wins} wins, ${stats.losses} losses`}
          isNight={isNight}
        />
        <StatCard
          label="Total Predictions"
          value={stats.totalPredictions}
          subtext={`${stats.totalResolved} resolved`}
          isNight={isNight}
        />
        <StatCard
          label="Calibration"
          value={`${Math.round(stats.calibrationScore)}%`}
          subtext={stats.calibrationScore > 50 ? '✓ Well calibrated' : '⚠ Review confidence'}
          isNight={isNight}
        />
        <StatCard
          label="Best Streak"
          value={stats.longestWinStreak}
          subtext="consecutive wins"
          isNight={isNight}
        />
      </div>

      {/* Current Streak Badge */}
      {stats.streak > 0 && (
        <div className={`${isNight ? 'bg-green-500/20 border-green-400/30' : 'bg-green-400/20 border-green-500/30'} border rounded-lg p-4 flex items-center gap-3`}>
          <span className="text-2xl">🔥</span>
          <div>
            <p className={`text-sm font-light ${textColor}`}>
              {stats.streak}-Day Winning Streak
            </p>
            <p className={`text-xs ${textColor} opacity-60`}>
              Keep it going! Next win extends your streak.
            </p>
          </div>
        </div>
      )}

      {/* Best/Worst Markets */}
      <div className="grid grid-cols-2 gap-4">
        {stats.bestMarket && (
          <MarketCard
            title="Best at"
            market={stats.bestMarket}
            type="best"
            isNight={isNight}
          />
        )}
        {stats.worstMarket && (
          <MarketCard
            title="Needs Work"
            market={stats.worstMarket}
            type="worst"
            isNight={isNight}
          />
        )}
      </div>

      {/* Calibration Explanation */}
      <div className={`${isNight ? 'bg-blue-500/10 border-blue-400/20' : 'bg-blue-400/10 border-blue-500/20'} border rounded-lg p-4`}>
        <p className={`text-xs ${textColor} opacity-70 font-light leading-relaxed`}>
          <strong className="font-medium">Calibration Score:</strong> Measures how well your confidence levels match outcomes. A score of 70+ means you're accurately assessing your confidence. Under 50? You might be overconfident in certain conditions.
        </p>
      </div>

      {/* Improvement Tips */}
      <div className="space-y-2">
        <p className={`text-xs ${textColor} opacity-60 uppercase tracking-wider`}>
          🎯 Tips for Improvement
        </p>
        <ul className={`space-y-1 text-xs ${textColor} opacity-70 font-light`}>
          <li>• Keep your streak alive - daily predictions build momentum</li>
          <li>• Review your low-confidence predictions - are you calibrated?</li>
          <li>• Focus on markets where you consistently win</li>
          <li>• Share your analysis - great forecasters build reputation</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Individual stat card component
 */
function StatCard({ label, value, subtext, isNight }) {
  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-white/5' : 'bg-black/5';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3 text-center`}>
      <p className={`text-xs ${textColor} opacity-60 mb-1`}>{label}</p>
      <p className={`text-2xl font-light ${textColor} mb-1`}>{value}</p>
      <p className={`text-xs ${textColor} opacity-50`}>{subtext}</p>
    </div>
  );
}

/**
 * Market card showing best/worst performance
 */
function MarketCard({ title, market, type, isNight }) {
  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = type === 'best'
    ? isNight ? 'bg-green-500/10' : 'bg-green-400/10'
    : isNight ? 'bg-yellow-500/10' : 'bg-yellow-400/10';
  const borderColor = type === 'best'
    ? isNight ? 'border-green-400/30' : 'border-green-500/30'
    : isNight ? 'border-yellow-400/30' : 'border-yellow-500/30';
  const emoji = type === 'best' ? '✓' : '⚠';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3`}>
      <p className={`text-xs ${textColor} opacity-60 mb-2`}>{title}</p>
      <p className={`text-sm font-light ${textColor} mb-1`}>
        {emoji} {market.confidence || 'High confidence'}
      </p>
      <p className={`text-xs ${textColor} opacity-70`}>
        {Math.round(market.winRate)}% win rate
      </p>
    </div>
  );
}

/**
 * Loading skeleton
 */
function StatsSkeleton({ isNight, compact }) {
  const bgColor = isNight ? 'bg-white/5' : 'bg-black/5';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';

  if (compact) {
    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-4 animate-pulse`}>
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-3 w-12 rounded bg-white/10"></div>
            <div className="h-8 w-20 rounded bg-white/10"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-white/10"></div>
            <div className="h-8 w-12 rounded bg-white/10"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-12 rounded bg-white/10"></div>
            <div className="h-8 w-8 rounded bg-white/10"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-6 space-y-4 animate-pulse`}>
      <div className="h-12 w-40 rounded bg-white/10"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-white/10"></div>
            <div className="h-6 w-20 rounded bg-white/10"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
