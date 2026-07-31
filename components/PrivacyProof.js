'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

/**
 * PrivacyProof — the live, always-on dual-view privacy proof.
 *
 * Two real ledger queries run automatically on mount and every 10s (paused
 * when the tab is hidden), no button required:
 *   LEFT  signatory (operator, as counterparty) → full position data
 *   RIGHT non-signatory (observer party)        → a REAL empty result set
 *
 * The contrast IS the product: same ledger, same query, two identities,
 * different worlds. This is structural privacy performed, not described.
 *
 * The observer party ID comes from /api/canton/parties (CANTON_OBSERVER_PARTY_ID);
 * when none is allocated we query with an unallocated party ID, which on
 * Canton still yields a genuine live empty result — the filter matches nothing.
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
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  const runQuery = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    // Resolve the observer party; fall back to an unallocated party ID.
    let observerPartyId = null;
    let observerIsConfigured = false;
    try {
      const partiesRes = await fetch('/api/canton/parties');
      const partiesData = await partiesRes.json();
      const observer = partiesData.parties?.find((p) => p.role === 'observer');
      observerPartyId = observer?.id || null;
      observerIsConfigured = !!observerPartyId;
    } catch {
      /* fall through to the unallocated-party fallback */
    }
    if (!observerPartyId) {
      observerPartyId = 'ExternalObserver::1220non-signatory-demo-party';
    }

    try {
      const [holderRes, observerRes] = await Promise.all([
        fetch('/api/canton/positions?type=open'),
        fetch(`/api/canton/positions?type=open&partyId=${encodeURIComponent(observerPartyId)}`),
      ]);
      const holderData = await holderRes.json();
      const observerData = await observerRes.json();
      if (!observerData.success) {
        throw new Error(observerData.error || 'Observer query failed');
      }
      if (mountedRef.current) {
        setResults({ holder: holderData, observer: observerData, observerPartyId, observerIsConfigured });
        setLastUpdated(new Date());
        setLoading(false);
        setRefreshing(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setResults({ error: err.message });
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runQuery();
    const id = setInterval(() => {
      // Don't hammer the ledger when nobody's looking.
      if (typeof document !== 'undefined' && document.hidden) return;
      runQuery();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [runQuery]);

  const holderCount = results?.holder?.count ?? results?.holder?.positions?.length ?? 0;
  const observerCount = results?.observer?.count ?? results?.observer?.positions?.length ?? 0;
  const firstPos = results?.holder?.positions?.[0]?.payload;

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
        {loading && !results ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-dashed border-[var(--color-rule)] bg-white/[0.02] p-6 text-center text-xs text-[var(--color-ink-faint)]">
              Querying signatory view…
            </div>
            <div className="border border-dashed border-[var(--color-rule)] bg-white/[0.02] p-6 text-center text-xs text-[var(--color-ink-faint)]">
              Querying non-signatory view…
            </div>
          </div>
        ) : results?.error ? (
          <div className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/10 p-4 text-xs text-[var(--color-breach)]">
            Privacy query failed: {results.error}
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
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-2">
                Party: <span className="font-mono text-[var(--color-ink)]">FourcastOperator</span>
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-3">
                Result: <span className="text-[var(--color-accent)]">{holderCount} positions</span>
              </div>
              {firstPos ? (
                <pre className="overflow-x-auto rounded bg-[var(--color-paper-deep)] p-2 text-[10px] leading-4 text-[var(--color-ink-muted)] font-mono">
                  {previewJson(firstPos)}
                </pre>
              ) : (
                <p className="text-[10px] text-[var(--color-ink-faint)]">
                  No open positions. Create one in the{' '}
                  <a href="/labs/canton" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">operator console</a>{' '}
                  to see data appear here — and stay empty on the right.
                </p>
              )}
            </div>

            {/* Non-signatory view — live */}
            <div className="border border-[var(--color-rule)] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <EyeOff className="h-4 w-4 text-[var(--color-ink-faint)]" />
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                  Non-signatory view · live
                </div>
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-2">
                Party:{' '}
                <span className="font-mono text-[var(--color-ink-muted)]">
                  {results?.observerIsConfigured ? 'Public Observer' : 'ExternalObserver (unallocated)'}
                </span>
              </div>
              <div className="text-xs leading-5 text-[var(--color-ink-muted)] mb-3">
                Result: <span className="text-[var(--color-ink-muted)]">{observerCount} positions</span>
              </div>
              <pre className="overflow-x-auto rounded bg-[var(--color-paper-deep)] p-2 text-[10px] leading-4 text-[var(--color-ink-faint)] font-mono">
                {previewJson(results?.observer?.positions ?? [])}
              </pre>
              <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                Real ledger response — the filter matched nothing, because this party is not a
                signatory or observer on any position contract.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-[var(--mc-rule)] pt-3">
          <p className="text-[10px] leading-5 text-[var(--color-ink-faint)]">
            On public chains every position is visible to everyone. Here, structural privacy is
            enforced by Daml's signatory system — same query, two identities, different worlds.{' '}
            <a href="/docs/CANTON_ATOMIC_SETTLEMENT.md" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">How it works →</a>
          </p>
        </div>
      </div>
    </section>
  );
}
