'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VERDICT_COLORS, ago } from '@/utils/arenaUi';

/**
 * LiveTicker — Bloomberg-terminal-style tape of the agent's decisions.
 *
 * Distinct from EventTape (the wide marquee of theme + odds): this is a
 * compact, dense instrument framed like a trading tape — a LIVE lamp, a
 * monospace quote line, and a slow-scrolling decision/execution feed pulled
 * from /api/arena/feed. It is the first thing the eye lands on under the
 * hero so the product reads as *alive* before any prose does.
 *
 * Renders nothing while the feed is empty so an idle backend never fakes a
 * headline. Reduced-motion users get the static rail via .fc-marquee (pauses
 * are handled in the shared CSS), and the tape pauses on hover so it stays
 * inspectable.
 */

function buildItems(runs) {
  const items = [];
  for (const r of runs || []) {
    for (const d of r.decisions || []) {
      items.push({
        kind: d.verdict === 'ALLOCATE' ? 'ALLOCATE' : d.verdict === 'PAPER' ? 'PAPER' : 'PASS',
        head: d.outcome || (d.question || '').slice(0, 30),
        quote: `${Math.round((d.yourProb ?? 0) * 100)}% v mkt ${Math.round((d.marketProb ?? 0) * 100)}%`,
        ts: r.timestamp,
      });
    }
    for (const e of r.executions || []) {
      if (e.status !== 'executed' && e.status !== 'paper') continue;
      items.push({
        kind: e.status === 'executed' ? 'EXEC' : 'PAPER',
        head: `${e.shares} sh ${e.outcome || ''}`.trim(),
        quote: e.cost != null ? `$ ${e.cost.toFixed(2)}` : 'filled',
        ts: r.timestamp,
      });
    }
  }
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return items.slice(0, 14);
}

function TapeItems({ items, ariaHidden }) {
  return items.map((it, i) => (
    <span key={i} className="fc-marquee__item" aria-hidden={ariaHidden || undefined}>
      <span className="fc-marquee__dot" style={{ background: VERDICT_COLORS[it.kind] || 'var(--color-ink-faint)' }} />
      <span
        className="font-mono font-bold"
        style={{ color: VERDICT_COLORS[it.kind] || 'var(--color-ink-faint)' }}
      >
        {it.kind}
      </span>
      <span className="text-[var(--color-ink)]">{it.head}</span>
      <span className="font-mono text-[var(--color-ink-muted)]">{it.quote}</span>
      <span className="font-mono text-[var(--color-ink-faint)]">{ago(it.ts)}</span>
      <span className="fc-marquee__sep" aria-hidden="true" />
    </span>
  ));
}

export default function LiveTicker() {
  const [items, setItems] = useState(null);
  const [dry, setDry] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/arena/feed?limit=40')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d?.success) {
            setItems(buildItems(d.runs));
            setDry(Boolean(d.latest?.summary?.dryRun));
          }
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!items) return null;
  if (!items.length) return null;

  const tickClass = dry ? 'fc-tape--paper' : 'fc-tape--live';

  return (
    <div className={`fc-tape ${tickClass}`} aria-label="Live agent decision tape">
      <Link
        href="/arena"
        className="fc-tape__headgroup no-underline"
        aria-label="Open the arena ledger"
      >
        <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
        <span className="fc-kicker">{dry ? 'PAPER TAPE' : 'AGENT TAPE'}</span>
      </Link>
      <div className="fc-tape__scroller fc-marquee">
        <div className="fc-marquee__track">
          <TapeItems items={items} />
          <TapeItems items={items} ariaHidden />
        </div>
      </div>
    </div>
  );
}