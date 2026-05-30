'use client';

import React, { useState } from 'react';
import { useBuilder } from '@/hooks/useBuilder';

/**
 * BuilderDashboard Component - Comprehensive builder program UI
 * Integrates with existing design patterns
 * Shows all builder features and metrics
 */
function formatVolume(volume) {
  if (!volume) return '$0';
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

export function BuilderDashboard({ isNight = false, onClose = null, variant = 'full' }) {
  const { stats, loading, error, isConfigured, relayerConfig, refresh } = useBuilder();
  const [refreshing, setRefreshing] = useState(false);

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';

  if (variant === 'compact') {
    if (!isConfigured) return null;
    return (
      <div className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${isNight ? 'glass-subtle' : 'glass-subtle-light'}`}>
        <div className="flex items-center gap-4 text-xs">
          <span className={subtleText}>Builder</span>
          <span className={textColor}>
            24h <strong>{formatVolume(stats?.dailyVolume?.volume)}</strong>
          </span>
          <span className={textColor}>
            Orders <strong>{stats?.dailyVolume?.orderCount ?? 0}</strong>
          </span>
          <span className={textColor}>
            Rank <strong>{stats?.leaderboard?.rank ? `#${stats.leaderboard.rank}` : '—'}</strong>
          </span>
        </div>
        <a
          href="/labs/builder"
          className={`text-xs no-underline ${isNight ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-800'}`}
        >
          Details →
        </a>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className={`rounded-2xl p-6 ${isNight ? 'glass-subtle' : 'glass-subtle-light'}`}>
        <h3 className={`font-medium mb-3 ${isNight ? 'text-white' : 'text-slate-900'}`}>
          Builder Program
        </h3>
        <p className={`text-sm ${isNight ? 'text-white/60' : 'text-slate-600'}`}>
          Configure builder credentials in your environment to get started
        </p>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className={`rounded-2xl p-6 ${isNight ? 'glass-subtle' : 'glass-subtle-light'} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className={`font-medium text-lg ${textColor}`}>Builder Program</h3>
          <p className={`text-xs ${subtleText} mt-1`}>Track volume & compete on leaderboard</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className={`p-2 rounded-lg transition-all ${
            refreshing
              ? 'opacity-50 cursor-not-allowed'
              : isNight
                ? 'hover:bg-white/10'
                : 'hover:bg-white/50'
          }`}
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all ${
              isNight ? 'hover:bg-white/10' : 'hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className={`text-xs p-3 rounded-lg ${
          isNight ? 'bg-red-500/10 text-red-300' : 'bg-red-100 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className={`h-4 rounded ${isNight ? 'bg-white/10' : 'bg-white/50'}`} />
          <div className={`h-4 rounded ${isNight ? 'bg-white/10' : 'bg-white/50'}`} />
        </div>
      ) : stats && !stats.error ? (
        <>
          {/* Main Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="24h Volume"
              value={formatVolume(stats.dailyVolume?.volume || 0)}
              isNight={isNight}
            />
            <MetricCard
              label="Orders Today"
              value={stats.dailyVolume?.orderCount || 0}
              isNight={isNight}
            />
            <MetricCard
              label="Leaderboard Rank"
              value={stats.leaderboard?.rank ? `#${stats.leaderboard.rank}` : '-'}
              isNight={isNight}
            />
          </div>

          {/* Features */}
          {relayerConfig?.gasless && (
            <div className={`border rounded-xl p-4 ${
              isNight ? 'border-green-400/30 bg-green-500/10' : 'border-green-200 bg-green-50'
            }`}>
              <div className="flex gap-2 mb-2">
                <svg className={`w-5 h-5 ${isNight ? 'text-green-400' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <h4 className={`font-medium text-sm ${isNight ? 'text-green-200' : 'text-green-900'}`}>
                  Gasless Trading Active
                </h4>
              </div>
              <ul className={`text-xs space-y-1 ${isNight ? 'text-green-300/70' : 'text-green-700/70'}`}>
                <li>✓ Free wallet deployment</li>
                <li>✓ Free token approvals</li>
                <li>✓ Free order execution</li>
              </ul>
            </div>
          )}

          {/* CTA */}
          <a
            href="https://builders.polymarket.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full py-2 px-3 rounded-lg font-medium text-center text-sm transition-all ${
              isNight
                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
            }`}
          >
            View Full Leaderboard →
          </a>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, isNight }) {
  return (
    <div className={`rounded-lg p-3 text-center ${isNight ? 'glass-input' : 'glass-input-light'}`}>
      <div className={`text-xs font-light ${isNight ? 'text-white/60' : 'text-slate-600'}`}>
        {label}
      </div>
      <div className={`text-lg font-medium mt-1 ${isNight ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}
