'use client';

import { tierInfoFor, shortAddress } from '@/utils/signalTier';

/**
 * OperatorSpotlight — A 3-analyst proof-strip shown above the /signals feed.
 *
 * Pulled from the existing /api/leaderboard endpoint (win_rate + total_predictions
 * + high_confidence_signals), this surfaces the highest-tracked authors on
 * /signals so first-time visitors see "this is a feed of verified operators"
 * within 5 seconds of landing. Clicking a card opens the ProfileDrawer via
 * the page's existing onProfileClick handler (which lowercases addresses for
 * case-insensitive lookup).
 *
 * Tier thresholds + address formatting live in `utils/signalTier.js` so the
 * LeaderboardTab and OperatorSpotlight never disagree on classification.
 *
 * Data scope (v1): the audit's "30-day ROI · Brier · last-fill edge" fields are
 * not currently computed by any endpoint. A follow-up PR can extend
 * getLeaderboard() to surface Brier (from agent_forecasts) and recent edge
 * (from signals) for v2.
 */

export default function OperatorSpotlight({ operators = [], onProfileClick }) {
 if (!Array.isArray(operators) || operators.length === 0) return null;
 const top = operators.slice(0, 3);

 return (
 <div className="evidence-strip grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3" aria-label="Top analysts">
 {top.map((user, idx) => {
 const winRate = Math.round((user.win_rate || 0) * 100);
 const tier = tierInfoFor(user.win_rate || 0);
 const signals = user.total_predictions || 0;
 const highConf = user.high_confidence_signals || 0;
 const addr = shortAddress(user.user_address);

 return (
 <button
 key={user.user_address || idx}
 type="button"
 onClick={() => onProfileClick?.(user.user_address)}
 className="position-record bg-[var(--color-paper)] p-4 text-left transition-colors hover:bg-white/[0.03]"
 aria-label={`View profile for ${addr} — ranked #${idx + 1}, ${tier.name}`}
 >
 <div className="mb-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className={`h-1.5 w-1.5 ${tier.dot}`} aria-hidden />
 <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
 #{idx + 1} · {tier.name}
 </span>
 </div>
 <span className="text-[10px] font-mono text-white/30" aria-hidden>↗</span>
 </div>
 <div className="mb-3 truncate font-mono text-sm text-white/80">
 {addr}
 </div>
 <div className="grid grid-cols-3 gap-2">
 <div>
 <div className="text-xl font-light text-white">{winRate}%</div>
 <div className="text-[10px] uppercase tracking-wider text-white/40">Win</div>
 </div>
 <div>
 <div className="text-xl font-light text-white">{signals}</div>
 <div className="text-[10px] uppercase tracking-wider text-white/40">Signals</div>
 </div>
 <div>
 <div className="text-xl font-light text-emerald-300">{highConf}</div>
 <div className="text-[10px] uppercase tracking-wider text-white/40">High</div>
 </div>
 </div>
 </button>
 );
 })}
 </div>
 );
}
