'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Check, CircleAlert, Database, Fingerprint, RefreshCw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { canonicalize } from '@/services/domain/decision/receiptCanonical';

const VERDICT = {
  allocate: { label: 'ALLOCATE', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', icon: Check },
  act: { label: 'ALLOCATE', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', icon: Check },
  ready: { label: 'READY', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', icon: Check },
  pass: { label: 'PASS', className: 'border-amber-300/25 bg-amber-300/10 text-amber-100', icon: ShieldCheck },
  review: { label: 'REVIEW', className: 'border-sky-300/25 bg-sky-300/10 text-sky-100', icon: CircleAlert },
};

function relativeTime(timestamp) {
  if (!timestamp) return 'just now';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* ---------- client-side receipt verification (uses the domain contract) ---------- */

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function useReceiptVerification(proof) {
  const [state, setState] = useState({ status: 'idle' });
  useEffect(() => {
    let cancelled = false;
    if (!proof?.integrity?.contentHash) {
      setState({ status: 'unavailable' });
      return undefined;
    }
    setState({ status: 'checking' });
    const { integrity, ...payload } = proof;
    sha256Hex(canonicalize(payload))
      .then((actual) => {
        if (cancelled) return;
        setState({
          status: actual === integrity.contentHash ? 'verified' : 'mismatch',
          expected: integrity.contentHash,
          actual,
        });
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => { cancelled = true; };
  }, [proof]);
  return state;
}

/* --------------------------------- atoms --------------------------------- */

function Metric({ value, label, accent = false }) {
  return (
    <div>
      <div className={`font-mono text-lg ${accent ? 'text-emerald-200' : 'text-white/75'}`}>{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</div>
    </div>
  );
}

function IntegrityBadge({ verification, hash }) {
  if (!hash) return null;
  const styles = {
    checking: 'border-white/15 bg-white/5 text-white/45',
    verified: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    mismatch: 'border-red-400/30 bg-red-400/10 text-red-200',
    error: 'border-white/15 bg-white/5 text-white/45',
    unavailable: 'border-white/15 bg-white/5 text-white/45',
    idle: 'border-white/15 bg-white/5 text-white/45',
  };
  const labels = {
    checking: 'VERIFYING…',
    verified: 'RECEIPT VERIFIED',
    mismatch: 'HASH MISMATCH',
    error: 'VERIFY FAILED',
    unavailable: 'NO PROOF',
    idle: 'RECEIPT',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${styles[verification.status]}`}
      title={hash ? `sha256 ${hash}` : undefined}
    >
      <Fingerprint className="h-2.5 w-2.5" />
      {labels[verification.status]}
      {hash && <span className="text-white/40">{hash.slice(0, 8)}…</span>}
    </span>
  );
}

function PolicyStrip({ policy }) {
  if (!policy) return null;
  const items = [
    ['edge', `≥ ${((policy.minAbsoluteEdge ?? 0) * 100).toFixed(0)}%`],
    ['alloc cap', `≤ ${((policy.maxAllocationPct ?? 0) * 100).toFixed(0)}%`],
    ['tail loss', `≤ ${((policy.maxLossProbability ?? 0) * 100).toFixed(0)}%`],
    ['sim runs', (policy.simulationRuns ?? 0).toLocaleString()],
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border border-white/[0.07] bg-black/30 px-3 py-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">policy {policy.version?.replace('decision-policy/', '') || 'v1'}</span>
      {items.map(([label, value]) => (
        <span key={label} className="font-mono text-[10px] text-white/55">
          <span className="text-white/30">{label}</span> {value}
        </span>
      ))}
    </div>
  );
}

function RiskGate({ check }) {
  const Icon = check.passed ? Check : X;
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${check.passed ? 'text-emerald-300' : 'text-red-300'}`} />
      <div className="min-w-0">
        <p className={`font-mono text-[10px] uppercase tracking-wider ${check.passed ? 'text-white/60' : 'text-red-200'}`}>{check.label}</p>
        <p className="text-[10px] leading-4 text-white/40">{check.description}</p>
      </div>
    </div>
  );
}

function SimulationRange({ simulation }) {
  if (!simulation || simulation.valid === false || !simulation.interval) return null;
  const { p05, p50, p95 } = simulation.interval;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-white/35">
        <span>simulated return · {simulation.runs?.toLocaleString()} runs · seed {simulation.seed}</span>
        <span>loss {(simulation.lossProbability * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
        <span className="text-red-300/80">{p05 > 0 ? '+' : ''}{p05?.toFixed(2)}</span>
        <div className="relative h-1 flex-1 rounded-full bg-white/10">
          <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-red-400/60 via-white/40 to-emerald-400/70" style={{ left: '15%', right: '10%' }} />
          <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/80" style={{ left: '50%' }} />
        </div>
        <span className="text-emerald-300/90">+{p95?.toFixed(2)}</span>
      </div>
      <p className="mt-0.5 font-mono text-[9px] text-white/30">p05 / median {p50 > 0 ? '+' : ''}{p50?.toFixed(2)} / p95 · per unit staked</p>
    </div>
  );
}

function DecisionCard({ decision, index }) {
  const verdictKey = (decision?.decision?.verdict || 'review').toLowerCase();
  const style = VERDICT[verdictKey] || VERDICT.review;
  const Icon = style.icon;
  const market = decision?.market || {};
  const forecast = decision?.forecast || {};
  const gates = decision?.decision?.riskChecks || [];
  return (
    <div className="border border-white/[0.08] bg-black/25 p-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${style.className}`}>
          <Icon className="h-2.5 w-2.5" />{style.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/85">{market.title || `Decision ${index + 1}`}</p>
          <p className="mt-0.5 font-mono text-[10px] text-white/40">
            fair {forecast.probability != null ? `${(forecast.probability * 100).toFixed(1)}%` : '—'}
            {' vs mkt '}{market.marketOdds != null ? `${(market.marketOdds * 100).toFixed(1)}%` : '—'}
            {forecast.edge != null && <> · edge {(forecast.edge * 100).toFixed(1)}%</>}
            {decision?.decision?.allocationPct > 0 && <> · alloc {(decision.decision.allocationPct * 100).toFixed(1)}%</>}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-white/50">{decision?.decision?.rationale}</p>
        </div>
      </div>
      <SimulationRange simulation={decision?.simulation} />
      {gates.length > 0 && (
        <div className="mt-2 grid gap-1.5 border-t border-white/[0.06] pt-2 sm:grid-cols-2">
          {gates.map((gate) => <RiskGate key={gate.id} check={gate} />)}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- run card -------------------------------- */

function RunCard({ run, expanded, onToggle }) {
  const summary = run.summary || {};
  const config = run.config || {};
  const proof = summary.proof || null;
  const execution = summary.execution || proof?.execution || {};
  const highlights = summary.highlights || [];
  const decisions = proof?.decisions || [];
  const verification = useReceiptVerification(proof);
  const mode = run.run_mode === 'autopilot' ? 'AUTOPILOT' : 'ADVISORY';
  const actions = summary.recommendations?.actionable || 0;

  return (
    <article className="relative overflow-hidden border border-white/10 bg-black/25 px-4 py-4 transition hover:border-white/20 sm:px-5">
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-emerald-300/0 via-emerald-300/70 to-emerald-300/0" />
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
        aria-label={`Toggle details for ${mode} run ${run.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-mono text-[10px] font-bold tracking-[0.18em] ${mode === 'AUTOPILOT' ? 'text-emerald-200' : 'text-sky-200'}`}>{mode}</span>
              <span className="font-mono text-[10px] text-white/35">{run.id.replace('run-', '#')}</span>
              <span className="text-[10px] text-white/35">{relativeTime(run.timestamp)}</span>
              <IntegrityBadge verification={verification} hash={proof?.integrity?.contentHash} />
            </div>
            <p className="mt-2 text-sm leading-5 text-white/80">
              {run.markets_scanned || 0} observed → {run.candidates_filtered || 0} qualified → {run.forecasts_made || 0} scored → <span className={actions ? 'text-emerald-200' : 'text-amber-100'}>{actions} allocation{actions === 1 ? '' : 's'}</span>
            </p>
          </div>
          <ArrowUpRight className={`mt-1 h-4 w-4 shrink-0 text-white/35 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      <div className="mt-3 grid grid-cols-3 border-y border-white/[0.07] py-3 text-center">
        <Metric value={summary.arbitrage?.candidates || 0} label="venue pairs" />
        <Metric value={actions} label="risk-cleared" accent={actions > 0} />
        <Metric value={execution.attempted || 0} label={execution.dryRun ? 'rehearsed' : 'executed'} accent={execution.completed > 0} />
      </div>

      {expanded && (
        <div className="pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-white/40">
            <span>Sources: {summary.sources?.join(' + ') || proof?.evidence?.sources?.join(' + ') || 'market feeds'}</span>
            <span>Risk: {Math.round((config.riskTolerance || 0) * 100)}%</span>
            <span>Min volume: ${(config.minVolume || 0).toLocaleString()}</span>
          </div>

          <PolicyStrip policy={proof?.policy} />

          {decisions.length > 0 ? (
            <div className="mt-3 space-y-2">
              {decisions.map((decision, index) => (
                <DecisionCard key={`${run.id}-decision-${index}`} decision={decision} index={index} />
              ))}
            </div>
          ) : highlights.length > 0 ? (
            <div className="mt-4 space-y-2">
              {highlights.map((item, index) => {
                const style = VERDICT[item.verdict] || VERDICT.review;
                const Icon = style.icon;
                return (
                  <div key={`${item.title}-${index}`} className="flex items-start gap-3 border-l border-white/10 pl-3">
                    <span className={`mt-0.5 inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${style.className}`}><Icon className="h-2.5 w-2.5" />{style.label}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-white/80">{item.title}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-white/45">{item.rationale}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-xs text-white/40">This run predates detailed decision receipts. Run the agent again to record evidence and verdicts.</p>
          )}

          {verification.status === 'verified' && (
            <p className="mt-3 border-t border-white/[0.06] pt-2 font-mono text-[9px] leading-4 text-white/35">
              Recomputed sha256 over the canonical receipt in your browser matches the recorded hash. Same evidence, policy, and seed replay to this receipt.
            </p>
          )}
          {verification.status === 'mismatch' && (
            <p className="mt-3 border-t border-red-400/20 pt-2 font-mono text-[9px] leading-4 text-red-200/80">
              Recorded hash {verification.expected?.slice(0, 16)}… does not match recomputed {verification.actual?.slice(0, 16)}… — receipt contents were altered after the fact.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/* --------------------------------- section -------------------------------- */

export function AgentRunLedger() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const loadRuns = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/agent/runs?limit=8', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load run ledger');
      setRuns(data.runs || []);
      setExpanded((current) => current || data.runs?.[0]?.id || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
    const interval = window.setInterval(loadRuns, 15000);
    return () => window.clearInterval(interval);
  }, [loadRuns]);

  return (
    <section className="mt-8 border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(0,0,0,0.22))] p-1" aria-labelledby="run-ledger-heading">
      <div className="border border-white/[0.07] bg-black/30 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/80"><Activity className="h-3.5 w-3.5" /> Autonomous decision ledger</div>
            <h2 id="run-ledger-heading" className="mt-2 font-display text-lg font-semibold tracking-tight text-white">Every recommendation has a receipt.</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">Observe market venues, test contract equivalence, price risk, then allocate or decline. Each receipt binds the evidence, the risk policy, the simulation, and a hash you can recompute—so a refusal is as auditable as a trade.</p>
          </div>
          <button type="button" onClick={loadRuns} className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white" aria-label="Refresh autonomous decision ledger">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
          <LedgerPrinciple icon={Database} label="Observe" detail="Polymarket + Kalshi" />
          <LedgerPrinciple icon={SlidersHorizontal} label="Decide" detail="policy gates + seeded Monte Carlo" />
          <LedgerPrinciple icon={ShieldCheck} label="Prove" detail="hash-bound receipt, replayable" />
        </div>

        <div className="mt-5 space-y-2">
          {loading && runs.length === 0 && <p className="py-6 text-center font-mono text-xs text-white/35">Loading decision receipts…</p>}
          {error && <p className="flex items-center gap-2 border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200"><X className="h-3.5 w-3.5" />{error}</p>}
          {!loading && !error && runs.length === 0 && <p className="border border-dashed border-white/15 px-4 py-8 text-center text-xs leading-5 text-white/45">No recorded runs yet. Start an agent run above; its observations, risk gates, and allocation verdicts will appear here.</p>}
          {runs.map((run) => <RunCard key={run.id} run={run} expanded={expanded === run.id} onToggle={() => setExpanded((current) => current === run.id ? null : run.id)} />)}
        </div>
      </div>
    </section>
  );
}

function LedgerPrinciple({ icon: Icon, label, detail }) {
  return <div className="bg-black/45 px-3 py-3"><Icon className="h-3.5 w-3.5 text-emerald-200/70" /><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/70">{label}</p><p className="mt-0.5 text-[10px] text-white/35">{detail}</p></div>;
}
