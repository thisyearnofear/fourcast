'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Check, CircleAlert, Database, RefreshCw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

const VERDICT = {
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

function RunCard({ run, expanded, onToggle }) {
  const summary = run.summary || {};
  const config = run.config || {};
  const execution = summary.execution || {};
  const highlights = summary.highlights || [];
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
            <span>Sources: {summary.sources?.join(' + ') || 'market feeds'}</span>
            <span>Risk: {Math.round((config.riskTolerance || 0) * 100)}%</span>
            <span>Min volume: ${(config.minVolume || 0).toLocaleString()}</span>
          </div>
          {highlights.length > 0 ? (
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
        </div>
      )}
    </article>
  );
}

function Metric({ value, label, accent = false }) {
  return <div><div className={`font-mono text-lg ${accent ? 'text-emerald-200' : 'text-white/75'}`}>{value}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</div></div>;
}

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
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">Observe market venues, test contract equivalence, price risk, then allocate or decline. The agent records why—not just what it found.</p>
          </div>
          <button type="button" onClick={loadRuns} className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white" aria-label="Refresh autonomous decision ledger">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
          <LedgerPrinciple icon={Database} label="Observe" detail="Polymarket + Kalshi" />
          <LedgerPrinciple icon={SlidersHorizontal} label="Decide" detail="semantic + net-spread gates" />
          <LedgerPrinciple icon={ShieldCheck} label="Act safely" detail="Kelly sizing + execution rails" />
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
