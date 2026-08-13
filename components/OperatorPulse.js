'use client';

import { useEffect, useState } from 'react';

const REFRESH_MS = 30_000;

function formatAge(timestamp) {
  if (!timestamp) return 'awaiting first run';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function useArenaAge() {
  const [ts, setTs] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/arena/feed?limit=1')
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d?.latest?.timestamp) setTs(d.latest.timestamp); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return ts ? formatAge(Math.floor(new Date(ts).getTime() / 1000)) : null;
}

export function useOperatorPulse() {
  const [state, setState] = useState({ loading: true, pulse: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/operator/pulse');
        const data = await response.json();
        if (!cancelled) setState({ loading: false, pulse: data.success ? data.pulse : null });
      } catch {
        if (!cancelled) setState({ loading: false, pulse: null });
      }
    };

    load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return state;
}

export default function OperatorPulse({ compact = false, className = '', liveCounts = null }) {
  const { loading, pulse } = useOperatorPulse();
  const arenaAge = useArenaAge();
  const isActive = pulse?.mode === 'LIVE' || pulse?.mode === 'DRY RUN' || !!liveCounts || !!arenaAge;

  // Merge API pulse with live market counts so the header feels alive
  // even when the backend agent hasn't run.
  const marketsScanned = liveCounts?.marketsScanned ?? pulse?.marketsScanned ?? 0;
  const freshEdges = liveCounts?.freshEdges ?? pulse?.freshEdges ?? 0;
  const modeLabel = liveCounts ? 'LIVE' : (pulse?.mode || 'SYSTEM');

  if (compact) {
    return (
      <a
        href="/arena"
        aria-live="polite"
        title="Arena — live agent ledger"
        className={`operator-pulse operator-pulse--compact no-underline ${className}`}
      >
        <span className={`operator-pulse__lamp ${isActive ? 'is-active' : ''}`} />
        <span>{loading ? 'SYNCING' : modeLabel}</span>
        {!loading && <span className="operator-pulse__quiet">{freshEdges} fresh edges</span>}
        {arenaAge && <span className="operator-pulse__quiet">· arena {arenaAge}</span>}
      </a>
    );
  }

  return (
    <section className={`operator-pulse ${className}`} aria-label="Operator system pulse" aria-live="polite">
      <div className="operator-pulse__primary">
        {liveCounts ? (
          <span className="fc-radar" aria-hidden />
        ) : (
          <span className={`operator-pulse__lamp ${isActive ? 'is-active' : ''}`} />
        )}
        <span className="operator-pulse__label">Operator pulse</span>
        <strong>{loading ? 'Synchronizing system' : modeLabel}</strong>
      </div>
      <div className="operator-pulse__metrics">
        <span><b>{loading ? '—' : marketsScanned}</b> markets scanned</span>
        <span><b>{loading ? '—' : freshEdges}</b> edges ≥ 5%</span>
        <span><b>{loading ? '—' : formatAge(pulse?.lastRunAt)}</b> last sweep</span>
      </div>
    </section>
  );
}
