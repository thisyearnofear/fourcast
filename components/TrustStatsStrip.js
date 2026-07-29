'use client';

import { useEffect, useState } from 'react';
import TweenNumber from '@/components/motion/TweenNumber';
import { useInView } from '@/hooks/useInView';

/**
 * TrustStatsStrip — aggregate proof-of-use numbers from /api/receipts/stats.
 *
 * Truth-first: renders nothing while loading, on API failure, or when every
 * metric is zero. Only nonzero metrics are shown, so an empty database still
 * reads intentionally (e.g. fixture receipts only). Numbers count up via
 * TweenNumber when the strip scrolls into view; reduced motion lands the
 * final values instantly (TweenNumber handles that internally).
 */
export default function TrustStatsStrip() {
  const [stats, setStats] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.3 });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/receipts/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.stats) setStats(data.stats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  const metrics = [];
  if (stats.sealedDecisions > 0) {
    metrics.push({
      label: 'sealed decisions on record',
      value: stats.sealedDecisions,
      format: (v) => String(Math.round(v)),
    });
  }
  if (stats.totalDecisions > 0 && stats.disciplineRate != null) {
    metrics.push({
      label: 'discipline rate',
      value: stats.disciplineRate * 100,
      format: (v) => `${Math.round(v)}%`,
    });
  }
  if (stats.totalDecisions > 0 && stats.policyAdherenceRate != null) {
    metrics.push({
      label: 'policy adherence',
      value: stats.policyAdherenceRate * 100,
      format: (v) => `${Math.round(v)}%`,
    });
  }
  if (stats.onchainFixtureReceipts > 0) {
    metrics.push({
      label: 'on-chain settled fixtures',
      value: stats.onchainFixtureReceipts,
      format: (v) => String(Math.round(v)),
    });
  }

  if (metrics.length === 0) return null;

  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[metrics.length];

  return (
    <section
      ref={ref}
      className={`evidence-strip mt-10 grid ${colsClass}`}
      aria-label="Receipt record statistics"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="px-4 py-5 text-center">
          <TweenNumber
            value={inView ? metric.value : 0}
            duration={700}
            format={metric.format}
            className="font-display text-2xl font-bold text-[var(--color-ink)]"
          />
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            {metric.label}
          </p>
        </div>
      ))}
    </section>
  );
}
