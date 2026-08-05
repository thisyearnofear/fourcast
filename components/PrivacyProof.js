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

/**
 * One line each — Alice takes the position; Bob queries the same contract
 * as a non-signatory. Names come from real configured parties when known.
 */
function actBeats(holderName, outsiderName) {
  const holder = holderName || 'the holder';
  const outsider = outsiderName || 'everyone else';
  return [
    { id: 1, label: `As ${holderName || 'you'}`, line: `Ask the ledger as ${holder} — the position holder…` },
    { id: 2, label: `As ${outsiderName || 'the book'}`, line: `Ask the same contract as ${outsider} — not a signatory…` },
    { id: 3, label: 'Compare', line: 'Same market. Two answers.' },
  ];
}

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

export default function PrivacyProof({ present = false, flow = 'auto' }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [reactKey, setReactKey] = useState(0);
  /** 0 = idle; 1–3 = act beats; 4 = curtain / verdict */
  const [actBeat, setActBeat] = useState(0);
  const [verdict, setVerdict] = useState(null);
  // Present mode starts sealed: data preloads invisibly, the visual answer
  // stays shut until "Run the check" is pressed.
  const [reveal, setReveal] = useState(() => (present ? { see: false, blind: false } : { see: true, blind: true }));
  /** Raw ledger / Talk to us stay muted until the duel lands. */
  const [chromeOpen, setChromeOpen] = useState(false);
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
      holderPartyName,
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
      holderPartyName,
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
      line = holderPartyName && observerPartyName
        ? `Same market. ${holderPartyName}'s size stays private — ${observerPartyName} sees nothing.`
        : 'Same market. Your size stays private — the public book sees nothing.';
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
    /** The holder seat asks as Alice (a configured holder party) — never the
     * operator — so the names on screen are honest. Falls back to the API's
     * operator default only when no holder party is configured. */
    let holderPartyId = null;
    let holderPartyName = null;
    try {
      const partiesRes = await fetch('/api/canton/parties');
      const partiesData = await partiesRes.json();
      const partiesList = partiesData.parties || [];
      const observer = partiesList.find((p) => p.role === 'observer')
        || partiesList.find((p) => p.name === 'Bob');
      observerPartyId = observer?.id || null;
      observerPartyName = observer?.name || null;
      observerIsConfigured = !!observerPartyId;
      const holder = partiesList.find((p) => p.role === 'holder' && p.name === 'Alice')
        || partiesList.find((p) => p.role === 'holder');
      holderPartyId = holder?.id || null;
      holderPartyName = holder?.name || null;
    } catch {
      /* fall through */
    }
    if (!observerPartyId) {
      observerPartyId = 'ExternalObserver::1220non-signatory-demo-party';
    }

    // Holder seat first: the outsider query must target the SAME contract
    // type the holder pane displays, or the duel compares different state.
    const holderParam = holderPartyId ? `&partyId=${encodeURIComponent(holderPartyId)}` : '';
    const [openRes, settledRes] = await Promise.allSettled([
      fetch(`/api/canton/positions?type=open${holderParam}`),
      fetch(`/api/canton/positions?type=settled${holderParam}`),
    ]);

    const read = (r) =>
      r.status === 'fulfilled' && r.value.ok ? r.value.json().catch(() => null) : null;

    const [openData, settledData] = await Promise.all([read(openRes), read(settledRes)]);

    // Duel type: open when a live position exists, otherwise the settled
    // receipt (mirrors the holder sample fallback open→settled).
    const settledCount = settledData?.count ?? settledData?.positions?.length ?? 0;
    const openCountRaw = openData?.count ?? openData?.positions?.length ?? 0;
    const duelType = openCountRaw > 0 ? 'open' : settledCount > 0 ? 'settled' : 'open';

    const observerRes = await fetch(
      `/api/canton/positions?type=${duelType}&partyId=${encodeURIComponent(observerPartyId)}`,
    )
      .then((res) => ({ status: 'fulfilled', value: res }))
      .catch((reason) => ({ status: 'rejected', reason }));
    const observerData = await read(observerRes);

    return {
      openData,
      settledData,
      observerData,
      openRes,
      observerRes,
      duelType,
      observerPartyId,
      observerPartyName,
      observerIsConfigured,
      holderPartyName,
    };
  }, []);

  const runQuery = useCallback(async ({ manual = false } = {}) => {
    if (manual) {
      if (busyRef.current) return;
      busyRef.current = true;
      setRefreshing(true);
      setVerdict(null);
      setChromeOpen(false);
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
        await sleep(780);
        if (!mountedRef.current) return;
        setActBeat(2);
        await sleep(900);
        if (!mountedRef.current) return;
        setActBeat(3);
        await sleep(620);
      }

      const payload = await ledgerPromise;
      if (!mountedRef.current) return;

      const result = applyLedgerResult(payload, { manual });
      setRefreshing(false);

      if (!manual) {
        if (!present) {
          setReveal({ see: true, blind: true });
          setChromeOpen(true);
        }
        return;
      }

      // Curtain: holder pops hard; blind stays empty longer; then wipe.
      setReactKey((k) => k + 1);
      setActBeat(4);
      setReveal({ see: true, blind: false });
      await sleep(720);
      if (!mountedRef.current) return;
      setReveal({ see: true, blind: true });
      await sleep(520);
      if (!mountedRef.current) return;

      setVerdict({ tone: result.tone, line: result.line });
      setActBeat(0);
      setChromeOpen(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('fc:privacy-verdict', { detail: { tone: result.tone } }),
        );
      }
      verdictTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setVerdict(null);
      }, 12000);
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
  const holderName = state?.holderPartyName || null;
  const outsiderName = state?.observerPartyName || null;
  const beats = actBeats(holderName, outsiderName);
  const reacting = reactKey > 0 && actBeat === 0;
  const inAct = actBeat > 0;
  const currentBeat = beats.find((b) => b.id === actBeat) || null;
  /** Present staging: question + trigger only until the first click. */
  const sealed = present && !inAct && !verdict && !reveal.see && !reveal.blind;
  /** Present preflight: no position staged → keep the trigger disarmed. */
  const missingDuel = present && !!state && !summary && !op?.openCount && !op?.settledCount;

  return (
    <section className="platform-open-section fc-life-stage" aria-label="Privacy check">
      {!present && (
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="mc-lamp mc-lamp--live" aria-hidden="true" />
              <Eye className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
              <span className="mc-kicker" id="privacy-proof-heading">The secret</span>
            </div>
            <p className="mt-1.5 font-display text-lg font-semibold leading-snug text-[var(--color-ink)] sm:text-xl">
              Ask the ledger twice. Only one seat answers.
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
      )}

      {reacting && (
        <div key={`duel-${reactKey}`} className="fc-duel-pulse mx-4 sm:mx-5" aria-hidden="true" />
      )}

      <div ref={duelRef} className="px-4 py-4 sm:px-5">
        {/* Present mode: one narrator line while the act plays. */}
        {present && inAct && currentBeat && (
          <p className="fc-privacy-act__line mb-4" aria-live="polite">
            {currentBeat.line}
          </p>
        )}

        {/* Act rail — three beats, one active line */}
        {!present && (inAct || verdict) && (
          <div className="fc-privacy-act mb-4" aria-live="polite">
            <div className="fc-privacy-act__rail" role="list">
              {beats.map((b) => (
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
              <div className="mt-3 space-y-2">
                <div
                  className={`fc-privacy-verdict ${
                    verdict.tone === 'ok' ? 'fc-privacy-verdict--ok' : 'fc-privacy-verdict--warn'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <p>{verdict.line}</p>
                </div>
                {verdict.tone === 'ok' && (
                  <button
                    type="button"
                    onClick={() => {
                      // Cancel any scheduled Hide→Lock→Paid auto-scroll.
                      window.dispatchEvent(new CustomEvent('fc:privacy-jump'));
                      document.getElementById('settled-cbtc')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                    className="fc-action fc-action--pulse w-full px-3 py-2 text-xs sm:w-auto"
                  >
                    See CBTC settlement →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {sealed ? (
          <div className="fc-present-seal" role="group" aria-label="Privacy check staged — run on cue">
            <p className="mc-kicker">Same market</p>
            <p className="fc-present-seal__line">Ask the ledger twice.</p>
            <Ripple
              options={{
                amplitude: 0.32,
                refraction: 55,
                shine: 0.4,
                dispersion: 0.28,
                decay: 1.35,
                wavelength: 70,
              }}
              style={{ display: 'inline-block' }}
            >
              <button
                type="button"
                onClick={() => runQuery({ manual: true })}
                disabled={refreshing || inAct || (loading && !state) || missingDuel}
                className="fc-action mc-action--primary fc-action--pulse inline-flex items-center gap-2 px-6 py-3 text-sm disabled:animate-none disabled:opacity-40 sm:text-base"
                aria-label="Run the privacy check"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing || inAct ? 'animate-spin' : ''}`} />
                {inAct || refreshing ? 'Running…' : 'Run the check'}
              </button>
            </Ripple>
            {loading && !state && (
              <p className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                warming the ledger…
              </p>
            )}
            {missingDuel && (
              <p className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                Pinned proof unavailable — reload before recording.
              </p>
            )}
          </div>
        ) : loading && !state ? (
          <p className="fc-edu-wait fc-edu-wait--block text-xs text-[var(--color-ink-muted)]" role="status">
            <span className="mc-lamp mc-lamp--live shrink-0" aria-hidden="true" />
            Loading two ledger seats…
          </p>
        ) : (
          <div className={`fc-privacy-duel grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch ${inAct ? 'fc-privacy-duel--acting' : ''} ${reacting ? 'fc-privacy-duel--curtain' : ''}`}>
            <div
              key={reactKey > 0 ? `see-${reactKey}` : 'see'}
              className={`fc-pane--see fc-privacy-clip p-5 sm:p-6 ${
                reveal.see ? 'fc-privacy-pane--in' : 'fc-privacy-pane--out'
              } ${reacting ? 'fc-pane--react' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-[var(--color-accent)]" />
                <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
                  YOU SEE IT
                </h3>
                <span className="ml-auto border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
                  {holderName ? `${holderName} · Position holder` : 'Holder'}
                </span>
              </div>
              <p className="mb-4 text-[11px] leading-4 text-[var(--color-ink-faint)]">
                {holderName ? `${holderName}'s seat — stake and side, as a signatory.` : 'Your seat — stake and side.'}
              </p>
              {op?.error ? (
                <p className="text-xs text-[var(--color-breach)]">{op.error}</p>
              ) : (
                <>
                  <div className="mb-4 flex items-start gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Stake</div>
                      <div
                        className="mt-1 font-mono text-3xl font-medium leading-none text-[var(--color-accent)] tabular-nums sm:text-4xl"
                        title={summary?.stake != null ? String(summary.stake) : undefined}
                      >
                        {formatStake(summary?.stake) ?? (op?.openCount || op?.settledCount ? '·' : '—')}
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right sm:w-20">
                      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Side</div>
                      <div className="mt-1 font-mono text-3xl font-medium leading-none text-[var(--color-sealed)] sm:text-4xl">
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
                  {!op?.sample && !present && (
                    <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                      No open position staged —{' '}
                      <a href="/labs/canton" className="underline underline-offset-2 hover:text-[var(--color-ink)]">ops console</a>
                      {' '}can place one for the demo.
                    </p>
                  )}
                  {!op?.sample && present && (
                    <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                      Pinned proof unavailable — reload before recording.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="fc-privacy-vs hidden sm:flex" aria-hidden="true">
              <span className="fc-privacy-vs__rule" />
              <span className="fc-privacy-vs__label">{inAct || reacting ? 'gotcha' : 'same market'}</span>
              <span className="fc-privacy-vs__rule" />
            </div>

            <div className="flex items-center justify-center gap-2.5 sm:hidden" aria-hidden="true">
              <span className="h-px w-10 bg-[var(--color-rule)]" />
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                {inAct || reacting ? 'gotcha' : 'same market'}
              </span>
              <span className="h-px w-10 bg-[var(--color-rule)]" />
            </div>

            <div
              key={reactKey > 0 ? `blind-${reactKey}` : 'blind'}
              className={`fc-pane--blind fc-privacy-clip p-5 sm:p-6 ${
                reveal.blind ? 'fc-privacy-pane--in' : 'fc-privacy-pane--out'
              } ${reacting ? 'fc-pane--react' : ''} ${!reveal.blind && inAct ? 'fc-privacy-blind--hold' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <EyeOff className="h-4 w-4 text-[var(--color-breach)]/80" />
                <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
                  THE BOOK DOESN&rsquo;T
                </h3>
                <span className="ml-auto border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-breach)]">
                  {obs?.refused ? 'Blocked' : outsiderName ? `${outsiderName} · Not a signatory` : 'Blind'}
                </span>
              </div>
              <p className="mb-4 text-[11px] leading-4 text-[var(--color-ink-faint)]">
                {outsiderName
                  ? `${outsiderName} represents the public book — rivals, copy-traders, everyone outside the trade.`
                  : 'Rivals. Copy-traders. The tape.'}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Stake</div>
                  <div className="mt-1 font-mono text-3xl font-medium leading-none text-[var(--color-breach)]/45 sm:text-4xl">—</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Side</div>
                  <div className="mt-1 font-mono text-3xl font-medium leading-none text-[var(--color-breach)]/45 sm:text-4xl">—</div>
                </div>
              </div>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {obs?.refused
                  ? 'Ledger refused the read — not a signatory to the trade.'
                  : `Ledger returned no position visible to ${outsiderName || 'this seat'}.`}
              </p>
            </div>
          </div>
        )}

        {present && verdict && !inAct && (
          <div className="mt-5 space-y-3" aria-live="polite">
            <div
              className={`fc-privacy-verdict ${
                verdict.tone === 'ok' ? 'fc-privacy-verdict--ok' : 'fc-privacy-verdict--warn'
              }`}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>{verdict.line}</p>
            </div>
            {/* Automatic flow plays the timed Hide→Lock→Paid sequence with no
                competing controls; manual flow (?flow=manual) hands progression
                to the presenter. Never both at once. */}
            {flow === 'manual' && (
              <div className="flex flex-wrap items-center gap-3">
                {verdict.tone === 'ok' && (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('fc:privacy-jump'));
                      document.getElementById('settled-cbtc')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    }}
                    className="fc-action fc-action--pulse px-4 py-2 text-xs"
                  >
                    See CBTC settlement →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runQuery({ manual: true })}
                  className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
                >
                  Re-run the check
                </button>
              </div>
            )}
          </div>
        )}

        {!present && (
        <div
          className={`fc-privacy-chrome mt-3 border-t border-[var(--mc-rule)] pt-3 transition-opacity duration-500 ${
            chromeOpen || (!inAct && !reacting && !!state) ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-[var(--color-ink-faint)]">
              Protocol privacy — enforced by the ledger's party model, not by trusting an operator's database.
            </p>
            {(chromeOpen || !!verdict) && (
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
              >
                {showRaw ? 'Hide raw ledger' : 'Raw ledger'}
              </button>
            )}
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

          {(chromeOpen || !!verdict) && <TalkToUs source="privacy" />}
        </div>
        )}
      </div>
    </section>
  );
}
