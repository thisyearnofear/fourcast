'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck, ExternalLink, Copy, Check } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import RouteGuide from '@/components/RouteGuide';
import { BRAND } from '@/constants/brand';

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
      subtitle="A public, mandate-bound track record. Every number below is computed from the operator's sealed decision receipts — not self-reported."
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
          Back to Mandate Control
        </Link>
      </div>

      {loading && (
        <div className="border border-white/10 bg-white/[0.02] p-12 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-emerald-300/40 border-t-emerald-300" />
          <p className="mt-3 text-xs text-white/45">Loading track record…</p>
        </div>
      )}

      {error && (
        <div className="border border-red-400/30 bg-red-500/[0.08] p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Mandate the track record was produced under */}
          <section className="platform-open-section mb-8" aria-label="Operator mandate">
            <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-emerald-300/80" />
                <span className="mc-kicker">Mandate</span>
              </div>
              <p className="mt-1 text-xs text-white/45">
                The policy this operator's agent runs under. Every decision in the track record below was gated by these knobs.
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
                  <p className="mt-3 font-mono text-[10px] text-white/35">
                    policy {mandate.policyVersion} · operator {operatorId.slice(0, 8)}…
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/50">
                  No saved mandate for this operator. The track record below reflects forecasts made before the mandate was persisted.
                </p>
              )}
            </div>
          </section>

          {/* Track record stats */}
          <section className="platform-open-section mb-8" aria-label="Track record stats">
            <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
                <span className="mc-kicker">Track record</span>
              </div>
            </div>
            <div className="px-4 py-5 sm:px-5">
              <div className="evidence-strip grid grid-cols-2 gap-px overflow-hidden bg-white/10 sm:grid-cols-4">
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
                <p className="mt-5 border border-dashed border-white/15 px-4 py-8 text-center text-xs leading-5 text-white/45">
                  No resolved forecasts yet for this operator. When their agent runs and the markets resolve, the track record will populate here.
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="font-mono text-[10px] uppercase tracking-wider text-white/40">
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
                          <td className="px-2 py-2 text-white/80">{f.market_title || f.market_id}</td>
                          <td className="px-2 py-2 font-mono text-white/70">{pct(f.ai_probability)}</td>
                          <td className="px-2 py-2 font-mono text-emerald-300/80">{pct(f.edge)}</td>
                          <td className="px-2 py-2 font-mono text-white/70">{f.actual_outcome != null ? (f.actual_outcome > 0.5 ? 'YES' : 'NO') : '—'}</td>
                          <td className="px-2 py-2 font-mono text-white/70">{f.brier_score != null ? Number(f.brier_score).toFixed(3) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Public-by-design notice */}
          <div className="border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-white/45">
            <div className="flex items-start gap-2">
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-white/40" />
              <p>
                This URL is public by design — it's the target of an OG share card. Anyone with the link can audit this operator's mandate and track record. Private mandates are a Premium-tier feature.
              </p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function MandateKnob({ label, value }) {
  return (
    <div className="bg-black/45 px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/40">{label}</p>
      <p className="mt-1 font-mono text-lg text-white/85">{value}</p>
    </div>
  );
}

function StatCell({ label, value, detail }) {
  return (
    <div className="bg-black/45 px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-white/40">{label}</p>
      <p className="mt-1 font-mono text-xl text-white/85">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] text-white/35">{detail}</p>}
    </div>
  );
}
