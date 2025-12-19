'use client';

import React, { useMemo } from 'react';
import { useBuilder } from '@/hooks/useBuilder';

/**
 * BuilderStats Component - Beautiful builder program dashboard
 * Shows volume, leaderboard position, and gasless features
 * Aligned with Fourcast design language
 */
export function BuilderStats({ isNight = false }) {
  const { stats, loading, isConfigured, relayerConfig } = useBuilder();

  if (!isConfigured) {
    return null; // Don't render if builder not configured
  }

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';
  const badgeBg = isNight ? 'bg-blue-500/20' : 'bg-blue-100';
  const badgeText = isNight ? 'text-blue-200' : 'text-blue-700';

  // Format volume for display
  const formatVolume = (volume) => {
    if (!volume) return '$0';
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  // Memoize derived data
  const displayData = useMemo(() => {
    if (!stats?.configured) return null;

    const dailyVol = stats?.dailyVolume?.volume || 0;
    const rank = stats?.leaderboard?.rank || '-';
    const orderCount = stats?.dailyVolume?.orderCount || 0;

    return {
      volume: formatVolume(dailyVol),
      rank,
      orderCount,
      hasData: stats?.dailyVolume?.orders?.length > 0
    };
  }, [stats]);

  if (loading || !displayData) {
    return (
      <div className={`flex items-center gap-2 ${subtleText}`}>
        <div className="w-3 h-3 rounded-full bg-current opacity-50 animate-pulse" />
        <span className="text-xs">Loading builder stats...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-2">
        {/* Daily Volume */}
        <div className={`backdrop-blur-xl border rounded-xl p-3 ${
          isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30'
        }`}>
          <div className={`text-xs ${subtleText} font-light`}>24h Volume</div>
          <div className={`text-lg font-medium ${textColor} tracking-tight`}>
            {displayData.volume}
          </div>
        </div>

        {/* Order Count */}
        <div className={`backdrop-blur-xl border rounded-xl p-3 ${
          isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30'
        }`}>
          <div className={`text-xs ${subtleText} font-light`}>Orders</div>
          <div className={`text-lg font-medium ${textColor} tracking-tight`}>
            {displayData.orderCount}
          </div>
        </div>

        {/* Leaderboard Rank */}
        <div className={`backdrop-blur-xl border rounded-xl p-3 ${
          isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30'
        }`}>
          <div className={`text-xs ${subtleText} font-light`}>Rank</div>
          <div className={`text-lg font-medium ${textColor} tracking-tight`}>
            #{displayData.rank}
          </div>
        </div>
      </div>

      {/* Gasless Features Badge */}
      {relayerConfig?.gasless && (
        <div className={`${badgeBg} border ${
          isNight ? 'border-blue-400/30' : 'border-blue-200/50'
        } rounded-xl p-3`}>
          <div className={`flex items-center gap-2 ${badgeText}`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-medium">Gasless Trading Enabled</span>
          </div>
          <p className={`text-xs ${isNight ? 'text-blue-300/70' : 'text-blue-600/70'} mt-1`}>
            Deploy wallets & execute orders without gas fees
          </p>
        </div>
      )}

      {/* Leaderboard Link */}
      <a
        href="https://builders.polymarket.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs ${subtleText} hover:${textColor} transition-colors flex items-center gap-1 group`}
      >
        <span>View Full Leaderboard</span>
        <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}
