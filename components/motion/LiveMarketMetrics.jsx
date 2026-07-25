'use client';

import TweenNumber from '@/components/motion/TweenNumber';

/**
 * LiveMarketMetrics — the three instrument cells (Market / AI fair / Edge)
 * rendered from a real market object returned by /api/markets.
 *
 * market.ask is the YES price (0..1), market.bid is the NO price.
 * When the API provides an edgeScore we use it; otherwise we derive a
 * simple edge from (0.5 - ask) so the panel still reads as a decision.
 *
 * Props:
 *   market — a market object from /api/markets
 *   armed  — whether the roll-up-from-zero entrance has been armed
 */
export default function LiveMarketMetrics({ market, armed }) {
  const askPct = (market.ask ?? market.currentOdds?.yes ?? 0.5) * 100;
  const bidPct = (market.bid ?? market.currentOdds?.no ?? 0.5) * 100;
  const edge = market.edgeScore ?? (0.5 - askPct / 100);
  const edgePct = edge * 100;
  const cells = [
    { label: 'Market', target: askPct, digits: 0, suffix: '%', duration: 700 },
    { label: 'AI fair', target: bidPct, digits: 0, suffix: '%', duration: 900 },
    { label: 'Edge', target: edgePct, digits: 1, suffix: '%', prefix: edge >= 0 ? '+' : '', accent: true, duration: 1100 },
  ];
  return (
    <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className="fc-metric edge-cell px-3 py-4"
          style={{ animationDelay: `${120 + i * 90}ms` }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
            {cell.label}
          </div>
          <TweenNumber
            className={`mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl ${
              cell.accent ? 'text-emerald-300' : 'text-white'
            }`}
            value={armed ? cell.target : 0}
            duration={cell.duration}
            format={(v) => `${cell.prefix ?? ''}${v.toFixed(cell.digits)}${cell.suffix}`}
          />
        </div>
      ))}
    </div>
  );
}
