'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileCheck, Zap } from 'lucide-react';
import PrivacyProof from '@/components/PrivacyProof';
import EduWait from '@/components/EduWait';
import useChangeFlash from '@/hooks/useChangeFlash';

/**
 * Canton proof — privacy check, ledger metrics, CBTC receipts.
 * Ops (create/resolve/settle) live at /labs/canton.
 */

function formatNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toLocaleString();
}

function trimMid(s, head = 18, tail = 10) {
  if (!s) return '—';
  const str = String(s);
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function LedgerCell({ label, value, accent }) {
  const flashing = useChangeFlash(value);
  return (
    <div className={`p-3 bg-[var(--color-paper)] ${flashing ? 'fc-tick' : ''}`}>
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">{label}</div>
      <div className={`text-lg font-light font-mono ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
        {value}
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

export default function CantonProof() {
  const [health, setHealth] = useState({ status: 'checking' });
  const [balance, setBalance] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [error, setError] = useState(null);
  const [ledgerReady, setLedgerReady] = useState(false);

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

  const escrowCount = escrow?.escrow?.length ?? 0;
  const activeAllocations = escrow?.activeAllocations ?? 0;
  const clean = escrow && escrowCount === 0 && activeAllocations === 0;

  return (
    <div className="space-y-6 fc-life-stage">
      {/* Story spine — judge path in three beats, no wallet required */}
      <div className="border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="mc-kicker">The proof in three beats</p>
            <ol className="mt-2 grid gap-2 text-xs leading-5 text-[var(--color-ink-muted)] sm:grid-cols-3">
              <li>
                <span className="font-mono text-[10px] text-[var(--color-accent)]">1</span>
                {' '}
                <span className="text-[var(--color-ink)]">Hide size</span>
                {' — '}ask the ledger as you, then as the book.
              </li>
              <li>
                <span className="font-mono text-[10px] text-[var(--color-accent)]">2</span>
                {' '}
                <span className="text-[var(--color-ink)]">See live escrow</span>
                {' — '}stake locked on DevNet right now.
              </li>
              <li>
                <span className="font-mono text-[10px] text-[var(--color-sealed)]">3</span>
                {' '}
                <span className="text-[var(--color-ink)]">Atomic CBTC</span>
                {' — '}real BitSafe settle, update id on-ledger.
              </li>
            </ol>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('settled-cbtc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="fc-action fc-action--pulse shrink-0 px-3 py-1.5 text-xs"
          >
            Jump to CBTC settle
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
          No wallet to watch this page. Economics proven on DevNet + pinned CBTC receipt. Holder-signed settle when a gateway is available.
        </p>
      </div>

      <PrivacyProof />

      <section className="platform-open-section" aria-label="Ledger">
        <div className="border-b border-[var(--mc-rule)] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
                <span className="mc-kicker">Beat 2 · live escrow</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
                Same DevNet the privacy check just queried — value locked until settle.
              </p>
            </div>
            <HealthDot status={health.status} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 sm:px-5">
            <p className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/10 p-2 text-[11px] text-[var(--color-breach)]">{error}</p>
          </div>
        )}

        {!ledgerReady ? (
          <EduWait
            active
            line="Reading live DevNet state"
            className="fc-edu-wait--block"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-4">
              <LedgerCell label="Unlocked" value={formatNum(balance?.unlocked)} accent />
              <LedgerCell label="Locked" value={formatNum(balance?.lockedInEscrow)} />
              <LedgerCell label="Escrow legs" value={escrowCount} accent={escrowCount > 0} />
              <LedgerCell label="Allocations" value={activeAllocations} accent={activeAllocations > 0} />
            </div>

            <div className="px-4 py-2.5 sm:px-5">
              <p className="text-[11px] text-[var(--color-ink-faint)]">
                {clean ? (
                  <span className="text-[var(--color-accent)]">Escrow empty — settled clean.</span>
                ) : (
                  <span>Escrow awaiting settle.</span>
                )}
              </p>
            </div>
          </>
        )}
      </section>

      <ReceiptWall />
    </div>
  );
}

function ReceiptWall() {
  const [r, setR] = useState(null);
  const [showContracts, setShowContracts] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    fetch('/proof/canton-receipts.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setR(data); })
      .catch(() => {})
      .finally(() => setTried(true));
  }, []);

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

  const contractRows = [
    ['Market', r.contracts?.market],
    ['Offer', r.contracts?.offer],
    ['Position', r.contracts?.position],
    ['Attestation', r.contracts?.attestation],
    ['Resolution', r.contracts?.resolution],
  ].filter(([, v]) => v);

  return (
    <section id="settled-cbtc" className="platform-open-section fc-receipt-wall fc-settle-stamp scroll-mt-24" aria-label="Settled CBTC">
      <div className="border-b border-[var(--color-sealed)]/20 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-3.5 w-3.5 text-[var(--color-sealed)]" />
              <span className="mc-kicker" style={{ color: 'var(--color-sealed)' }}>Beat 3 · Settled · CBTC</span>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-ink)]">
              The money moved — stake cancelled, payout executed, same transaction. Real BitSafe CBTC on DevNet.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--color-sealed)]/80">
            {r.passed ? '✓ passed' : 'failures'} · {r.capturedAt ? new Date(r.capturedAt).toUTCString().slice(5, 22) : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-4">
        <div className="bg-[var(--color-paper)] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">Instrument</div>
          <div className="text-sm font-mono text-[var(--color-sealed)]">{r.instrument?.id || '—'}</div>
        </div>
        <LedgerCell label="Holder Δ" value={holderDelta != null ? `+${formatNum(holderDelta)}` : '—'} accent />
        <LedgerCell label="Operator Δ" value={opDelta != null ? formatNum(opDelta) : '—'} />
        <div className="bg-[var(--color-paper)] p-3 fc-live-rail">
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1 pl-2">Payout</div>
          <div className="pl-2 text-lg font-mono text-[var(--color-sealed)]">
            {r.receiptPayload?.payout != null ? formatNum(Number(r.receiptPayload.payout)) : '—'}
          </div>
        </div>
      </div>

      {r.settle?.updateId && (
        <div className="border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
          <p className="text-[11px] font-mono text-[var(--color-ink-muted)]">
            settle {trimMid(r.settle.updateId, 20, 14)}
            {r.settle.lane ? ` · ${r.settle.lane}` : ''}
          </p>
        </div>
      )}

      {Array.isArray(r.checks) && r.checks.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {r.checks.map(({ label, pass }) => (
              <div key={label} className={`text-[10px] font-mono ${pass ? 'text-[var(--color-accent)]' : 'text-[var(--color-breach)]'}`}>
                {pass ? '✓' : '✗'} {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {contractRows.length > 0 && (
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
