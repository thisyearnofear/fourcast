'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * NearIntentsCard — the Intents leg inside the Arena Mandate lane.
 *
 * Shows a live DRY quote from the 1-Click API (never mints a deposit
 * address — GET /api/near/quote is quote-only by design) and, once a real
 * deposit address exists (NEAR_INTENTS_DEPOSIT_ADDRESS published via the
 * API response's depositAddress field), the deposit rail + status.
 *
 * Quiet by design like the rest of the rail: renders nothing when the
 * solver API is unreachable.
 */
export function NearIntentsCard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() =>
    fetch('/api/near/quote')
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        if (!d?.success) return;
        setData(d);
        const addr = d?.quote?.depositAddress;
        if (addr) {
          const s = await fetch(`/api/near/quote?status=${encodeURIComponent(addr)}`)
            .then((r) => r.json())
            .catch(() => null);
          if (s?.success) setStatus(s.status);
        }
      })
      .catch(() => {}), []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;

  const q = data.quote || {};
  const depositAddr = q.depositAddress || null;
  const statusLabel = status?.status || null;

  return (
    <section className="border-b border-[var(--color-rule)] px-2 py-3 sm:px-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="mc-kicker">Fund from any chain · NEAR Intents</p>
        <button
          type="button"
          onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }}
          className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> quote
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="text-[var(--color-ink-muted)]">
          {q.amountInFormatted || q.amountIn || '—'} → {q.amountOutFormatted || q.amountOut || '—'}
        </span>
        {q.timeEstimate != null && (
          <span className="text-[var(--color-ink-faint)]">~{q.timeEstimate}s settle</span>
        )}
        <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--color-ink-faint)] border border-[var(--color-rule)]">
          dry quote
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] text-[var(--color-ink-faint)]">
        settles to <span className="text-[var(--color-ink-muted)]">{data.recipient}</span>
        {depositAddr ? (
          <>
            {' '}· deposit <span className="text-[var(--color-ink-muted)]">{depositAddr}</span>
            {statusLabel && <> · <span className="text-[var(--color-accent)]">{statusLabel}</span></>}
          </>
        ) : (
          ' · deposit address mints on the first live quote'
        )}
      </p>
    </section>
  );
}

export default NearIntentsCard;
