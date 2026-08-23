'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VERDICT_COLORS, ago } from '@/utils/arenaUi';
import { emitBackdropPulse, BACKDROP_STATES } from '@/components/BackdropProvider';

/**
 * AgentRail — the unified live agent feed (supersedes the old
 * LiveTicker / ArenaStrip / EventTape trio).
 *
 * Single fetch, three rows:
 *   Row 1 (compact header): LIVE/PAPER lamp · last cycle · bankroll · counters
 *   Row 2: latest decision, linked to the arena ledger
 *   Row 3 (marquee): decisions as dense, scrollable items
 *
 * Replaces three separate components that all polled the same endpoint.
 * When a *new* cycle lands it fires emitBackdropPulse() so the grid
 * visibly ripples — the whole page reacts to the agent's heartbeat.
 *
 * Truth-first liveness: the lamp only reads LIVE when a cycle landed within
 * STALE_AFTER_MS (the worker runs every 5 min, so 30 min of silence means
 * it stalled). A snapshot-served feed (`stale: true` from the API) or an
 * aged-out cycle renders an amber STALE/STALLED state with the last cycle
 * age — never a fake green lamp, never a blank fold.
 */

const STALE_AFTER_MS = 30 * 60 * 1000; // 6 missed 5-min cycles

function buildFeedItems(runs) {
  const items = [];
  for (const r of runs || []) {
    for (const d of r.decisions || []) {
      items.push({
        kind: d.verdict || 'LOGGED',
        outcome: d.outcome,
        question: d.question,
        yourProb: d.yourProb,
        marketProb: d.marketProb,
        source: d.source,
        ts: r.timestamp,
      });
    }
    for (const e of r.executions || []) {
      if (e.status !== 'executed' && e.status !== 'paper') continue;
      items.push({
        kind: e.status === 'executed' ? 'EXEC' : 'PAPER',
        outcome: e.outcome,
        question: e.question,
        shares: e.shares,
        cost: e.cost,
        ts: r.timestamp,
      });
    }
  }
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return items.slice(0, 20);
}

export default function AgentRail() {
  const [feed, setFeed] = useState(null);
  const [latest, setLatest] = useState(null);
  const lastCycleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/arena/feed?limit=40')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d?.success) return;
          setFeed(d);
          const latestRun = d.latest || null;
          setLatest(latestRun);
          // Fire a backdrop pulse only when a genuinely new cycle lands,
          // not on the initial load or every 60s re-poll of the same data.
          const ts = latestRun?.timestamp || null;
          if (ts && lastCycleRef.current && ts !== lastCycleRef.current) {
            // Use the latest decision's verdict to color the pulse.
            const latestDecision = latestRun?.decisions?.[latestRun.decisions.length - 1];
            const verdict = latestDecision?.verdict?.toLowerCase();
            const stateMap = {
              reconciled: BACKDROP_STATES.reconciled,
              breach: BACKDROP_STATES.breach,
              review: BACKDROP_STATES.review,
              pass: BACKDROP_STATES.sealed,
            };
            emitBackdropPulse({ state: stateMap[verdict] || BACKDROP_STATES.scanning });
          }
          lastCycleRef.current = ts;
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const runs = feed?.runs || [];
  const items = buildFeedItems(runs);
  const dry = latest?.summary?.dryRun;

  // Honest liveness: snapshot-served or aged-out cycles read amber, not green.
  const cycleAgeMs = latest?.timestamp ? Date.now() - new Date(latest.timestamp).getTime() : null;
  const stalled = cycleAgeMs != null && cycleAgeMs > STALE_AFTER_MS;
  const stale = Boolean(feed?.stale) || stalled;
  const lampLabel = stale ? (stalled ? 'STALLED' : 'STALE') : dry ? 'PAPER' : 'LIVE';
  const lampColor = stale ? 'var(--color-sealed)' : dry ? 'var(--color-sealed)' : 'var(--color-accent)';

  const counters = [];
  if (runs.length > 0) {
    counters.push(`${runs.length} cycles`);
    const decisions = runs.reduce((n, r) => n + (r.decisions?.length || 0), 0);
    if (decisions > 0) counters.push(`${decisions} decisions`);
    const live = runs.reduce((n, r) => n + (r.summary?.tradesExecuted || 0), 0);
    const paper = runs.reduce((n, r) => n + (r.summary?.tradesPaper || 0), 0);
    if (live > 0) counters.push(`${live} live${live === 1 ? '' : 's'}`);
    if (paper > 0) counters.push(`${paper} paper`);
  }

  // Latest decision for the header row
  const headlineDecisions = (latest?.decisions || []);
  const firstDecision = headlineDecisions[0];

  return (
    <div
      className="border-b border-[var(--color-rule)]"
      aria-label="Agent live feed"
    >
      {/* Row 1 — compact header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 sm:px-3">
        {latest ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: lampColor }}
              title={
                stale
                  ? 'No fresh cycle in the last 30 minutes — showing the last recorded state'
                  : undefined
              }
            >
              <span className="mc-lamp mc-lamp--live inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
              {lampLabel}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
              cycle · {ago(latest.timestamp)}
            </span>
            {latest.balances?.tokenBalance != null && (
              <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                {latest.balances.tokenBalance.toFixed(0)} {latest.balances.tokenSymbol}
              </span>
            )}
            <span className="ml-auto hidden font-mono text-[10px] text-[var(--color-ink-faint)] sm:inline">
              {counters.join(' · ')}
            </span>
          </>
        ) : (
          <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
            agent syncing — first cycle lands within the hour
          </span>
        )}
      </div>

      {/* Row 2 — latest decision (if available) */}
      {firstDecision && (
        <Link
          href="/arena"
          className="group flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-rule)] px-2 py-1 sm:px-3"
        >
          <span
            className="px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{
              color: VERDICT_COLORS[firstDecision.verdict] || 'var(--color-ink-faint)',
              border: `1px solid ${VERDICT_COLORS[firstDecision.verdict] || 'var(--color-rule)'}`,
            }}
          >
            {firstDecision.verdict}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-ink)]">
            <span className="text-[var(--color-accent)]">{firstDecision.outcome}</span>
            <span className="text-[var(--color-ink-faint)]"> · </span>
            <span className="truncate">{firstDecision.question?.slice(0, 50)}</span>
          </span>
          <span className="font-mono text-[10px] text-[var(--color-ink-muted)]">
            {Math.round((firstDecision.yourProb ?? 0) * 100)}% vs {Math.round((firstDecision.marketProb ?? 0) * 100)}%
          </span>
          <ArrowRight className="h-3 w-3 text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* Row 3 — marquee of decisions */}
      {items.length > 0 && (
        <div className="fc-marquee border-t border-[var(--color-rule)]">
          <div className="fc-marquee__track">
            {items.slice(0, 12).concat(items.slice(0, 12)).map((item, i) => (
              <span key={i} className="fc-marquee__item">
                <span className="fc-marquee__dot" style={{ background: VERDICT_COLORS[item.kind] || 'var(--color-ink-faint)' }} />
                <span style={{ color: VERDICT_COLORS[item.kind], fontWeight: 700 }}>
                  {item.kind}
                </span>
                <span>{item.outcome}</span>
                <span style={{ color: 'var(--color-ink-faint)' }}>{ago(item.ts)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
