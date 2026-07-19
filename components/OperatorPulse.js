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

export default function OperatorPulse({ compact = false, className = '' }) {
  const { loading, pulse } = useOperatorPulse();
  const isActive = pulse?.mode === 'LIVE' || pulse?.mode === 'DRY RUN';

  if (compact) {
    return (
      <div className={`operator-pulse operator-pulse--compact ${className}`} aria-live="polite">
        <span className={`operator-pulse__lamp ${isActive ? 'is-active' : ''}`} />
        <span>{loading ? 'SYNCING' : pulse?.mode || 'SYSTEM'}</span>
        {!loading && <span className="operator-pulse__quiet">{pulse?.freshEdges || 0} fresh edges</span>}
      </div>
    );
  }

  return (
    <section className={`operator-pulse ${className}`} aria-label="Operator system pulse" aria-live="polite">
      <div className="operator-pulse__primary">
        <span className={`operator-pulse__lamp ${isActive ? 'is-active' : ''}`} />
        <span className="operator-pulse__label">Operator pulse</span>
        <strong>{loading ? 'Synchronizing system' : pulse?.mode || 'System status unavailable'}</strong>
      </div>
      <div className="operator-pulse__metrics">
        <span><b>{loading ? '—' : pulse?.marketsScanned || 0}</b> markets scanned</span>
        <span><b>{loading ? '—' : pulse?.freshEdges || 0}</b> edges ≥ 5%</span>
        <span><b>{loading ? '—' : formatAge(pulse?.lastRunAt)}</b> last sweep</span>
      </div>
    </section>
  );
}
