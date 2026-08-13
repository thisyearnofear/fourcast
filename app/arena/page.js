'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import Reveal from '@/components/motion/Reveal';
import MandateBuilder from '@/components/MandateBuilder';
import { MandateControl } from '@/components/MandateControl';
import { HistoricalLabPanel } from '@/components/HistoricalLabPanel';
import { AgentRunLedger } from '@/components/AgentRunLedger';
import { AgentDashboard } from '@/components/AgentDashboard';

const mono = { fontFamily: 'var(--font-mono, monospace)' };

const VERDICT_STYLE = {
  ALLOCATE: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'ALLOCATE' },
  PAPER: { color: 'var(--color-review)', border: 'var(--color-review)', label: 'PAPER' },
  PASS: { color: 'var(--color-ink-faint)', border: 'var(--color-rule-strong)', label: 'PASS' },
  executed: { color: 'var(--color-accent)', border: 'var(--color-accent)', label: 'EXECUTED' },
  dry_run: { color: 'var(--color-ink-faint)', border: 'var(--color-rule-strong)', label: 'SIMULATED' },
  paper: { color: 'var(--color-review)', border: 'var(--color-review)', label: 'PAPER' },
  skipped_slippage: { color: 'var(--color-sealed)', border: 'var(--color-sealed)', label: 'SLIPPAGE-SKIP' },
};

function Stamp({ kind, small }) {
  const s = VERDICT_STYLE[kind] || VERDICT_STYLE.PASS;
  return (
    <span
      className={`shrink-0 border ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'} font-semibold tracking-widest`}
      style={{ color: s.color, borderColor: s.border, borderRadius: 0 }}
    >
      {s.label}
    </span>
  );
}

function SourceChip({ source }) {
  if (!source) return null;
  const isFeed = source.startsWith('datafeed');
  return (
    <span
      className="shrink-0 px-1.5 py-0.5 text-[10px] tracking-wide"
      style={{
        color: isFeed ? 'var(--color-evidence)' : 'var(--color-ink-muted)',
        border: `1px solid ${isFeed ? 'var(--color-evidence)' : 'var(--color-rule)'}`,
        borderRadius: 0,
        ...mono,
      }}
      title={source}
    >
      {isFeed ? source.replace('datafeed:', '') : source.split(':')[1]?.split('/').pop()?.split('_')[0] || 'llm'}
      {source.includes('[exa:') && ' +web'}
    </span>
  );
}

function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${(s / 3600).toFixed(1)}h ago`;
}

const pct = (x, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);

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

function Section({ title, aside, children }) {
  return (
    <Reveal>
      <section className="mt-8 first:mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1 sm:px-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">{title}</h2>
          {aside && <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>{aside}</span>}
        </div>
        <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>{children}</div>
      </section>
    </Reveal>
  );
}

// ─── Ledger lane ────────────────────────────────────────────────────────────

function LedgerLane() {
  const [feed, setFeed] = useState({ latest: null, runs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/arena/feed');
      const data = await res.json();
      if (data.success) { setFeed(data); setError(null); }
      else setError(data.error || 'feed error');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchFeed(true);
    const id = setInterval(() => fetchFeed(), 60_000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const { latest, runs } = feed;
  const s = latest?.summary || {};
  const balances = latest?.balances || null;
  const positions = latest?.positions || [];

  const seen = new Set();
  const ledger = [];
  for (const r of runs) {
    for (const d of r.decisions || []) {
      const key = `${d.question}::${d.outcome}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ledger.push({ ...d, runTs: r.timestamp });
      if (ledger.length >= 14) break;
    }
    if (ledger.length >= 14) break;
  }

  const trades = runs
    .flatMap((r) => (r.executions || []).filter((e) => e.status !== 'dry_run' || !r.summary?.dryRun).map((e) => ({ ...e, runTs: r.timestamp })))
    .slice(0, 8);

  if (error && runs.length === 0) {
    return <div className="mt-6 text-[13px] text-[var(--color-ink-muted)]">Waiting for the first cycle from the arena worker… {error}</div>;
  }
  if (!latest && !error) {
    return <div className="mt-6 text-[13px] text-[var(--color-ink-muted)]">Waiting for the first cycle from the arena worker…</div>;
  }

  return (
    <>
      {/* ── Operating state ─────────────────────────────────────────── */}
      <Reveal>
        <section className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-1 sm:px-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.dryRun ? 'var(--color-sealed)' : 'var(--color-accent)' }}
            />
            <span className="text-[13px] font-semibold" style={{ color: s.dryRun ? 'var(--color-sealed)' : 'var(--color-accent)' }}>
              {s.dryRun ? 'PAPER-TRADING' : 'LIVE'}
            </span>
            <span className="text-[12px] text-[var(--color-ink-faint)]" style={mono}>cycle {timeAgo(latest.timestamp)}</span>
          </div>
          {balances && (
            <span className="text-[13px] text-[var(--color-ink)]" style={mono}>
              {balances.tokenBalance?.toFixed(2)} {balances.tokenSymbol}
              <span className="text-[11px] text-[var(--color-ink-faint)]"> bankroll</span>
            </span>
          )}
          <span className="text-[12px] text-[var(--color-ink-muted)]" style={mono}>
            {s.marketsScanned ?? '—'} markets · {s.tradesExecuted ?? 0} live · {s.tradesPaper ?? 0} paper
          </span>
          <button
            onClick={() => fetchFeed(true)}
            className="ml-auto flex items-center gap-1.5 border px-2 py-1 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            style={{ borderColor: 'var(--color-rule)', borderRadius: 0 }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </section>
      </Reveal>

      {/* ── Positions ───────────────────────────────────────────────── */}
      <Section title="Open positions" aside={positions.length ? `${positions.length} held` : 'flat'}>
        {positions.length === 0 ? (
          <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">No open positions — capital waiting for verified edge.</span></Row>
        ) : (
          positions.map((p, i) => (
            <Row key={p.market + p.outcomeIdx} first={i === 0}>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">{p.question || `${p.market.slice(0, 10)}…`}</span>
              <span className="text-[12px] text-[var(--color-ink-muted)]">{p.outcome ?? `outcome ${p.outcomeIdx}`}</span>
              <span className="text-[13px] text-[var(--color-ink)]" style={mono}>{p.shares} sh</span>
            </Row>
          ))
        )}
      </Section>

      {/* ── Decision ledger ─────────────────────────────────────────── */}
      <Section title="Decision ledger" aside={`latest ${ledger.length}`}>
        {ledger.length === 0 ? (
          <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">No decisions logged yet this window.</span></Row>
        ) : (
          ledger.map((d, i) => (
            <Row key={`${d.question}${d.outcome}${i}`} first={i === 0}>
              <Stamp kind={d.verdict} small />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-[var(--color-ink)]">{d.outcome} · {d.question}</div>
                <div className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                  est {pct(d.yourProb, 0)} vs mkt {pct(d.marketProb, 0)} · edge {pct(d.edge, 1)} · {timeAgo(d.runTs)}
                </div>
              </div>
              <SourceChip source={d.source} />
            </Row>
          ))
        )}
      </Section>

      {/* ── Executions ──────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <Section title="Executions" aside={`${trades.length} recent`}>
          {trades.map((t, i) => (
            <Row key={i} first={i === 0}>
              <Stamp kind={t.status} small />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-[var(--color-ink)]">{t.shares} sh {t.outcome}</div>
                <div className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
                  {t.cost != null ? `${t.cost.toFixed(4)} TST · ` : ''}{t.txHash ? `tx ${t.txHash.slice(0, 12)}… · ` : ''}{timeAgo(t.runTs)}
                </div>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {/* ── Calibration ─────────────────────────────────────────────── */}
      <Section title="Calibration" aside="accrues as markets settle">
        <Row first>
          <span className="text-[13px] text-[var(--color-ink-muted)]">
            Paper calls are being scored against settlements from Aug 13 onward. The curve appears here once the first receipts reconcile.
          </span>
        </Row>
      </Section>

      <p className="mt-8 px-1 text-[11px] leading-relaxed text-[var(--color-ink-faint)] sm:px-3" style={mono}>
        Same decision core across Polymarket, Kalshi and Delphi. Data-feed sources trade real; model sources paper-trade until calibration proves them.
      </p>
    </>
  );
}

