'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { RefreshCw, ChevronDown, SlidersHorizontal } from 'lucide-react';
import useChangeFlash from '@/hooks/useChangeFlash';
import { VERDICT_STYLE } from '@/utils/arenaUi';
import { AppShell } from '@/app/components/PageNav';
import Reveal from '@/components/motion/Reveal';
import MandateBuilder from '@/components/MandateBuilder';
import { MandateControl } from '@/components/MandateControl';
import { HistoricalLabPanel } from '@/components/HistoricalLabPanel';
import { AgentRunLedger } from '@/components/AgentRunLedger';
import { AgentDashboard } from '@/components/AgentDashboard';
import { useBackdrop, BACKDROP_STATES } from '@/components/BackdropProvider';
import GlowList from '@/components/ui/GlowList';

const mono = { fontFamily: 'var(--font-mono, monospace)' };

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

function Chevron({ open }) {
  return <ChevronDown size={14} className={`text-[var(--color-ink-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />;
}

/** Flashing number — wash highlight whenever the value changes. */
function Flash({ value, className = '', style, children }) {
  const flashing = useChangeFlash(value);
  return <span className={`${className} ${flashing ? 'fc-tick' : ''}`} style={style}>{children}</span>;
}

/** Collapsed row by default; tap opens gates + reasoning (density per genre). */
function LedgerRow({ d, first }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--color-rule)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-left sm:px-3"
      >
        <Stamp kind={d.verdict} small />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-[var(--color-ink)]">{d.outcome} · {d.question}</div>
          <div className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
            est {pct(d.yourProb, 0)} vs mkt {pct(d.marketProb, 0)} · edge {pct(d.edge, 1)} · {timeAgo(d.runTs)}
          </div>
        </div>
        <SourceChip source={d.source} />
        <Chevron open={open} />
      </button>
      {open && (
        <div className="fc-unseal px-3 pb-3">
          {d.reasoning && (
            <p className="mb-2 border-l-2 pl-3 text-[12px] italic leading-5 text-[var(--color-ink-muted)]" style={{ borderColor: 'var(--color-evidence)' }}>
              {d.reasoning}
            </p>
          )}
          {d.gates?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {d.gates.map((g, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 text-[10px]"
                  style={{
                    border: `1px solid ${g.passed ? 'var(--color-accent)' : 'var(--color-breach)'}`,
                    color: g.passed ? 'var(--color-accent)' : 'var(--color-breach)',
                  }}
                >
                  {g.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 text-[10px] text-[var(--color-ink-faint)]" style={mono}>
            {d.category}{d.shares ? ` · ${d.shares} sh` : ''}
          </div>
        </div>
      )}
    </div>
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

  const { setState: setBackdrop } = useBackdrop();

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

  // Backdrop state — driven by latest ledger decision verdict
  const latestVerdict = useMemo(() => {
    const d = ledger[ledger.length - 1];
    return d?.verdict?.toLowerCase() || null;
  }, [ledger]);

  useEffect(() => {
    if (!latestVerdict) return;
    if (latestVerdict === 'reconciled') setBackdrop(BACKDROP_STATES.reconciled);
    else if (latestVerdict === 'breach') setBackdrop(BACKDROP_STATES.breach);
    else if (latestVerdict === 'review') setBackdrop(BACKDROP_STATES.review);
    else if (latestVerdict === 'pass') setBackdrop(BACKDROP_STATES.sealed);
    else setBackdrop(BACKDROP_STATES.scanning);
  }, [latestVerdict, setBackdrop]);

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
            <Flash value={balances.tokenBalance} className="text-[13px] text-[var(--color-ink)]" style={mono}>
              {balances.tokenBalance?.toFixed(2)} {balances.tokenSymbol}
              <span className="text-[11px] text-[var(--color-ink-faint)]"> bankroll</span>
            </Flash>
          )}
          <Flash value={`${s.marketsScanned}|${s.tradesExecuted}|${s.tradesPaper}`} className="text-[12px] text-[var(--color-ink-muted)]" style={mono}>
            {s.marketsScanned ?? '—'} markets · {s.tradesExecuted ?? 0} live · {s.tradesPaper ?? 0} paper
          </Flash>
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
      {positions.length === 0 ? (
        <Section title="Open positions" aside="flat">
          <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">No open positions — capital waiting for verified edge.</span></Row>
        </Section>
      ) : (
        <Reveal>
          <section className="mt-8 first:mt-6">
            <GlowList
              count={positions.length}
              label="position"
              defaultOpen={true}
              renderSummary={() => (
                <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/30">
                  {positions.length} held
                </span>
              )}
            >
              <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
                {positions.map((p, i) => (
                  <Row key={p.market + p.outcomeIdx} first={i === 0}>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-ink)]">{p.question || `${p.market.slice(0, 10)}…`}</span>
                    <span className="text-[12px] text-[var(--color-ink-muted)]">{p.outcome ?? `outcome ${p.outcomeIdx}`}</span>
                    <span className="text-[13px] text-[var(--color-ink)]" style={mono}>{p.shares} sh</span>
                  </Row>
                ))}
              </div>
            </GlowList>
          </section>
        </Reveal>
      )}

      {/* ── Decision ledger ─────────────────────────────────────────── */}
      <Section title="Decision ledger" aside={`latest ${ledger.length}`}>
        {ledger.length === 0 ? (
          <Row first><span className="text-[13px] text-[var(--color-ink-faint)]">No decisions logged yet this window.</span></Row>
        ) : (
          ledger.map((d, i) => (
            <LedgerRow key={`${d.question}${d.outcome}${i}`} d={d} first={i === 0} />
          ))
        )}
      </Section>

      {/* ── Executions ──────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <Reveal>
          <section className="mt-8">
            <GlowList
              count={trades.length}
              label="execution"
              defaultOpen={false}
              renderSummary={() => (
                <span className="inline-flex items-center rounded-full bg-field px-2 py-0.5 text-[10px] font-medium text-ink-faint shadow-hairline">
                  {trades.length} recent
                </span>
              )}
              emptyLabel="No executions yet"
            >
              <div style={{ borderTop: '1px solid var(--color-rule-strong)', borderBottom: '1px solid var(--color-rule)' }}>
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
              </div>
            </GlowList>
          </section>
        </Reveal>
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
        Same decision core across every venue. Data-feed sources trade live; model sources paper-trade until calibration proves them.
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
    // View Transitions morph (reduced-motion users get instant swap)
    const canMorph = typeof document !== 'undefined'
      && 'startViewTransition' in document
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canMorph) {
      document.startViewTransition(() => flushSync(() => setLane(id)));
    } else {
      setLane(id);
    }
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
      <div className="arena-lane-host">
        {lane === 'ledger' ? <LedgerLane /> : <MandateLane />}
      </div>
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
