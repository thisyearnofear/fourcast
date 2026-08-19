'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * ArenaStrip — the living proof line under the landing hero.
 *
 * Polls /api/arena/feed and renders: live heartbeat (last cycle), the latest
 * decision with its evidence source, and aggregate counters. Zero-stat rule:
 * omit any counter that is zero; empty feed renders a quiet syncing note,
 * never fake numbers.
 */

import { VERDICT_COLORS, timeAgo as ago } from '@/utils/arenaUi';

export default function ArenaStrip() {
  const [feed, setFeed] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/arena/feed?limit=40')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.success) setFeed(d); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const latest = feed?.latest;
  const runs = feed?.runs || [];

  const counters = [];
  if (runs.length > 0) {
    counters.push(`${runs.length} cycles`);
    const decisions = runs.reduce((n, r) => n + (r.decisions?.length || 0), 0);
    if (decisions > 0) counters.push(`${decisions} decisions`);
    const live = runs.reduce((n, r) => n + (r.summary?.tradesExecuted || 0), 0);
    const paper = runs.reduce((n, r) => n + (r.summary?.tradesPaper || 0), 0);
    if (live > 0) counters.push(`${live} live trade${live === 1 ? '' : 's'}`);
    if (paper > 0) counters.push(`${paper} paper`);
  }

  const headline = (latest?.decisions || [])[0];

  return (
    <div className="mt-8 border-y border-[var(--color-rule)]" aria-label="Live agent activity">
      {/* heartbeat row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 py-2.5 sm:px-3">
        {latest ? (
          <>
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: latest.summary?.dryRun ? 'var(--color-sealed)' : 'var(--color-accent)' }}>
              <span className="mc-lamp mc-lamp--live inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
              {latest.summary?.dryRun ? 'PAPER' : 'LIVE'}
            </span>
            <span className="font-mono text-[11px] text-[var(--color-ink-faint)]">cycle {ago(latest.timestamp)}</span>
            {latest.balances?.tokenBalance != null && (
              <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                {latest.balances.tokenBalance.toFixed(2)} {latest.balances.tokenSymbol} bankroll
              </span>
            )}
            <span className="ml-auto hidden font-mono text-[11px] text-[var(--color-ink-faint)] sm:inline">
              {counters.join(' · ')}
            </span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-[var(--color-ink-faint)]">
            agent worker syncing — first cycle lands within the hour
          </span>
        )}
      </div>

      {/* latest decision row */}
      {headline && (
        <Link
          href="/arena"
          className="group flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 no-underline sm:px-3"
          style={{ borderTop: '1px solid var(--color-rule)' }}
        >
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold tracking-widest"
            style={{ color: VERDICT_COLORS[headline.verdict] || 'var(--color-ink-faint)', border: `1px solid ${VERDICT_COLORS[headline.verdict] || 'var(--color-rule)'}` }}
          >
            {headline.verdict || 'LOGGED'}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">
            <span className="text-[var(--color-accent)]">{headline.outcome}</span>
            <span className="text-[var(--color-ink-faint)]"> · {headline.question}</span>
          </span>
          <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">
            est {Math.round((headline.yourProb ?? 0) * 100)}% vs mkt {Math.round((headline.marketProb ?? 0) * 100)}%
          </span>
          {headline.source && (
            <span
              className="hidden font-mono text-[10px] text-[var(--color-ink-faint)] sm:inline"
              title={headline.source}
            >
              {headline.source.startsWith('datafeed:')
                ? headline.source.replace('datafeed:', '')
                : headline.source.includes('[exa:')
                  ? 'evidence + web'
                  : 'model'}
            </span>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-[var(--color-accent)] transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
