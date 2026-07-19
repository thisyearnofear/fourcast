/**
 * Shared tier classification and address formatter for the signal marketplace.
 *
 * Single source of truth so the LeaderboardTab (full list) and the
 * OperatorSpotlight (3-card proof strip on /signals) never disagree on
 * which tier name an analyst lands in, or how an address is shortened.
 *
 * Earlier: each component had its own helper. Drift bug — a threshold
 * change in one left the other silently inconsistent.
 */

/**
 * Tier label for a given win-rate (0..1). Returns the same name across
 * every consumer; consumers pick which fields to render.
 *
 * @param {number} winRate - Win rate in [0, 1]. Nulls / NaN coerce to 0.
 * @returns {{ name: string, emoji: string, dot: string }}
 */
export function tierInfoFor(winRate) {
  const r = Number(winRate) || 0;
  if (r >= 0.85) return { name: 'Sage',          emoji: '👑', dot: 'bg-amber-400'   };
  if (r >= 0.75) return { name: 'Elite Analyst', emoji: '🌟', dot: 'bg-emerald-400' };
  if (r >= 0.60) return { name: 'Forecaster',    emoji: '🎯', dot: 'bg-emerald-300' };
  if (r >= 0.50) return { name: 'Predictor',     emoji: '📊', dot: 'bg-slate-300'   };
  return               { name: 'Novice',      emoji: '🌱', dot: 'bg-slate-500'   };
}

/**
 * Short-form address for compact cards. Uses an ellipsis so it renders
 * cleanly in 10–14px UI without overflow.
 *
 * @param {string|null|undefined} addr
 * @returns {string} e.g. `'0xabc1…23de'`, or `'Unknown'` for falsy / short inputs.
 */
export function shortAddress(addr) {
  if (typeof addr !== 'string' || addr.length < 10) return 'Unknown';
  return `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}`;
}
