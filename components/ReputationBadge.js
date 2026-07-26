'use client';

/**
 * ReputationBadge
 *
 * Mini reputation display for signal cards, analyst profiles, and
 * any surface where an analyst's track record should be visible.
 *
 * Shows: tier emoji, win rate %, and total predictions.
 * Two variants: 'compact' (inline, fits in signal card header)
 * 'full' (standalone, more detail)
 *
 * Usage:
 * <ReputationBadge
 * stats={userStats}
 * isNight={true}
 * variant="compact"
 * />
 *
 * Where userStats comes from /api/stats?address=0x...
 */
export default function ReputationBadge({
 stats,
 isNight = true,
 variant = 'compact',
 className = '',
}) {
 if (!stats) return null;

 const tier = stats.tier || { name: 'Predictor', emoji: '📊', color: 'gray' };
 const winRate = stats.winRate ?? stats.accuracyPercent ?? 0;
 const totalPredictions = stats.totalPredictions ?? 0;
 const totalResolved = stats.totalResolved ?? 0;

 // Color the win rate text
 const winRateColor =
 winRate >= 75
 ? 'text-[var(--color-accent)]'
 : winRate >= 55
 ? 'text-[var(--color-evidence)]'
 : winRate >= 40
 ? 'text-[var(--color-sealed)]'
 : 'text-[var(--color-breach)]';

 if (variant === 'compact') {
 return (
 <div className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${className}`}>
 <span className="text-sm" title={tier.name}>{tier.emoji}</span>
 <span className={`font-medium ${winRateColor}`}>
 {typeof winRate === 'number' ? `${Math.round(winRate)}%` : 'N/A'}
 </span>
 {/* Calibration score */}
 {stats.calibrationScore != null && (
 <span className='text-[var(--color-ink-faint)]'>
 <span className={`font-medium ${
 stats.calibrationScore >= 70
 ? 'text-[var(--color-accent)]'
 : stats.calibrationScore >= 50
 ? 'text-[var(--color-sealed)]'
 : 'text-[var(--color-breach)]'
 }`}>{Math.round(stats.calibrationScore)}% cal</span>
 </span>
 )}
 {/* Brier score */}
 {stats.agentBrierScore != null && (
 <span className={`text-[10px] text-[var(--color-ink-faint)]`}>
 B={stats.agentBrierScore.toFixed(3)}
 </span>
 )}
 {totalPredictions > 0 && (
 <span className='text-[var(--color-ink-faint)]'>
 · {totalPredictions} pred
 </span>
 )}
 </div>
 );
 }

 // Full variant — used in profile sidebar or dedicated reputation card
 const border = 'border-[var(--color-rule)]';
 const bg = 'bg-white/[0.04]';
 const textColor = 'text-[var(--color-ink)]';
 const muted = 'text-[var(--color-ink-faint)]';

 return (
 <div className={` ${bg} border ${border} p-4 space-y-3 ${className}`}>
 {/* Header: Tier */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-2xl">{tier.emoji}</span>
 <div>
 <p className={`text-sm font-medium ${textColor}`}>{tier.name}</p>
 <p className={`text-[10px] ${muted} uppercase tracking-wider`}>Analyst Tier</p>
 </div>
 </div>
 {stats.rank && (
 <div className="text-right">
 <p className={`text-lg font-light ${textColor}`}>#{stats.rank}</p>
 <p className={`text-[10px] ${muted}`}>of {stats.totalRanked}</p>
 </div>
 )}
 </div>
 {/* Stats Grid */}
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center">
 <p className={`text-lg font-light ${winRateColor}`}>
 {typeof winRate === 'number' ? `${Math.round(winRate)}%` : 'N/A'}
 </p>
 <p className={`text-[10px] ${muted}`}>Win Rate</p>
 </div>
 <div className="text-center">
 <p className={`text-lg font-light ${textColor}`}>{totalResolved}</p>
 <p className={`text-[10px] ${muted}`}>Resolved</p>
 </div>
 <div className="text-center">
 <p className={`text-lg font-light ${textColor}`}>{totalPredictions}</p>
 <p className={`text-[10px] ${muted}`}>Total</p>
 </div>
 </div>
 {/* Win streak */}
 {stats.streak > 0 && (
 <div className={`text-center text-xs text-[var(--color-accent)]/80`}>
 🔥 {stats.streak}-prediction winning streak
 </div>
 )}
 {/* Calibration */}
 {stats.calibrationScore != null && (
 <div className="flex items-center justify-between text-xs">
 <span className={muted}>Calibration</span>
 <span className={
 stats.calibrationScore >= 70
 ? 'text-[var(--color-accent)]'
 : stats.calibrationScore >= 50
 ? 'text-[var(--color-sealed)]'
 : 'text-[var(--color-breach)]'
 }>
 {Math.round(stats.calibrationScore)}%
 </span>
 </div>
 )}
 </div>
 );
}
