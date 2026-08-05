'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Zap } from 'lucide-react';
import Ripple from '@/components/canvasui/Ripple';
import TweenNumber from '@/components/motion/TweenNumber';
import EduWait from '@/components/EduWait';
import TalkToUs from '@/components/TalkToUs';

/**
 * PrivacyProof — live dual-view privacy check.
 *
 * LEFT  stakeholder (operator) → positions visible
 * RIGHT non-stakeholder       → empty / refused
 *
 * Auto-polls; manual "Run privacy check" for the room — panes react on each hit.
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

function extractPositionSummary(sample) {
  if (!sample || typeof sample !== 'object') return null;
  const stake =
    sample.stake ?? sample.amount ?? sample.size ?? sample.quantity ?? sample.lockedAmount ?? null;
  const side =
    sample.side ?? sample.outcome ?? sample.position ?? sample.choice ?? null;
  const market =
    sample.marketId ?? sample.market ?? sample.question ?? null;
  if (stake == null && side == null) return null;
  return { stake, side, market };
}

/** Compact stake for the dual-view pane — avoid "0.4000000000" colliding with Side. */
function formatStake(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const s = String(value);
    return s.length > 12 ? `${s.slice(0, 10)}…` : s;
  }
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  // Sub-unit stakes: trim trailing zeros, cap length
  const fixed = n.toFixed(6).replace(/\.?0+$/, '');
  return fixed || '0';
}

function formatSide(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  if (/^(yes|no)$/i.test(s)) return s.toUpperCase() === 'YES' ? 'Yes' : 'No';
  return s.length > 10 ? `${s.slice(0, 8)}…` : s;
}

