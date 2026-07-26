'use client';

import { useContextualData } from '@/hooks/useContextualData';

/**
 * ContextualDataStrip — a thin strip of free macro/sentiment data points
 * that contextualise the currently-displayed prediction market.
 *
 * When the cycling market is "BTC $150k", this shows live BTC spot,
 * Fear & Greed, etc. When it's "Fed July cut", it shows the Fed funds
 * rate, CPI, and yield curve spread. When no data is available, the strip
 * collapses to nothing — it never shows placeholders or fake data.
 *
 * Each data point fades in via fc-roll when it arrives.
 *
 * Props:
 *   title — the market title to contextualise
 */
export default function ContextualDataStrip({ title }) {
  const { items, loading } = useContextualData(title);

  if (loading && items.length === 0) {
    return (
      <div className="fc-contextual-strip mt-3" aria-label="Market context loading">
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--color-ink-faint)]">
          Fetching market context…
        </span>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="fc-contextual-strip mt-3 flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Market context">
      {items.map((item, i) => (
        <span
          key={`${item.label}-${i}`}
          className="fc-market-slide inline-flex items-center gap-1.5"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">
            {item.label}
          </span>
          <span className="font-mono text-[11px] font-medium text-[var(--color-ink-muted)]">
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
