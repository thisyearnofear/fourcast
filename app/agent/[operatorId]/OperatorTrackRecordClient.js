'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck, ExternalLink, Copy, Check, Fingerprint } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import RouteGuide from '@/components/RouteGuide';
import { BRAND } from '@/constants/brand';
import TweenNumber from '@/components/motion/TweenNumber';

/**
 * /agent/[operatorId] — the public Track Record URL for a single operator.
 *
 * This is the surface a concierge DM points a prospect at (docs/GO_TO_MARKET.md
 * §2.2 step 4): "here is the mandate this operator runs under, and here is the
 * track record produced under that mandate." It composes the same data the
 * global /positions page shows, scoped to one operator_id (migration 0010) and
 * pre-populated with their saved mandate (migration 0011).
 *
 * No auth in this slice — the URL is public by design (it's the OG share card
 * target). Auth + private mandates are a Premium-tier feature, post-concierge.
 */

function pct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export default function OperatorTrackRecordClient({ operatorId, initialData }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!operatorId) return;
    // If we have initialData from the server, don't re-fetch on mount.
    if (initialData) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agent/track-record/${encodeURIComponent(operatorId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.success) throw new Error(d.error || 'Failed to load track record');
        setData(d);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [operatorId, initialData]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const mandate = data?.mandate;
  const stats = data?.stats || {};
  const forecasts = data?.recentForecasts || [];

  return (
    <AppShell
      title={mandate?.displayName ? `${mandate.displayName}'s track record` : 'Operator track record'}
      subtitle="Every number is computed from sealed decision receipts — not self-reported."
      maxWidth="max-w-4xl"
      actions={
        <button
          type="button"
          onClick={copyUrl}
          className="mc-action inline-flex items-center gap-1.5 px-3 py-2 text-xs"
          title="Copy this track record URL"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>
      }
    >
      <RouteGuide route="positions" />

      {/* Back to mandate builder */}
      <div className="mb-6">
        <Link href="/agent" className="mc-nav-link no-underline inline-flex items-center gap-1.5 text-xs">
          <ArrowLeft className="h-3 w-3" />
          Back to Mandate
        </Link>
      </div>

      {loading && (
        <div className="border border-[var(--color-rule)] bg-white/[0.02] p-12 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)]/40 border-t-[var(--color-accent)]" />
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">Loading track record…</p>
        </div>
      )}

      {error && (
        <div className="border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/[0.08] p-4 text-sm text-[var(--color-breach)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mobile-readable">
          {/* Operator card — the designed sports-card hero. This is the
              shareable artifact: identity, calibration, and mandate in one
              glance. */}
          <OperatorCard
            name={mandate?.displayName || `Operator ${operatorId?.slice(0, 8) ?? ''}`}
            operatorId={operatorId}
            stats={stats}
            mandate={mandate}
          />

          {/* Mandate the track record was produced under */}
          <section className="platform-open-section mb-8" aria-label="Operator mandate">
            <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
                <span className="mc-kicker">Mandate</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                The policy every decision below was gated by.
              </p>
            </div>
            <div className="px-4 py-5 sm:px-5">
              {mandate ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MandateKnob label="Min edge" value={pct(mandate.minAbsoluteEdge, 0)} />
                    <MandateKnob label="Max allocation" value={pct(mandate.maxAllocationPct, 1)} />
                    <MandateKnob label="Tail-loss limit" value={pct(mandate.maxLossProbability, 0)} />
                    <MandateKnob label="Monte Carlo paths" value={mandate.simulationRuns?.toLocaleString()} />
                  </div>
                  <p className="mt-3 font-mono text-[10px] text-[var(--color-ink-faint)]">
                    policy {mandate.policyVersion} · operator {operatorId.slice(0, 8)}…
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--color-ink-faint)]">
                  No saved mandate — forecasts below predate the mandate system.
                </p>
              )}
            </div>
          </section>

          {/* Track record stats */}
          <section className="platform-open-section mb-8" aria-label="Track record stats">
            <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
                <span className="mc-kicker">Track record</span>
              </div>
            </div>
            <div className="px-4 py-5 sm:px-5">
              <div className="evidence-strip grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-4">
                <StatCell label="Total forecasts" value={stats.total_forecasts ?? 0} />
                <StatCell label="Resolved" value={stats.resolved_forecasts ?? 0} />
                <StatCell
                  label="Avg Brier"
                  value={stats.avg_brier_score != null ? Number(stats.avg_brier_score).toFixed(3) : '—'}
                  detail="lower is better"
                />
                <StatCell
                  label="High-conf Brier"
                  value={stats.high_conf_brier != null ? Number(stats.high_conf_brier).toFixed(3) : '—'}
                  detail={`${stats.high_conf_count ?? 0} resolved`}
                />
              </div>

              {forecasts.length === 0 ? (
                <p className="mt-5 border border-dashed border-[var(--color-rule)] px-4 py-8 text-center text-xs text-[var(--color-ink-faint)]">
                  No resolved forecasts yet.
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                      <tr>
                        <th className="px-2 py-2">Market</th>
                        <th className="px-2 py-2">AI prob</th>
                        <th className="px-2 py-2">Edge</th>
                        <th className="px-2 py-2">Outcome</th>
                        <th className="px-2 py-2">Brier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts.slice(0, 20).map((f) => (
                        <tr key={f.id} className="border-t border-white/[0.08]">
                          <td className="px-2 py-2 text-[var(--color-ink)]">{f.market_title || f.market_id}</td>
                          <td className="px-2 py-2 font-mono text-[var(--color-ink-muted)]">{pct(f.ai_probability)}</td>
                          <td className="px-2 py-2 font-mono text-[var(--color-accent)]/80">{pct(f.edge)}</td>
                          <td className="px-2 py-2 font-mono text-[var(--color-ink-muted)]">{f.actual_outcome != null ? (f.actual_outcome > 0.5 ? 'YES' : 'NO') : '—'}</td>
                          <td className="px-2 py-2 font-mono text-[var(--color-ink-muted)]">{f.brier_score != null ? Number(f.brier_score).toFixed(3) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Public-by-design notice */}
          <div className="flex items-center gap-2 border border-[var(--color-rule)] bg-white/[0.02] px-3 py-2.5 text-[11px] text-[var(--color-ink-faint)]">
            <ExternalLink className="h-3 w-3 shrink-0 text-[var(--color-ink-faint)]" />
            <span>Public by design — anyone with the link can audit this. Private mandates are Premium.</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MandateKnob({ label, value }) {
  return (
    <div className="bg-[var(--color-paper-deep)] px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-1 font-mono text-lg text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function StatCell({ label, value, detail }) {
  return (
    <div className="bg-[var(--color-paper-deep)] px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-1 font-mono text-xl text-[var(--color-ink)]">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] text-[var(--color-ink-faint)]">{detail}</p>}
    </div>
  );
}

/* OperatorCard — the designed sports-card hero for a public track record.
   Identity, calibration, and mandate in one glance. This is what a prospect
   sees when they click a shared track-record URL — the viral surface. */
function OperatorCard({ name, operatorId, stats, mandate }) {
  const total = stats.total_forecasts ?? 0;
  const resolved = stats.resolved_forecasts ?? 0;
  const brier = stats.avg_brier_score != null ? Number(stats.avg_brier_score) : null;
  // Calibration: a Brier score of 0 is perfect; 0.33 is random for a binary
  // market. Map 0..0.5 to 100..0 so a lower Brier reads as higher calibration.
  const calibration = brier != null ? Math.max(0, Math.min(100, Math.round((1 - brier / 0.5) * 100))) : null;
  const calibrationTone = calibration == null ? 'var(--color-ink-faint)' : calibration >= 70 ? 'var(--color-accent)' : calibration >= 50 ? 'var(--color-sealed)' : 'var(--color-breach)';

  return (
    <section className="relative overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-deep)] mb-8" aria-label="Operator card">
      {/* Sparse hairline grid — mission-control graph paper. */}
      <div className="pointer-events-none absolute inset-0 mc-grid--sparse opacity-[0.3]" aria-hidden />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
              <span className="mc-kicker">Operator track record</span>
            </div>
            <h2 className="fc-display mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink)] sm:text-4xl">
              {name}
            </h2>
            <p className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-[var(--color-ink-faint)]">
              operator {operatorId?.slice(0, 10)}…
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="mc-stamp mc-stamp--allocate">
              <ShieldCheck className="h-3 w-3" />
              Mandate-bound
            </span>
          </div>
        </div>

        {/* Calibration + headline stats */}
        <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Calibration bar — the "is this operator any good?" answer at a glance. */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--color-ink-faint)]">Calibration</span>
              <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">from Brier {brier != null ? brier.toFixed(3) : '—'}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span style={{ color: calibrationTone }}>
                <TweenNumber
                  value={calibration ?? 0}
                  duration={900}
                  format={(v) => `${Math.round(v)}`}
                  className="font-display text-4xl font-bold tracking-tight"
                />
              </span>
              <span className="text-2xl font-light" style={{ color: calibrationTone }}>%</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-[var(--color-paper-soft)] overflow-hidden">
              <div
                className="h-full transition-[width] duration-700"
                style={{ width: `${calibration ?? 0}%`, background: calibrationTone }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-[var(--color-ink-faint)]">
              Lower Brier = better calibration. 100% means every probability matched the outcome frequency.
            </p>
          </div>

          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-px overflow-hidden bg-[var(--color-rule)]">
            <OperatorStat label="Forecasts" value={total} />
            <OperatorStat label="Resolved" value={resolved} />
            <OperatorStat label="High-conf Brier" value={stats.high_conf_brier != null ? Number(stats.high_conf_brier).toFixed(3) : '—'} detail={`${stats.high_conf_count ?? 0} resolved`} />
          </div>
        </div>

        {/* Mandate strip — the policy every decision was gated by. */}
        {mandate && (
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--color-rule)] pt-4 font-mono text-[11px] text-[var(--color-ink-faint)]">
            <span className="inline-flex items-center gap-1.5 text-[var(--color-ink-muted)]">
              <Scale className="h-3 w-3 text-[var(--color-accent)]/70" />
              Mandate {mandate.policyVersion}
            </span>
            <span>min edge <span className="text-[var(--color-ink)]">{pct(mandate.minAbsoluteEdge, 0)}</span></span>
            <span>max alloc <span className="text-[var(--color-ink)]">{pct(mandate.maxAllocationPct, 1)}</span></span>
            <span>tail ≤ <span className="text-[var(--color-ink)]">{pct(mandate.maxLossProbability, 0)}</span></span>
            <span>{mandate.simulationRuns?.toLocaleString()} paths</span>
          </div>
        )}
      </div>
    </section>
  );
}

function OperatorStat({ label, value, detail }) {
  return (
    <div className="bg-[var(--color-paper-deep)] px-3 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-1 font-mono text-2xl text-[var(--color-ink)]">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] text-[var(--color-ink-faint)]">{detail}</p>}
    </div>
  );
}
