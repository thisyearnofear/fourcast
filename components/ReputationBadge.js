'use client';

/**
 * ReputationBadge
 *
 * Mini reputation display for signal cards, analyst profiles, and
 * any surface where an analyst's track record should be visible.
 *
 * Shows: tier emoji, win rate %, and total predictions.
 * Two variants: 'compact' (inline, fits in signal card header)
 *               'full'    (standalone, more detail)
 *
 * Usage:
 * <ReputationBadge
 *   stats={userStats}
 *   isNight={true}
 *   variant="compact"
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
      ? 'text-green-400'
      : winRate >= 55
      ? 'text-blue-400'
      : winRate >= 40
      ? 'text-yellow-400'
      : 'text-red-400';

  if (variant === 'compact') {
    return (
      <div className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${className}`}>
        <span className="text-sm" title={tier.name}>{tier.emoji}</span>
        <span className={`font-medium ${winRateColor}`}>
          {typeof winRate === 'number' ? `${Math.round(winRate)}%` : 'N/A'}
        </span>
        {/* Calibration score */}
        {stats.calibrationScore != null && (
          <span className='text-white/50'>
            <span className={`font-medium ${
              stats.calibrationScore >= 70
                ? 'text-green-400'
                : stats.calibrationScore >= 50
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}>{Math.round(stats.calibrationScore)}% cal</span>
          </span>
        )}
        {/* Brier score */}
        {stats.agentBrierScore != null && (
          <span className={`text-[10px] text-white/40`}>
            B={stats.agentBrierScore.toFixed(3)}
          </span>
        )}
        {totalPredictions > 0 && (
          <span className='text-white/40'>
            · {totalPredictions} pred
          </span>
        )}
      </div>
    );
  }

  // Full variant — used in profile sidebar or dedicated reputation card
  const border = 'border-white/10';
  const bg = 'bg-white/[0.04]';
  const textColor = 'text-white';
  const muted = 'text-white/50';

  return (
    <div className={`rounded-xl ${bg} border ${border} p-4 space-y-3 ${className}`}>
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
        <div className={`text-center text-xs text-green-400/80`}>
          🔥 {stats.streak}-prediction winning streak
        </div>
      )}
      {/* Calibration */}
      {stats.calibrationScore != null && (
        <div className="flex items-center justify-between text-xs">
          <span className={muted}>Calibration</span>
          <span className={
            stats.calibrationScore >= 70
              ? 'text-green-400'
              : stats.calibrationScore >= 50
              ? 'text-yellow-400'
              : 'text-red-400'
          }>
            {Math.round(stats.calibrationScore)}%
          </span>
        </div>
      )}
    </div>
  );
}