export default function PrivacyProof() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [reactKey, setReactKey] = useState(0);
  /** Manual check only — first load uses `loading && !state`. Quiet polls stay silent. */
  const [manualTeach, setManualTeach] = useState(false);
  const mountedRef = useRef(true);

  const runQuery = useCallback(async ({ manual = false } = {}) => {
    if (manual) {
      setRefreshing(true);
      setManualTeach(true);
    }

    let observerPartyId = null;
    let observerPartyName = null;
    let observerIsConfigured = false;
    try {
      const partiesRes = await fetch('/api/canton/parties');
      const partiesData = await partiesRes.json();
      const observer = partiesData.parties?.find((p) => p.role === 'observer')
        || partiesData.parties?.find((p) => p.name === 'Bob');
      observerPartyId = observer?.id || null;
      observerPartyName = observer?.name || null;
      observerIsConfigured = !!observerPartyId;
    } catch {
      /* fall through */
    }
    if (!observerPartyId) {
      observerPartyId = 'ExternalObserver::1220non-signatory-demo-party';
    }

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
          summary: extractPositionSummary(sample),
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
      setManualTeach(false);
      // Punch panes whenever the ledger answers — live feel without scroll theater.
      setReactKey((k) => k + 1);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runQuery({ manual: false });
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      runQuery({ manual: false });
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [runQuery]);

  const op = state?.operator;
  const obs = state?.observer;
  const summary = op?.summary;
  const reacting = reactKey > 0;

  return (
    <section className="platform-open-section fc-life-stage" aria-labelledby="privacy-proof-heading">
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
            <Eye className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
            <span className="mc-kicker" id="privacy-proof-heading">Privacy check · live</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--color-ink-faint)] tabular-nums">
              {loading || refreshing ? 'querying…' : formatTime(lastUpdated)}
            </span>
            <Ripple
              options={{
                amplitude: 0.28,
                refraction: 50,
                shine: 0.35,
                dispersion: 0.25,
                decay: 1.3,
                wavelength: 64,
              }}
              style={{ display: 'inline-block' }}
            >
              <button
                type="button"
                onClick={() => runQuery({ manual: true })}
                disabled={refreshing}
                className={`fc-action mc-action--primary fc-action--pulse inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40 disabled:animate-none`}
                aria-label="Run privacy check"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                Run privacy check
              </button>
            </Ripple>
          </div>
        </div>
      </div>

      {reacting && (
        <div key={`duel-${reactKey}`} className="fc-duel-pulse mx-4 sm:mx-5" aria-hidden="true" />
      )}

      <div className="px-4 py-4 sm:px-5">
        {loading && !state ? (
          <EduWait
            active
            line="Two views · same ledger"
            className="fc-edu-wait--block"
          />
        ) : (
          <>
          {manualTeach && (
            <EduWait
              active={manualTeach}
              line="Two views · same ledger"
              className="mb-3"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              key={`see-${reactKey}`}
              className={`fc-pane--see p-4 sm:p-5 ${reacting ? 'fc-pane--react' : ''}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
                  You see it
                </h3>
                <span className="ml-auto border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
                  Visible
                </span>
              </div>
              {op?.error ? (
                <p className="text-xs text-[var(--color-breach)]">{op.error}</p>
              ) : (
                <>
                  <div className="mb-3 flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Stake</div>
                      <div
                        className="mt-0.5 font-mono text-xl font-medium leading-tight text-[var(--color-accent)] tabular-nums sm:text-2xl"
                        title={summary?.stake != null ? String(summary.stake) : undefined}
                      >
                        {formatStake(summary?.stake) ?? (op?.openCount || op?.settledCount ? '·' : '—')}
                      </div>
                    </div>
                    <div className="w-14 shrink-0 text-right sm:w-16">
                      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Side</div>
                      <div className="mt-0.5 font-mono text-xl font-medium leading-tight text-[var(--color-sealed)] sm:text-2xl">
                        {formatSide(summary?.side) ?? (op?.openCount || op?.settledCount ? '·' : '—')}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Open{' '}
                    <span className="text-[var(--color-accent)] tabular-nums">
                      <TweenNumber value={op?.openCount ?? 0} duration={400} format={(v) => String(Math.round(v))} />
                    </span>
                    {' · '}Settled{' '}
                    <span className="text-[var(--color-sealed)] tabular-nums">
                      <TweenNumber value={op?.settledCount ?? 0} duration={400} format={(v) => String(Math.round(v))} />
                    </span>
                  </p>
                  {!op?.sample && (
                    <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                      No open position — stage one in the{' '}
                      <a href="/labs/canton" className="underline underline-offset-2 hover:text-[var(--color-ink)]">ops console</a>.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-2.5 sm:hidden" aria-hidden="true">
              <span className="h-px w-10 bg-[var(--color-rule)]" />
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">same ledger</span>
              <span className="h-px w-10 bg-[var(--color-rule)]" />
            </div>

            <div
              key={`blind-${reactKey}`}
              className={`fc-pane--blind p-4 sm:p-5 ${reacting ? 'fc-pane--react' : ''}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <EyeOff className="h-4 w-4 text-[var(--color-breach)]/80" />
                <h3 className="font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
                  They don&rsquo;t
                </h3>
                <span className="ml-auto border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-breach)]">
                  {obs?.refused ? 'Refused' : 'Empty'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Stake</div>
                  <div className="mt-0.5 font-mono text-2xl font-medium text-[var(--color-breach)]/50">—</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Side</div>
                  <div className="mt-0.5 font-mono text-2xl font-medium text-[var(--color-breach)]/50">—</div>
                </div>
              </div>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {obs?.refused
                  ? 'Ledger refused the read — not a stakeholder.'
                  : `${obs?.count ?? 0} positions visible.`}
              </p>
              <p className="mt-1 text-[10px] text-[var(--color-ink-faint)]">
                Party: {state?.observerIsConfigured ? state.observerPartyName : 'ExternalObserver'}
              </p>
            </div>
          </div>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mc-rule)] pt-3">
          <p className="text-[10px] text-[var(--color-ink-faint)]">
            Same ledger. Protocol privacy — not a UI filter.
          </p>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            {showRaw ? 'Hide raw ledger' : 'Raw ledger'}
          </button>
        </div>

        {showRaw && state && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 fc-view-swap">
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all bg-[var(--color-paper-deep)] p-2 font-mono text-[10px] leading-4 text-[var(--color-ink-muted)]">
              {op?.sample ? previewJson(op.sample) : '[]'}
            </pre>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all bg-[var(--color-paper-deep)] p-2 font-mono text-[10px] leading-4 text-[var(--color-ink-faint)]">
              {obs?.refused ? (obs.error || 'query refused') : previewJson(obs?.positions ?? [])}
            </pre>
          </div>
        )}

        <TalkToUs source="privacy" />
      </div>
    </section>
  );
}
