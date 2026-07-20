'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Scale } from 'lucide-react';
import { isPolicyAdherentDecision } from '@/services/domain/decision/decisionPolicy';

/**
 * Allocator-facing mandate view. Derived entirely from the public decision
 * ledger API—the same receipts an operator sees—so an allocator never has to
 * trust a private report. No policy, hash, or simulation math happens here;
 * this panel only aggregates verdicts the domain layer already produced.
 */
export function MandatePanel() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/agent/runs?limit=30', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load mandate data');
      setRuns(data.runs || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const mandate = useMemo(() => deriveMandate(runs), [runs]);

  return (
    <section className="platform-workbench px-4 py-6 sm:px-6 sm:py-8" aria-labelledby="mandate-heading">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-sky-200/80">
              <Scale className="h-3.5 w-3.5" /> Allocator mandate view
            </div>
            <h2 id="mandate-heading" className="mt-2 font-display text-lg font-semibold tracking-tight text-white">
              Did the agent do what it said it would?
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
              Mandate adherence computed from public decision receipts — check every number against the ledger.
            </p>
          </div>
          <button type="button" onClick={load} className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white" aria-label="Refresh mandate view">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p className="mt-4 border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}

        {!error && !mandate.hasReceipts && !loading && (
          <p className="mt-4 border border-dashed border-white/15 px-4 py-8 text-center text-xs leading-5 text-white/45">
            No receipt-backed decisions yet. Run the agent on /agent and this panel will report its mandate adherence.
          </p>
        )}

        {mandate.hasReceipts && (
          <>
            <div className="evidence-strip mt-6 grid grid-cols-2 gap-px overflow-hidden bg-white/10 sm:grid-cols-4">
              <MandateMetric label="Verified receipts" value={`${mandate.receiptBacked}/${mandate.totalRuns}`} detail="runs carrying a hash-bound receipt" />
              <MandateMetric label="Policy adherence" value={`${mandate.adherencePct}%`} detail="decisions the policy gate settled" accent={mandate.adherencePct === 100} />
              <MandateMetric label="Discipline rate" value={`${mandate.disciplinePct}%`} detail="PASS or REVIEW over ALLOCATE" hint="A high pass share is a feature: the gate binds when edge is thin or tail risk is wide." />
              <MandateMetric label="Max allocation" value={`${mandate.maxAllocationPct}%`} detail="largest single allocation cleared" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="border-t border-white/[0.12] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Stated policy</p>
                {mandate.policy ? (
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-white/65">
                    <li>min edge <span className="text-white/90">{(mandate.policy.minAbsoluteEdge * 100).toFixed(0)}%</span></li>
                    <li>allocation cap <span className="text-white/90">{(mandate.policy.maxAllocationPct * 100).toFixed(0)}% of capital</span></li>
                    <li>tail-loss limit <span className="text-white/90">{(mandate.policy.maxLossProbability * 100).toFixed(0)}%</span></li>
                    <li>simulation <span className="text-white/90">{mandate.policy.simulationRuns?.toLocaleString()} seeded runs</span></li>
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-white/40">Policy version unavailable on these receipts.</p>
                )}
              </div>
              <div className="border-t border-white/[0.12] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Verdict mix</p>
                <div className="mt-2 flex h-2 overflow-hidden bg-white/10">
                  {mandate.mix.allocate > 0 && <div className="bg-emerald-400/70" style={{ width: `${(mandate.mix.allocate / mandate.totalDecisions) * 100}%` }} />}
                  {mandate.mix.pass > 0 && <div className="bg-amber-300/60" style={{ width: `${(mandate.mix.pass / mandate.totalDecisions) * 100}%` }} />}
                  {mandate.mix.review > 0 && <div className="bg-sky-300/60" style={{ width: `${(mandate.mix.review / mandate.totalDecisions) * 100}%` }} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-white/55">
                  <span><span className="text-emerald-300">●</span> allocate {mandate.mix.allocate}</span>
                  <span><span className="text-amber-300">●</span> pass {mandate.mix.pass}</span>
                  <span><span className="text-sky-300">●</span> review {mandate.mix.review}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MandateMetric({ label, value, detail, accent = false, hint }) {
  return (
    <div className="bg-black/45 px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/40">
        {label}
        {hint && (
          <span className="mc-tooltip ml-1" tabIndex={0} role="button" aria-label={hint}>
            ?
            <span className="mc-tooltip__bubble">{hint}</span>
          </span>
        )}
      </p>
      <p className={`mt-1 font-mono text-xl ${accent ? 'text-emerald-200' : 'text-white/85'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-white/35">{detail}</p>
    </div>
  );
}

function deriveMandate(runs) {
  let totalDecisions = 0;
  let receiptBacked = 0;
  let maxAllocation = 0;
  let adherentDecisions = 0;
  const mix = { allocate: 0, pass: 0, review: 0 };
  let policy = null;

  for (const run of runs) {
    const proof = run?.summary?.proof;
    if (proof?.integrity?.contentHash) receiptBacked += 1;
    if (!policy && proof?.policy) policy = proof.policy;
    const decisions = proof?.decisions || [];
    for (const decision of decisions) {
      totalDecisions += 1;
      const verdict = (decision?.decision?.verdict || '').toLowerCase();
      if (isPolicyAdherentDecision(decision?.decision)) adherentDecisions += 1;
      if (verdict === 'allocate') {
        mix.allocate += 1;
        maxAllocation = Math.max(maxAllocation, decision?.decision?.allocationPct || 0);
      } else if (verdict === 'pass') {
        mix.pass += 1;
      } else if (verdict === 'review') {
        mix.review += 1;
      }
    }
  }

  return {
    hasReceipts: totalDecisions > 0,
    totalRuns: runs.length,
    receiptBacked,
    totalDecisions,
    mix,
    policy,
    maxAllocationPct: Math.round(maxAllocation * 1000) / 10,
    adherencePct: totalDecisions ? Math.round((adherentDecisions / totalDecisions) * 100) : 0,
    disciplinePct: totalDecisions ? Math.round(((mix.pass + mix.review) / totalDecisions) * 100) : 0,
  };
}
