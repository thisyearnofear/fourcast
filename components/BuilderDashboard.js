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

 const textColor = 'text-white';
 const subtleText = 'text-white/60';

 if (variant === 'compact') {
 if (!isConfigured) return null;
 return (
 <div className={` px-4 py-3 flex flex-wrap items-center justify-between gap-3 mc-panel`}>
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
 className={`text-xs no-underline text-indigo-300 hover:text-indigo-200`}
 >
 Details →
 </a>
 </div>
 );
 }

 if (!isConfigured) {
 return (
 <div className={` p-6 mc-panel`}>
 <h3 className={`font-medium mb-3 text-white`}>
 Builder Program
 </h3>
 <p className={`text-sm text-white/60`}>
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
 <div className={` p-6 mc-panel space-y-4`}>
 {/* Header */}
 <div className="flex items-start justify-between mb-6">
 <div>
 <h3 className={`font-medium text-lg ${textColor}`}>Builder Program</h3>
 <p className={`text-xs ${subtleText} mt-1`}>Track volume & compete on leaderboard</p>
 </div>
 <button
 onClick={handleRefresh}
 disabled={refreshing || loading}
 className={`p-2 transition-all ${
 refreshing
 ? 'opacity-50 cursor-not-allowed'
 : 'hover:bg-white/10'
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
 className={`p-2 transition-all hover:bg-white/10`}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>
 {error && (
 <div className={`text-xs p-3 bg-red-500/10 text-red-300`}>
 {error}
 </div>
 )}
 {loading ? (
 <div className="space-y-3 animate-pulse">
 <div className={`h-4 bg-white/10`} />
 <div className={`h-4 bg-white/10`} />
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
 <div className={`border p-4 border-green-400/30 bg-green-500/10`}>
 <div className="flex gap-2 mb-2">
 <svg className={`w-5 h-5 text-green-400`} fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 <h4 className={`font-medium text-sm text-green-200`}>
 Gasless Trading Active
 </h4>
 </div>
 <ul className={`text-xs space-y-1 text-green-300/70`}>
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
 className={`block w-full py-2 px-3 font-medium text-center text-sm transition-all bg-blue-500/20 hover:bg-blue-500/30 text-blue-200`}
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
 <div className={` p-3 text-center glass-input`}>
 <div className={`text-xs font-light text-white/60`}>
 {label}
 </div>
 <div className={`text-lg font-medium mt-1 text-white`}>
 {value}
 </div>
 </div>
 );
}
