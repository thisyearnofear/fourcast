'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CircleDot, Clock3, Fingerprint, Radio, RefreshCw, ShieldCheck } from 'lucide-react';

const PHASE = {
  decision_receipt_created: { label: 'Receipt sealed', detail: 'Outcome withheld', tone: 'text-amber-100 border-amber-300/30 bg-amber-300/10' },
  proof_reconciled: { label: 'Proof reconciled', detail: 'Outcome verified', tone: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10' },
  waiting: { label: 'Clock advancing', detail: 'No outcome access', tone: 'text-sky-200 border-sky-300/30 bg-sky-300/10' },
  complete: { label: 'Run complete', detail: 'Receipt retained', tone: 'text-emerald-200 border-emerald-400/30 bg-emerald-400/10' },
};

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }).format(new Date(value));
}

export function HistoricalLabPanel() {
  const [state, setState] = useState({ loading: true, status: null, error: null });
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/historical-lab', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Status unavailable');
      setState({ loading: false, status: data.status, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const latest = state.status?.receipts?.[0];
  const phase = PHASE[latest?.phase] || PHASE.waiting;
  const timeline = latest?.timeline;

  return (
    <section className="mt-8 overflow-hidden border border-emerald-300/20 bg-[#08110f]" aria-labelledby="historical-lab-heading">
      <div className="relative border-b border-emerald-300/15 bg-[linear-gradient(90deg,rgba(16,185,129,0.12),transparent_55%)] px-4 py-4 sm:px-5">
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-40 [background-image:linear-gradient(rgba(110,231,183,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(110,231,183,.14)_1px,transparent_1px)] [background-size:12px_12px]" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200"><Radio className="h-3.5 w-3.5 animate-pulse" /> VPS telemetry · replay-only</div>
            <h2 id="historical-lab-heading" className="mt-2 font-display text-lg font-semibold tracking-tight text-white">Autonomous Historical Lab</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/55">Persistent agent replays evidence in time order; proof revealed after settlement.</p>
          </div>
          <button type="button" onClick={load} className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center border border-emerald-200/20 text-emerald-100/70 transition hover:border-emerald-200/50 hover:text-emerald-100" aria-label="Refresh historical lab status"><RefreshCw className={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {state.error && <p className="border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-100">{state.error}</p>}
        {!state.loading && !state.error && !state.status && <p className="border border-dashed border-emerald-300/20 p-4 text-xs leading-5 text-white/50">Worker has not checked in yet. The lab remains private until its first signed heartbeat.</p>}
        {state.status && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${phase.tone}`}><CircleDot className="h-3 w-3" />{phase.label}</span>
              <span className="font-mono text-[10px] text-white/40">agent clock {formatTime(state.status.agentTime)}</span>
              <span className="font-mono text-[10px] text-white/40">dry run · no public port</span>
            </div>
            <div className="mt-4 grid gap-px overflow-hidden border border-emerald-200/15 bg-emerald-200/10 sm:grid-cols-3">
              <TimelineCell icon={Clock3} label="Evidence visible" value={formatTime(timeline?.decisionAvailableAt)} />
              <TimelineCell icon={Fingerprint} label="Receipt hash" value={latest?.receiptHash ? `${latest.receiptHash.slice(0, 12)}…` : 'pending'} mono />
              <TimelineCell icon={ShieldCheck} label="Proof visibility" value={latest?.reconciliationStatus ? 'Reconciled' : `${formatTime(timeline?.outcomeAvailableAt)} locked`} />
            </div>
            {latest && <a href={`/api/worldcup/verify?fixtureId=${encodeURIComponent(latest.fixtureId)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs text-emerald-100 underline decoration-emerald-300/40 underline-offset-4 transition hover:text-white">Verify this TxLINE proof chain <ArrowUpRight className="h-3.5 w-3.5" /></a>}
          </>
        )}
      </div>
    </section>
  );
}

function TimelineCell({ icon: Icon, label, value, mono = false }) {
  return <div className="bg-black/30 px-3 py-3"><Icon className="h-3.5 w-3.5 text-emerald-200/70" /><p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p><p className={`mt-1 text-xs text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</p></div>;
}
