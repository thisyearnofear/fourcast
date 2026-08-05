'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCheck, Lock, Zap } from 'lucide-react';
import PrivacyProof from '@/components/PrivacyProof';
import EduWait from '@/components/EduWait';
import SealMoment from '@/components/motion/SealMoment';
import TweenNumber from '@/components/motion/TweenNumber';
import useChangeFlash from '@/hooks/useChangeFlash';

/**
 * Canton proof — felt arc: secret → locked → paid.
 * Ops (create/resolve/settle) live at /labs/canton.
 */

const BEATS = [
  { id: 1, target: 'beat-1', label: 'Hide', short: '1' },
  { id: 2, target: 'beat-2', label: 'Lock', short: '2' },
  { id: 3, target: 'settled-cbtc', label: 'Paid', short: '3' },
];

function formatNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toLocaleString();
}

function formatFixed1(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toFixed(1).replace(/\.0$/, '');
}

function trimMid(s, head = 18, tail = 10) {
  if (!s) return '—';
  const str = String(s);
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function scrollToBeat(target) {
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function WeightCell({ label, value, accent, pulse, decimals = 0 }) {
  const flashing = useChangeFlash(value);
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  const numeric = Number.isFinite(n);
  return (
    <div
      className={`fc-weight-cell p-4 sm:p-5 bg-[var(--color-paper)] ${flashing ? 'fc-tick' : ''} ${
        pulse ? 'fc-weight-cell--pulse' : ''
      } ${accent ? 'fc-weight-cell--accent' : ''}`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)] mb-2">{label}</div>
      <div
        className={`font-mono text-3xl font-light leading-none tabular-nums sm:text-4xl ${
          accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'
        }`}
      >
        {numeric ? (
          <TweenNumber
            value={n}
            duration={700}
            format={(v) => (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString())}
          />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function HealthDot({ status }) {
  const map = {
    healthy: 'bg-[var(--color-accent)]',
    unhealthy: 'bg-[var(--color-breach)]/70',
    error: 'bg-[var(--color-breach)]/70',
    checking: 'bg-white/30 animate-pulse',
  };
  const label = {
    healthy: 'Devnet live',
    unhealthy: 'Devnet unhealthy',
    error: 'Devnet unreachable',
    checking: 'Connecting…',
  };
  const cls = map[status] || map.checking;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-ink-faint)]">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {label[status] || status}
    </span>
  );
}

function BeatProgress({ active, completed }) {
  return (
    <nav className="fc-beat-rail" aria-label="Proof beats">
      {BEATS.map((b, i) => {
        const isActive = active === b.id;
        const isDone = completed.has(b.id) || active > b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => scrollToBeat(b.target)}
            className={`fc-beat-rail__step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="fc-beat-rail__num">{b.short}</span>
            <span className="fc-beat-rail__label">{b.label}</span>
            {i < BEATS.length - 1 && <span className="fc-beat-rail__join" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}

export default function CantonProof({ present = false, flow = 'auto' }) {
  const [health, setHealth] = useState({ status: 'checking' });
  const [balance, setBalance] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [error, setError] = useState(null);
  const [ledgerReady, setLedgerReady] = useState(false);
  const [activeBeat, setActiveBeat] = useState(1);
  const [completed, setCompleted] = useState(() => new Set());
  const scrollTimers = useRef([]);
  // Present mode pins the Lock beat to the settled lifecycle — the live
  // ledger legitimately reads 0/0 there because settle already cleared it.
  const [pinned, setPinned] = useState(null);
  const [pinnedTried, setPinnedTried] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, b, e] = await Promise.all([
        fetch('/api/canton/health').then((r) => r.json()).catch(() => null),
        fetch('/api/canton/balance').then((r) => r.json()).catch(() => null),
        fetch('/api/canton/settle-transfer').then((r) => r.json()).catch(() => null),
      ]);
      if (h) setHealth(h);
      if (b?.success) setBalance(b.canton?.balances || null);
      if (e?.success) setEscrow(e);
      setError(null);
      setLedgerReady(true);
    } catch (err) {
      setError(err.message);
      setLedgerReady(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!present) return undefined;
    let alive = true;
    fetch('/proof/canton-receipts.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) { setPinned(d); setPinnedTried(true); } })
      .catch(() => { if (alive) setPinnedTried(true); });
    return () => { alive = false; };
  }, [present]);

  // Sticky rail tracks scroll position across beats (retry until ReceiptWall mounts).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    let observer;
    const attach = () => {
      const nodes = BEATS.map((b) => document.getElementById(b.target)).filter(Boolean);
      if (nodes.length < 2) return false;
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (!visible[0]) return;
          const id = visible[0].target.id;
          const beat = BEATS.find((b) => b.target === id);
          if (beat) setActiveBeat(beat.id);
        },
        { rootMargin: '-20% 0px -45% 0px', threshold: [0.15, 0.4, 0.7] },
      );
      nodes.forEach((n) => observer.observe(n));
      return true;
    };
    if (attach()) return () => observer?.disconnect();
    const timer = window.setInterval(() => {
      if (attach()) window.clearInterval(timer);
    }, 400);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, [ledgerReady]);

  // Privacy check completion → mark beat 1 done, then (automatic flow only)
  // advance Lock then Paid on deterministic holds. Manual flow (?flow=manual)
  // leaves progression to the presenter; timers and buttons never coexist,
  // and a manual jump cancels any chain already scheduled.
  useEffect(() => {
    const clearScrollTimers = () => {
      scrollTimers.current.forEach((t) => window.clearTimeout(t));
      scrollTimers.current = [];
    };
    const holdPrivacy = present ? 3800 : 900;
    const holdEscrow = present ? 3000 : 1900;
    const onVerdict = (ev) => {
      const tone = ev.detail?.tone;
      setCompleted((prev) => new Set([...prev, 1]));
      clearScrollTimers();
      if (tone === 'ok') {
        setActiveBeat(2);
        if (flow === 'manual') return;
        scrollTimers.current.push(window.setTimeout(() => {
          scrollToBeat('beat-2');
        }, holdPrivacy));
        scrollTimers.current.push(window.setTimeout(() => {
          setCompleted((prev) => new Set([...prev, 1, 2]));
          setActiveBeat(3);
          scrollToBeat('settled-cbtc');
        }, holdPrivacy + holdEscrow));
      }
    };
    window.addEventListener('fc:privacy-verdict', onVerdict);
    window.addEventListener('fc:privacy-jump', clearScrollTimers);
    return () => {
      window.removeEventListener('fc:privacy-verdict', onVerdict);
      window.removeEventListener('fc:privacy-jump', clearScrollTimers);
      clearScrollTimers();
    };
  }, [present, flow]);

  const escrowCount = escrow?.escrow?.length ?? 0;
  const activeAllocations = escrow?.activeAllocations ?? 0;
  const locked = balance?.lockedInEscrow ?? 0;
  const clean = escrow && escrowCount === 0 && activeAllocations === 0;
  const weightPulse = !present && (escrowCount > 0 || locked > 0);

  // Pinned pre-settlement escrow: two legs — holder stake + operator payout
  // exposure — cleared atomically at settle (see dossier checks/deltas).
  const pinnedStake = pinned?.receiptPayload?.stake != null ? Number(pinned.receiptPayload.stake) : null;
  const pinnedLocked = pinned?.receiptPayload?.payout != null ? Number(pinned.receiptPayload.payout) : null;
  const showPinned = present && pinned != null && pinnedLocked != null;
  // Human name for the holder when the pinned party is Alice's demo party.
  const holderPossessive = pinned?.parties?.holder?.split('::')[0] === 'AliceHolder' ? "Alice's" : 'Holder';

  return (
    <div className="space-y-6 fc-life-stage">
      <BeatProgress active={activeBeat} completed={completed} />

      <div id="beat-1" className="fc-beat-section scroll-mt-28">
        <PrivacyProof present={present} flow={flow} />
      </div>

      <section
        id="beat-2"
        className="platform-open-section fc-beat-section fc-escrow-weight scroll-mt-28"
        aria-label="Live escrow"
      >
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {!present && (
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
                  <span className="mc-kicker">Locked on the ledger</span>
                </div>
              )}
              <p className={
                present
                  ? 'font-display text-lg font-semibold leading-snug text-[var(--color-ink)] sm:text-xl'
                  : 'mt-1.5 max-w-md text-sm text-[var(--color-ink)]'
              }>
                Stake is weight — not a UI toggle. Same DevNet. Value held until settle.
              </p>
            </div>
            {!present && <HealthDot status={health.status} />}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 sm:px-5">
            <p className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/10 p-2 text-[11px] text-[var(--color-breach)]">{error}</p>
          </div>
        )}

        {!ledgerReady || (present && !pinnedTried) ? (
          <EduWait
            active
            line={present ? 'Loading pinned settlement state' : 'Reading live DevNet state'}
            className="fc-edu-wait--block"
          />
        ) : showPinned ? (
          <>
            <div className="grid grid-cols-1 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-2">
              <WeightCell
                label="Escrow legs · at settlement"
                value={2}
                accent
                pulse={false}
              />
              <WeightCell
                label="CBTC locked · before atomic settle"
                value={pinnedLocked}
                decimals={1}
                accent
                pulse={false}
              />
            </div>
            <div className="px-4 py-3 sm:px-5">
              <p className="text-xs text-[var(--color-ink-muted)]">
                At settlement: {holderPossessive} {formatFixed1(pinnedStake)} stake + operator's{' '}
                {formatFixed1(pinnedLocked - (pinnedStake ?? 0))} exposure locked on-ledger —
                both legs cleared by one atomic transaction. Live escrow now reads 0 / 0.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-2">
              <WeightCell
                label="Escrow legs"
                value={escrowCount}
                accent={escrowCount > 0}
                pulse={weightPulse}
              />
              <WeightCell
                label="Locked"
                value={locked}
                accent={locked > 0}
                pulse={weightPulse}
              />
            </div>
            <div className="fc-escrow-muted grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-paper-soft)]">
              <div className="bg-[var(--color-paper)] px-4 py-2.5">
                <span className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Unlocked</span>
                <span className="ml-2 font-mono text-sm text-[var(--color-ink-muted)] tabular-nums">
                  {formatNum(balance?.unlocked)}
                </span>
              </div>
              <div className="bg-[var(--color-paper)] px-4 py-2.5">
                <span className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Allocations</span>
                <span className="ml-2 font-mono text-sm text-[var(--color-ink-muted)] tabular-nums">
                  {activeAllocations}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 sm:px-5">
              <p className="text-xs text-[var(--color-ink-muted)]">
                {clean ? (
                  <span className="text-[var(--color-accent)]">Escrow empty — settled clean.</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-[var(--color-sealed)]" aria-hidden />
                    Escrow awaiting settle — tension before the stamp.
                  </span>
                )}
              </p>
            </div>
          </>
        )}
      </section>

      <ReceiptWall present={present} onSeen={() => setCompleted((prev) => new Set([...prev, 1, 2, 3]))} />

      {/* Closing strip — trajectory, not features. Never auto-scrolled:
          Paid stays the climax; this is read only after. */}
      <section className="fc-next-strip" aria-label="Live today and what comes next">
        <div className="grid gap-6 border-t border-[var(--color-rule)] pt-7 sm:grid-cols-2">
          <div>
            <p className="mc-kicker">Live today</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              Private positions and atomic BitSafe CBTC settlement on Canton DevNet.
            </p>
          </div>
          <div>
            <p className="mc-kicker">Next</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              More attesters · Mainnet hardening · Holder-signed settlement when a CIP-0103 gateway is available.
            </p>
          </div>
        </div>
        <p className="mt-7 pb-2 text-center font-display text-base font-semibold tracking-tight text-[var(--color-ink)] sm:text-lg">
          Built for operators whose size is part of their strategy.
        </p>
      </section>
    </div>
  );
}

function ReceiptWall({ onSeen, present = false }) {
  const [r, setR] = useState(null);
  const [showContracts, setShowContracts] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [checksReady, setChecksReady] = useState(false);
  const [tried, setTried] = useState(false);
  const [stampIn, setStampIn] = useState(false);

  useEffect(() => {
    fetch('/proof/canton-receipts.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setR(data); })
      .catch(() => {})
      .finally(() => setTried(true));
  }, []);

  // Seal first; checklist control fades in later (stays collapsed for mute video).
  useEffect(() => {
    if (!r) return undefined;
    const node = document.getElementById('settled-cbtc');
    if (!node || typeof IntersectionObserver === 'undefined') {
      setStampIn(true);
      const t = window.setTimeout(() => setChecksReady(true), 1200);
      return () => window.clearTimeout(t);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStampIn(true);
          onSeen?.();
          window.setTimeout(() => setChecksReady(true), 1400);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [r, onSeen]);

  if (!tried && !r) {
    return (
      <EduWait
        active
        line="Loading CBTC settlement"
        className="fc-edu-wait--block"
      />
    );
  }

  if (!r) return null;

  const holderDelta = r.deltas?.holderUnlocked
    ? r.deltas.holderUnlocked.after - r.deltas.holderUnlocked.before : null;
  const opDelta = r.deltas?.operatorUnlocked
    ? r.deltas.operatorUnlocked.after - r.deltas.operatorUnlocked.before : null;
  const payout = r.receiptPayload?.payout != null ? Number(r.receiptPayload.payout) : null;
  const settleId = r.settle?.updateId || '';
  // Gross payout = holder stake returned + winnings (operator exposure).
  // Holder net == winnings; make the economics explicit on stage.
  const stakeAmt = r.receiptPayload?.stake != null ? Number(r.receiptPayload.stake) : null;
  const winningsAmt = payout != null && stakeAmt != null ? payout - stakeAmt : null;
  const holderLabel = r.parties?.holder?.split('::')[0] === 'AliceHolder' ? 'Alice' : 'Holder';

  const contractRows = [
    ['Market', r.contracts?.market],
    ['Offer', r.contracts?.offer],
    ['Position', r.contracts?.position],
    ['Attestation', r.contracts?.attestation],
    ['Resolution', r.contracts?.resolution],
  ].filter(([, v]) => v);

  return (
    <section
      id="settled-cbtc"
      className={`platform-open-section fc-receipt-wall fc-beat-section scroll-mt-28 ${
        stampIn ? 'fc-settle-stamp' : ''
      }`}
      aria-label="Settled CBTC"
    >
      {present ? (
        /* Climax: one number, one sponsor, one transaction. */
        <div className="fc-climax px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="fc-climax__amount font-mono tabular-nums">
            <span className="fc-climax__number">
              {stampIn && payout != null ? (
                <TweenNumber value={payout} duration={1100} format={(v) => v.toFixed(1)} />
              ) : (
                payout != null ? formatNum(payout) : '—'
              )}
            </span>
            <span className="fc-climax__unit">
              BITSAFE {r.instrument?.id || 'CBTC'}
            </span>
          </p>
          <p className="fc-climax__state">
            {r.passed ? 'PAID — ONE CANTON TRANSACTION' : 'SETTLEMENT RECORDED'}
          </p>
          <p className="fc-climax__detail">
            {formatFixed1(stakeAmt)} stake returned{' · '}{formatFixed1(winningsAmt)} winnings{' · '}
            {holderLabel}{' '}
            <span className="font-mono text-[var(--color-accent)]">
              {holderDelta != null ? `+${formatNum(holderDelta)}` : '—'} net
            </span>
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-[var(--color-sealed)]/20 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-3.5 w-3.5 text-[var(--color-sealed)]" />
                  <span className="mc-kicker" style={{ color: 'var(--color-sealed)' }}>The money moved</span>
                </div>
                <p className="mt-2 max-w-lg font-display text-xl font-semibold leading-tight text-[var(--color-ink)] sm:text-2xl">
                  Stake cancelled. Payout executed.
                  <span className="text-[var(--color-sealed)]"> Same transaction.</span>
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--color-sealed)]/80">
                {r.passed ? '✓ passed' : 'failures'} · {r.capturedAt ? new Date(r.capturedAt).toUTCString().slice(5, 22) : ''}
              </span>
            </div>
          </div>

          <div className="fc-cbtc-hero px-4 py-6 sm:px-6">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">Payout</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-5xl font-light leading-none text-[var(--color-sealed)] tabular-nums sm:text-6xl">
              {stampIn && payout != null ? (
                <TweenNumber value={payout} duration={900} format={(v) => v.toFixed(1)} />
              ) : (
                payout != null ? formatNum(payout) : '—'
              )}
              <span className="text-lg tracking-wide text-[var(--color-sealed)]/80 sm:text-xl">
                BitSafe {r.instrument?.id || 'CBTC'}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-ink-muted)]">
              <span>
                Holder{' '}
                <span className="font-mono text-[var(--color-accent)]">
                  {holderDelta != null ? `+${formatNum(holderDelta)}` : '—'}
                </span>
              </span>
              <span>
                Operator{' '}
                <span className="font-mono text-[var(--color-ink)]">
                  {opDelta != null ? formatNum(opDelta) : '—'}
                </span>
              </span>
            </div>
          </div>
        </>
      )}

      {settleId && (
        <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
          <SealMoment
            hash={settleId.replace(/^0x/i, '')}
            sealed={stampIn && !!r.passed}
            label={r.settle?.lane ? `settle · ${r.settle.lane}` : 'settle update'}
            prefix=""
            compact={false}
          />
        </div>
      )}

      {!present && Array.isArray(r.checks) && r.checks.length > 0 && checksReady && (
        <div className="fc-checks-reveal border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => setShowChecks((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            {showChecks ? 'Hide evidence' : 'Evidence checklist'}
          </button>
          {showChecks && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {r.checks.map(({ label, pass }) => (
                <div key={label} className={`text-[10px] font-mono ${pass ? 'text-[var(--color-accent)]' : 'text-[var(--color-breach)]'}`}>
                  {pass ? '✓' : '✗'} {label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!present && contractRows.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => setShowContracts((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            {showContracts ? 'Hide raw ledger' : 'Raw ledger'}
          </button>
          {showContracts && (
            <div className="mt-2 space-y-1">
              {contractRows.map(([label, cid]) => (
                <div key={label} className="flex items-center gap-2 text-[11px]">
                  <span className="w-28 shrink-0 text-[var(--color-ink-faint)]">{label}</span>
                  <span className="font-mono text-[10px] text-[var(--color-ink-muted)] truncate" title={cid}>{trimMid(cid)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
