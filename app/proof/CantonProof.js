'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, Eye, EyeOff, Zap } from 'lucide-react';
import PrivacyProof from '@/components/PrivacyProof';
import useChangeFlash from '@/hooks/useChangeFlash';

/**
 * Canton proof module — the live, atomic-settlement evidence surface.
 *
 * Lives inside /proof (Proof Theatre) rather than at /canton, so Canton
 * proof sits beside its Solana peer under one chain-agnostic audit trail.
 * The operator console (create/resolve/settle) does NOT live here — it moved
 * to /labs as ops tooling. This module is proof, not operation.
 *
 * Three live signals, auto-refreshing every 15s:
 *  - health dot (is the devnet live)
 *  - operator balances (unlocked / locked) — conservation invariant
 *  - escrow surface (empty = clean atomic settlement, no outstanding legs)
 * Plus the dual-party privacy proof below (the binary demo).
 */

function formatNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toLocaleString();
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
    } catch (err) {
      setError(err.message);
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
    <div className="space-y-10">
      <section aria-labelledby="canton-proof-story" className="border-y border-[var(--color-rule)] py-5 sm:py-7">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="bg-[var(--color-accent)]/5 p-4">
            <Eye className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-accent)]">Stakeholder</p>
            <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">Position visible</p>
          </div>
          <ArrowDown className="mx-auto h-4 w-4 text-[var(--color-ink-faint)] sm:-rotate-90" aria-hidden="true" />
          <div className="p-2 text-center">
            <p className="mc-kicker" id="canton-proof-story">Same Canton ledger</p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-ink-muted)]">Two live queries. Privacy enforced by the contract, not the interface.</p>
          </div>
          <ArrowDown className="mx-auto h-4 w-4 text-[var(--color-ink-faint)] sm:-rotate-90" aria-hidden="true" />
          <div className="bg-white/[0.02] p-4">
            <EyeOff className="h-4 w-4 text-[var(--color-ink-faint)]" aria-hidden="true" />
            <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">Non-signatory</p>
            <p className="mt-1 font-display text-lg font-semibold text-[var(--color-ink)]">Nothing visible</p>
          </div>
        </div>
      </section>

      {/* The binary privacy contrast is the pitch, so it appears before
          supporting balance and escrow telemetry. */}
      <PrivacyProof />

      {/* Ledger state — live, the conservation invariant + escrow surface */}
      <section className="platform-open-section" aria-label="Canton ledger state">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
              <span className="mc-kicker">Canton ledger state · live</span>
            </div>
            <HealthDot status={health.status} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 sm:px-5">
            <p className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/10 p-2 text-[11px] text-[var(--color-breach)]">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-4">
          <LedgerCell label="Operator unlocked" value={formatNum(balance?.unlocked)} accent />
          <LedgerCell label="Operator locked" value={formatNum(balance?.lockedInEscrow)} />
          <LedgerCell label="Escrow legs" value={escrowCount} accent={escrowCount > 0} />
          <LedgerCell label="Active allocations" value={activeAllocations} accent={activeAllocations > 0} />
        </div>

        <div className="px-4 py-3 sm:px-5">
          <p className="text-[11px] leading-5 text-[var(--color-ink-faint)]">
            {clean ? (
              <span className="text-[var(--color-accent)]">Escrow empty — no outstanding legs.</span>
            ) : (
              <span>Escrow holds locked CIP-56 allocations awaiting settlement.</span>
            )}
            {' '}Funds move inside the Settle transaction — no manual payout, no obligations outstanding. See{' '}
            <a href="https://github.com/thisyearnofear/fourcast/blob/main/docs/CANTON_ATOMIC_SETTLEMENT.md" target="_blank" rel="noreferrer" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">atomic-settlement model ↗</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
