'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Zap } from 'lucide-react';
import Ripple from '@/components/canvasui/Ripple';
import TweenNumber from '@/components/motion/TweenNumber';
import TalkToUs from '@/components/TalkToUs';

/**
 * PrivacyProof — theatrical dual-view privacy check for prediction-market users.
 *
 * Manual "Run the check" plays a short 3-beat act:
 *   1 ask as holder → 2 ask as the public book → 3 punchline
 * Quiet polls refresh data without remounting the duel.
 */

const POLL_MS = 10_000;

/** One line each — PM voice, not protocol jargon. */
const ACT_BEATS = [
  { id: 1, label: 'As you', line: 'Ask the ledger as the holder…' },
  { id: 2, label: 'As the book', line: 'Ask again as everyone else…' },
  { id: 3, label: 'Compare', line: 'Same market. Two answers.' },
];

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

function formatStake(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const s = String(value);
    return s.length > 12 ? `${s.slice(0, 10)}…` : s;
  }
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const fixed = n.toFixed(6).replace(/\.?0+$/, '');
  return fixed || '0';
}

function formatSide(value) {
  if (value == null || value === '') return null;
  const s = String(value);
  if (/^(yes|no)$/i.test(s)) return s.toUpperCase() === 'YES' ? 'Yes' : 'No';
  return s.length > 10 ? `${s.slice(0, 8)}…` : s;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function PrivacyProof() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [reactKey, setReactKey] = useState(0);
  /** 0 = idle; 1–3 = act beats; 4 = curtain / verdict */
  const [actBeat, setActBeat] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [reveal, setReveal] = useState({ see: true, blind: true });
  const mountedRef = useRef(true);
  const duelRef = useRef(null);
  const verdictTimerRef = useRef(null);
  /** Prevent quiet polls from overlapping a manual act. */
  const busyRef = useRef(false);

  const applyLedgerResult = useCallback((payload, { manual = false } = {}) => {
    const {
      openData,
      settledData,
      observerData,
      openRes,
      observerRes,
      observerPartyId,
      observerPartyName,
      observerIsConfigured,
    } = payload;

    const operatorOpen = openData?.positions || [];
    const operatorSettled = settledData?.positions || [];
    const observerOk = observerData?.success === true;
    const observerErr = observerData?.error || null;
    const sample = operatorOpen[0]?.payload || operatorSettled[0]?.payload || null;
    const nextSummary = extractPositionSummary(sample);
    const opError = openData?.success === false ? openData.error : null;
    const openCount = openData?.count ?? operatorOpen.length;
    const settledCount = settledData?.count ?? operatorSettled.length;
    const observerCount = observerOk ? (observerData.count ?? observerData.positions?.length ?? 0) : 0;
    const outsiderBlind = !observerOk || observerCount === 0;
    const fetchFailed =
      (openRes.status === 'fulfilled' && !openRes.value.ok) ||
      (observerRes.status === 'fulfilled' && !observerRes.value.ok) ||
      openData == null;

    setState({
      operator: {
        openCount,
        settledCount,
        sample,
        summary: nextSummary,
        error: opError,
      },
      observer: {
        refused: !observerOk,
        error: observerErr,
        count: observerCount,
        positions: observerOk ? observerData.positions || [] : [],
      },
      observerPartyId,
      observerPartyName,
      observerIsConfigured,
    });
    setLastUpdated(new Date());
    setLoading(false);

    if (!manual) return { fetchFailed, opError, outsiderBlind, openCount, settledCount, sample };

    let line;
    let tone = 'ok';
    if (fetchFailed || opError) {
      tone = 'warn';
      line = opError
        ? `Ledger error — ${opError}`
        : 'Could not reach Canton DevNet — try again in a moment.';
    } else if (outsiderBlind && (openCount > 0 || settledCount > 0 || sample)) {
      line = 'Same market. Your size stays private — the public book sees nothing.';
    } else if (outsiderBlind) {
      line = 'Public book is empty. Stakeholder side blank? Stage a position in ops.';
    } else {
      tone = 'warn';
      line = 'Public book still saw data — observer party may be misconfigured.';
    }
    return { fetchFailed, opError, outsiderBlind, openCount, settledCount, sample, tone, line };
  }, []);

  const fetchLedger = useCallback(async () => {
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

    return {
      openData,
      settledData,
      observerData,
      openRes,
      observerRes,
      observerPartyId,
      observerPartyName,
      observerIsConfigured,
    };
  }, []);

  const runQuery = useCallback(async ({ manual = false } = {}) => {
    if (manual) {
      if (busyRef.current) return;
      busyRef.current = true;
      setRefreshing(true);
      setVerdict(null);
      setReveal({ see: false, blind: false });
      setActBeat(1);
      if (verdictTimerRef.current) {
        window.clearTimeout(verdictTimerRef.current);
        verdictTimerRef.current = null;
      }
      duelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Fetch in parallel with the act so we never wait on theater alone.
    const ledgerPromise = fetchLedger();

    try {
      if (manual) {
        await sleep(650);
        if (!mountedRef.current) return;
        setActBeat(2);
        await sleep(700);
        if (!mountedRef.current) return;
        setActBeat(3);
        await sleep(550);
      }

      const payload = await ledgerPromise;
      if (!mountedRef.current) return;

      const result = applyLedgerResult(payload, { manual });
      setRefreshing(false);

      if (!manual) {
        setReveal({ see: true, blind: true });
        return;
      }

      // Curtain: holder pane, then public book, then punchline stamp.
      setReactKey((k) => k + 1);
      setActBeat(4);
      setReveal({ see: true, blind: false });
      await sleep(420);
      if (!mountedRef.current) return;
      setReveal({ see: true, blind: true });
      await sleep(380);
      if (!mountedRef.current) return;

      setVerdict({ tone: result.tone, line: result.line });
      setActBeat(0);
      verdictTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setVerdict(null);
      }, 10000);
    } finally {
      if (manual) busyRef.current = false;
    }
  }, [applyLedgerResult, fetchLedger]);

  useEffect(() => {
    mountedRef.current = true;
    runQuery({ manual: false });
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (busyRef.current) return;
      runQuery({ manual: false });
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      if (verdictTimerRef.current) window.clearTimeout(verdictTimerRef.current);
    };
  }, [runQuery]);

  const op = state?.operator;
  const obs = state?.observer;
  const summary = op?.summary;
  const reacting = reactKey > 0 && actBeat === 0;
  const inAct = actBeat > 0;
  const currentBeat = ACT_BEATS.find((b) => b.id === actBeat) || null;

  return (
    <section className="platform-open-section fc-life-stage" aria-labelledby="privacy-proof-heading">
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
              <Eye className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
              <span className="mc-kicker" id="privacy-proof-heading">Privacy check · live</span>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-[var(--color-ink-muted)]">
              On a public book, size telegraphs. Here we ask the ledger twice — as you, then as the crowd.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-[var(--color-ink-faint)] tabular-nums">
              {loading || refreshing ? 'live query…' : formatTime(lastUpdated)}
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
                disabled={refreshing || inAct || (loading && !state)}
                className="fc-action mc-action--primary fc-action--pulse inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40 disabled:animate-none"
                aria-label="Run the privacy check"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing || inAct ? 'animate-spin' : ''}`} />
                {inAct || refreshing ? 'Running…' : 'Run the check'}
              </button>
            </Ripple>
          </div>
        </div>
      </div>

      {reacting && (
        <div key={`duel-${reactKey}`} className="fc-duel-pulse mx-4 sm:mx-5" aria-hidden="true" />
      )}

      <div ref={duelRef} className="px-4 py-4 sm:px-5">
        {/* Act rail — three beats, one active line */}
        {(inAct || verdict) && (
          <div className="fc-privacy-act mb-4" aria-live="polite">
            <div className="fc-privacy-act__rail" role="list">
              {ACT_BEATS.map((b) => (
                <span
                  key={b.id}
                  role="listitem"
                  className={`fc-privacy-act__step ${
                    actBeat === b.id ? 'is-active' : actBeat > b.id || (actBeat === 0 && verdict) ? 'is-done' : ''
                  }`}
                >
                  <span className="fc-privacy-act__num">{b.id}</span>
                  {b.label}
                </span>
              ))}
            </div>
            {currentBeat && (
              <p className="fc-privacy-act__line">{currentBeat.line}</p>
            )}
            {verdict && !inAct && (
              <div
                className={`fc-privacy-verdict mt-3 ${
                  verdict.tone === 'ok' ? 'fc-privacy-verdict--ok' : 'fc-privacy-verdict--warn'
                }`}
              >
                <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <p>{verdict.line}</p>
              </div>
            )}
          </div>
        )}

        {loading && !state ? (
          <p className="fc-edu-wait fc-edu-wait--block text-xs text-[var(--color-ink-muted)]" role="status">
            <span className="mc-lamp mc-lamp--live shrink-0" aria-hidden="true" />
            Loading two ledger seats…
          </p>
        ) : (
          <div className={`grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch ${inAct ? 'fc-privacy-duel--acting' : ''}`}>
            <div
              key={reactKey > 0 ? `see-${reactKey}` : 'see'}
              className={`fc-pane--see p-4 sm:p-5 ${
                reveal.see ? 'fc-privacy-pane--in' : 'fc-privacy-pane--out'
              } ${reacting ? 'fc-pane--react' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
                  You see it
                </h3>
                <span className="ml-auto border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
                  Holder
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-4 text-[var(--color-ink-faint)]">
                Your seat — stake and side, as on any book you trade.
              </p>
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
                      No open position staged —{' '}
                      <a href="/labs/canton" className="underline underline-offset-2 hover:text-[var(--color-ink)]">ops console</a>
                      {' '}can place one for the demo.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="fc-privacy-vs hidden sm:flex" aria-hidden="true">
              <span className="fc-privacy-vs__rule" />
              <span className="fc-privacy-vs__label">same market</span>
              <span className="fc-privacy-vs__rule" />
            </div>

            <div className="flex items-center justify-center gap-2.5 sm:hidden" aria-hidden="true">
              <span className="h-px w-10 bg-[var(--color-rule)]" />
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">same market</span>
              <span className="h-px w-10 bg-[var(--color-rule)]" />
            </div>

            <div
              key={reactKey > 0 ? `blind-${reactKey}` : 'blind'}
              className={`fc-pane--blind p-4 sm:p-5 ${
                reveal.blind ? 'fc-privacy-pane--in' : 'fc-privacy-pane--out'
              } ${reacting ? 'fc-pane--react' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <EyeOff className="h-4 w-4 text-[var(--color-breach)]/80" />
                <h3 className="font-display text-base font-semibold text-[var(--color-ink)] sm:text-lg">
                  The book doesn&rsquo;t
                </h3>
                <span className="ml-auto border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-breach)]">
                  {obs?.refused ? 'Blocked' : 'Blind'}
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-4 text-[var(--color-ink-faint)]">
                Everyone else — rivals, copy-traders, the tape.
              </p>
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
                  ? 'Ledger refused the read — not a party to the trade.'
                  : `${obs?.count ?? 0} positions on this seat.`}
              </p>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mc-rule)] pt-3">
          <p className="text-[10px] text-[var(--color-ink-faint)]">
            Protocol privacy — not a hidden UI. No wallet to watch.
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
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                Holder seat
              </p>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all bg-[var(--color-paper-deep)] p-2 font-mono text-[10px] leading-4 text-[var(--color-ink-muted)]">
                {op?.sample ? previewJson(op.sample) : '[]'}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">
                Public seat · {state?.observerIsConfigured ? state.observerPartyName : 'outsider'}
              </p>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all bg-[var(--color-paper-deep)] p-2 font-mono text-[10px] leading-4 text-[var(--color-ink-faint)]">
                {obs?.refused ? (obs.error || 'query refused') : previewJson(obs?.positions ?? [])}
              </pre>
            </div>
          </div>
        )}

        <TalkToUs source="privacy" />
      </div>
    </section>
  );
}
