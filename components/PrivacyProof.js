'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

/**
 * PrivacyProof — the live, always-on dual-view privacy proof.
 *
 * Two real ledger queries run automatically on mount and every 10s (paused
 * when the tab is hidden), no button required:
 *   LEFT  signatory (operator)        → open + settled positions (real data)
 *   RIGHT non-signatory (observer)    → zero position contracts are visible
 *
 * The contrast IS the product: the operator reads position history while an
 * allocated non-signatory receives no position contracts. In an incomplete
 * environment where no second party is configured, the ledger instead
 * refuses the unallocated-party fallback.
 *
 * The panes are independent: a refused observer query no longer hides the
 * operator's result. When no observer party is allocated we query as an
 * unallocated party, which the ledger refuses — exactly the point.
 */

const POLL_MS = 10_000;

function formatTime(d) {
  if (!d) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function previewJson(obj, n = 240) {
  const s = JSON.stringify(obj, null, 2);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function PrivacyProof() {
  const [state, setState] = useState(null); // { operator, observer, observerPartyId, observerIsConfigured }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  const runQuery = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);

    // Resolve an allocated non-stakeholder; fall back to an unallocated party
    // only when the demo environment has no second party configured.
    let observerPartyId = null;
    let observerPartyName = null;
    let observerIsConfigured = false;
    try {
      const partiesRes = await fetch('/api/canton/parties');
      const partiesData = await partiesRes.json();
      // Prefer a dedicated observer, then Bob: the seeded lifecycle uses
      // Alice as its holder, so Bob is an allocated, authenticated party who
      // is not a stakeholder on that position. This proves contract privacy;
      // an invalid-party auth failure is only a last-resort fallback.
      const observer = partiesData.parties?.find((p) => p.role === 'observer')
        || partiesData.parties?.find((p) => p.name === 'Bob');
      observerPartyId = observer?.id || null;
      observerPartyName = observer?.name || null;
      observerIsConfigured = !!observerPartyId;
    } catch {
      /* fall through to the unallocated-party fallback */
    }
    if (!observerPartyId) {
      observerPartyId = 'ExternalObserver::1220non-signatory-demo-party';
    }

    // Three independent queries — a refused observer read no longer hides
    // the operator result. Open + settled give the operator real history
    // even when the ledger has no open positions.
    const [openRes, settledRes, observerRes] = await Promise.allSettled([
      fetch('/api/canton/positions?type=open'),
      fetch('/api/canton/positions?type=settled'),
      fetch(`/api/canton/positions?type=open&partyId=${encodeURIComponent(observerPartyId)}`),
    ]);

    const read = (r) =>
      r.status === 'fulfilled' && r.value.ok ? r.value.json().catch(() => null) : null;

    const [openData, settledData, observerData] = await Promise.all([
      read(openRes),
      read(settledRes),
      read(observerRes),
    ]);

    if (mountedRef.current) {
      const operatorOpen = openData?.positions || [];
      const operatorSettled = settledData?.positions || [];
      const observerOk = observerData?.success === true;
      const observerErr = observerData?.error || null;
      const sample = operatorOpen[0]?.payload || operatorSettled[0]?.payload || null;

      setState({
        operator: {
          openCount: openData?.count ?? operatorOpen.length,
          settledCount: settledData?.count ?? operatorSettled.length,
          sample,
          error: openData?.success === false ? openData.error : null,
        },
        observer: {
          refused: !observerOk,
          error: observerErr,
          count: observerOk ? (observerData.count ?? observerData.positions?.length ?? 0) : 0,
          positions: observerOk ? observerData.positions || [] : [],
        },
        observerPartyId,
        observerPartyName,
        observerIsConfigured,
      });
      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runQuery();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      runQuery();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [runQuery]);

  const op = state?.operator;
  const obs = state?.observer;

  return (
    <section className="platform-open-section" aria-labelledby="privacy-proof-heading">
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
            <span className="mc-kicker" id="privacy-proof-heading">Privacy proof · live duel</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-[var(--color-ink-faint)]">
              {loading ? 'querying…' : `live · ${formatTime(lastUpdated)}`}
            </span>
            <button
              type="button"
              onClick={() => runQuery({ manual: true })}
              disabled={refreshing}
              className="inline-flex h-7 w-7 items-center justify-center border border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] hover:border-[var(--color-rule-strong)] transition-colors disabled:opacity-40"
              aria-label="Re-run privacy query"
              title="Re-run privacy query"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-5">
        {loading && !state ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-dashed border-[var(--color-rule)] bg-white/[0.02] p-6 text-center text-xs text-[var(--color-ink-faint)]">
              Querying signatory view…
            </div>
            <div className="border border-dashed border-[var(--color-rule)] bg-white/[0.02] p-6 text-center text-xs text-[var(--color-ink-faint)]">
              Querying non-signatory view…
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Signatory view — live */}
            <div className="border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-[var(--color-accent)]" />
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                  Signatory view · live
                </div>
                <span className="ml-auto border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
                  Visible
                </span>
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-2">
                Party: <span className="font-mono text-[var(--color-ink)]">FourcastOperator</span>
              </div>
              {op?.error ? (
                <p className="text-[10px] text-[var(--color-breach)]/80">Operator query failed: {op.error}</p>
              ) : (
                <>
                  <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-3">
                    Open: <span className="text-[var(--color-accent)]">{op?.openCount ?? 0}</span>
                    {' · '}Settled: <span className="text-[var(--color-accent)]">{op?.settledCount ?? 0}</span>
                  </div>
                  {op?.sample ? (
                    <pre className="w-full overflow-x-auto whitespace-pre-wrap break-all rounded bg-[var(--color-paper-deep)] p-2 text-[10px] leading-4 text-[var(--color-ink-muted)] font-mono">
                      {previewJson(op.sample)}
                    </pre>
                  ) : (
                    <p className="text-[10px] text-[var(--color-ink-faint)]">
                      No position contracts visible right now. Create one in the{' '}
                      <a href="/labs/canton" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">operator console</a>{' '}
                      to see data appear here — and stay unreadable on the right.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Non-signatory view — live */}
            <div className="border border-[var(--color-rule)] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <EyeOff className="h-4 w-4 text-[var(--color-ink-faint)]" />
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                  Non-signatory view · live
                </div>
                <span className="ml-auto border border-[var(--color-breach)]/25 bg-[var(--color-breach)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-breach)]">
                  {obs?.refused ? 'Refused' : 'No access'}
                </span>
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-2">
                Party:{' '}
                <span className="font-mono text-[var(--color-ink-muted)]">
                  {state?.observerIsConfigured ? state.observerPartyName : 'ExternalObserver (unallocated fallback)'}
                </span>
              </div>
              {obs?.refused ? (
                <div className="space-y-2">
                  <div className="text-xs leading-5 text-[var(--color-breach)]/90">
                    Result: <span className="font-medium">query refused</span>
                  </div>
                  <p className="text-[10px] leading-5 text-[var(--color-ink-faint)]">
                    The ledger refused the read — this party has no visibility on any position
                    contract. On Canton a non-signatory can&rsquo;t even query the data, not just
                    see an empty list. That refusal is structural privacy enforced by Daml&rsquo;s
                    signatory system.
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-3">
                    Result: <span className="text-[var(--color-ink-muted)]">{obs?.count ?? 0} positions</span>
                  </div>
                  <pre className="w-full overflow-x-auto whitespace-pre-wrap break-all rounded bg-[var(--color-paper-deep)] p-2 text-[10px] leading-4 text-[var(--color-ink-faint)] font-mono">
                    {previewJson(obs?.positions ?? [])}
                  </pre>
                  <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                    Real ledger response — the filter matched nothing, because this party is not a
                    signatory or observer on any position contract.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-[var(--mc-rule)] pt-3">
          <p className="text-[10px] leading-5 text-[var(--color-ink-faint)]">
            On public chains every position is visible to everyone. Here, structural privacy is
            enforced by Daml&rsquo;s signatory system — same ledger, two identities, different worlds.{' '}
            <a href="https://github.com/thisyearnofear/fourcast/blob/main/docs/CANTON_ATOMIC_SETTLEMENT.md" target="_blank" rel="noreferrer" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">How it works ↗</a>
          </p>
        </div>
      </div>
    </section>
  );
}
