'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import useChangeFlash from '@/hooks/useChangeFlash';

/**
 * AgentTrackRecord — the allocator-diligence lane of /positions.
 *
 * Public, wallet-free: reads the arena worker feed and summarises the agent's
 * current book, verdict mix, executions, and settlements. Deep receipts live
 * on /arena; this is the track-record answer.
 */

const mono = { fontFamily: 'var(--font-mono, monospace)' };

function ago(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function until(ts) {
  const s = (new Date(ts).getTime() - Date.now()) / 1000;
  if (s <= 0) return 'settling';
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  return `in ${(s / 3600).toFixed(1)}h`;
}

function Row({ children, first }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 sm:px-3"
      style={{ borderTop: first ? 'none' : '1px solid var(--color-rule)' }}
    >
      {children}
    </div>
  );
}

function HeadStat({ label, value, accent }) {
  const flashing = useChangeFlash(value);
  return (
    <div className="min-w-[7rem] flex-1 px-1 py-3 sm:px-3">
      <div className={`font-mono text-lg ${flashing ? 'fc-tick' : ''}`} style={{ ...mono, color: accent ? 'var(--color-accent)' : 'var(--color-ink)' }}>{value}</div>
      <div className="text-[11px] text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}

export default function AgentTrackRecord() {
  const [feed, setFeed] = useState({ latest: null, runs: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/arena/feed?limit=100');
      const data = await res.json();
      if (data.success) setFeed(data);
    } catch { /* quiet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const { latest, runs } = feed;
  const s = latest?.summary || {};
  const balances = latest?.balances;

  // Aggregates across the retained window
  const totals = runs.reduce(
    (acc, r) => {
      acc.decisions += r.decisions?.length || 0;
      acc.live += r.summary?.tradesExecuted || 0;
      acc.paper += r.summary?.tradesPaper || 0;
      acc.swept += r.summary?.tokensSwept || 0;
      for (const d of r.decisions || []) acc.verdicts[d.verdict] = (acc.verdicts[d.verdict] || 0) + 1;
      return acc;
    },
    { decisions: 0, live: 0, paper: 0, swept: 0, verdicts: {} }
  );

  const executions = runs
    .flatMap((r) => (r.executions || []).map((e) => ({ ...e, runTs: r.timestamp, dryRun: r.summary?.dryRun })))
    .filter((e) => e.status === 'executed' || e.status === 'paper')
    .slice(0, 10);

  const positions = latest?.positions || [];

  if (loading && !latest) {
    return <div className="mt-4 text-[13px] text-[var(--color-ink-muted)]">Loading agent track record…</div>;
  }
  if (!latest) {
    return <div className="mt-4 text-[13px] text-[var(--color-ink-muted)]">Track record accrues as the arena worker publishes cycles.</div>;
  }

  return (
    <>
      {/* ── Head stats ──────────────────────────────────────────────── */}
      <section className="mt-2 flex flex-wrap divide-x divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
        <HeadStat label="bankroll" value={balances ? `${balances.tokenBalance?.toFixed(2)} ${balances.tokenSymbol}` : '—'} accent />
        <HeadStat label="live trades" value={totals.live || '0'} />
        <HeadStat label="paper trades" value={totals.paper || '0'} />
        <HeadStat label="decisions logged" value={totals.decisions || '0'} />
        <HeadStat label="verdict mix" value={`${totals.verdicts.ALLOCATE || 0}A ${totals.verdicts.PASS || 0}P ${totals.verdicts.PAPER || 0}P`} />
      </section>

      {/* ── Agent's open book ───────────────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between px-1 sm:px-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">Agent's open book</h2>
          <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>cycle {ago(latest.timestamp)} ago</span>
        </div>
        <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
          {positions.length === 0 ? (
            <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">Flat — capital parked, waiting for verified edge.</span></Row>
          ) : (
            positions.map((p, i) => (
              <Row key={p.market + p.outcomeIdx} first={i === 0}>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">{p.question || p.market.slice(0, 12) + '…'}</span>
                {p.resolvesAt && <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>{until(p.resolvesAt)}</span>}
                <span className="text-[12px] text-[var(--color-ink-muted)]">{p.outcome ?? `outcome ${p.outcomeIdx}`}</span>
                <span className="text-[13px]" style={mono}>{p.shares} sh</span>
              </Row>
            ))
          )}
        </div>
      </section>

      {/* ── Executions ──────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-2 px-1 sm:px-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">Executions</h2>
        </div>
        <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
          {executions.length === 0 ? (
            <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">No executions yet in this window.</span></Row>
          ) : (
            executions.map((e, i) => (
              <Row key={i} first={i === 0}>
                <span
                  className="px-1.5 py-0.5 text-[10px] font-semibold tracking-widest"
                  style={{
                    color: e.status === 'executed' ? 'var(--color-accent)' : 'var(--color-review)',
                    border: `1px solid ${e.status === 'executed' ? 'var(--color-accent)' : 'var(--color-review)'}`,
                  }}
                >
                  {e.status === 'executed' ? 'LIVE' : 'PAPER'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-[var(--color-ink)]">{e.shares} sh {e.outcome}</div>
                  <div className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                    {e.cost != null ? `${e.cost.toFixed(4)} TST · ` : ''}{e.txHash ? `tx ${e.txHash.slice(0, 12)}… · ` : ''}{ago(e.runTs)} ago
                  </div>
                </div>
              </Row>
            ))
          )}
        </div>
      </section>

      {/* ── Settlements ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="mb-2 px-1 sm:px-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">Settlements & reconciliation</h2>
        </div>
        <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
          <Row first>
            <span className="text-[13px] text-[var(--color-ink-muted)]">
              {totals.swept > 0
                ? `${totals.swept.toFixed(2)} TST reclaimed across settled positions this window.`
                : 'First settlements land Aug 13–16 — reclaimed capital and win-rate appear here automatically.'}
            </span>
          </Row>
        </div>
      </section>

      <p className="mt-6 px-1 text-[11px] text-[var(--color-ink-faint)] sm:px-3" style={mono}>
        Full reasoning for every decision →{' '}
        <Link href="/arena" className="text-[var(--color-accent)] no-underline">the arena ledger <ArrowRight className="inline h-3 w-3" /></Link>
      </p>
    </>
  );
}
