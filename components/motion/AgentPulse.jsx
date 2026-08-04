'use client';

import { useEffect, useState } from 'react';

/* --------------------------------------------------------------------------
   AgentPulse — the live "the agent is alive" indicator.

   Surfaces the agent's current phase as a breathing status board: a radar
   lamp that sweeps while scanning, slows when idle, and a live relative
   clock that ticks "last decision 3m ago". This is the retention engine —
   the product feels alive and worth checking back on.

   Props:
     agentTime   — ISO timestamp of the last heartbeat / decision
     phase       — 'scanning' | 'sealed' | 'awaiting' | 'reconciled' | 'idle'
     dryRun      — whether the agent is in historical-replay mode
     className   — passthrough
   -------------------------------------------------------------------------- */

const PHASE_META = {
  scanning: { label: 'Scanning markets', lamp: 'var(--color-evidence)', sweep: true },
  sealed: { label: 'Decision sealed', lamp: 'var(--color-sealed)', sweep: false },
  awaiting: { label: 'Awaiting outcome', lamp: 'var(--color-sealed)', sweep: false },
  reconciled: { label: 'Reconciled', lamp: 'var(--color-accent)', sweep: false },
  idle: { label: 'Idle', lamp: 'rgba(243,240,231,0.3)', sweep: false },
};

function useRelativeClock(agentTime) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!agentTime) return 'cold start';
  const diffMs = now - new Date(agentTime).getTime();
  if (!Number.isFinite(diffMs)) return '—';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function AgentPulse({ agentTime, phase = 'idle', dryRun = false, className = '' }) {
  const relative = useRelativeClock(agentTime);
  const meta = PHASE_META[phase] || PHASE_META.idle;

  return (
    <div
      className={`fc-agent-pulse inline-flex items-center gap-2.5 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Agent ${meta.label}, last activity ${relative}`}
    >
      <span className="fc-agent-pulse__lamp" style={{ '--lamp-color': meta.lamp }} data-sweep={meta.sweep ? 'on' : 'off'} aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          {dryRun ? 'replay · ' : ''}{meta.label}
        </span>
        <span className="font-mono text-[9px] tracking-[0.04em] text-[var(--color-ink-faint)]">
          {relative}
        </span>
      </span>
    </div>
  );
}