// ─── Mandate lane (absorbed from /agent) ────────────────────────────────────

function MandateLane() {
  const [manualOpen, setManualOpen] = useState(false);
  return (
    <>
      <Reveal>
        <MandateBuilder />
      </Reveal>
      <Reveal>
        <MandateControl />
      </Reveal>
      <Reveal>
        <div className="platform-open-section mt-10">
          <HistoricalLabPanel />
        </div>
      </Reveal>
      <Reveal>
        <div className="platform-open-section mt-10">
          <AgentRunLedger />
        </div>
      </Reveal>
      <Reveal>
        <section className="platform-open-section mt-10" aria-label="Operator controls — manual investigation">
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" />
              <span className="mc-kicker">Operator controls · manual investigation</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-[var(--color-ink-faint)] transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
          </button>
          {manualOpen && (
            <div className="border-t border-[var(--mc-rule)] px-4 py-5 sm:px-5">
              <p className="mb-4 text-xs leading-5 text-[var(--color-ink-faint)]">
                Manual on-demand scans — every run still produces a hash-bound receipt.
              </p>
              <AgentDashboard />
            </div>
          )}
        </section>
      </Reveal>
    </>
  );
}

// ─── Page w/ lanes ──────────────────────────────────────────────────────────

const LANES = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'mandate', label: 'Mandate' },
];

function ArenaPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('lane') === 'mandate' ? 'mandate' : 'ledger';
  const [lane, setLane] = useState(initial);

  const switchLane = (id) => {
    setLane(id);
    router.replace(id === 'ledger' ? '/arena' : `/arena?lane=${id}`, { scroll: false });
  };

  return (
    <AppShell
      title="Arena"
      subtitle="One agent core. Multiple venues. Every decision provable."
      subheader={
        <nav className="flex items-center gap-1" aria-label="Arena lanes">
          {LANES.map((l) => (
            <button
              key={l.id}
              onClick={() => switchLane(l.id)}
              className="px-3 py-1.5 text-[13px] transition-colors"
              style={{
                color: lane === l.id ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                borderBottom: `2px solid ${lane === l.id ? 'var(--color-accent)' : 'transparent'}`,
                fontWeight: lane === l.id ? 600 : 400,
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>
      }
    >
      {lane === 'ledger' ? <LedgerLane /> : <MandateLane />}
    </AppShell>
  );
}

export default function ArenaPage() {
  return (
    <Suspense fallback={null}>
      <ArenaPageInner />
    </Suspense>
  );
}
