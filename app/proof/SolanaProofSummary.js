'use client';

import Link from 'next/link';
import { ArrowRight, Fingerprint, ShieldCheck, FileCheck } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';

/**
 * Solana proof summary — the chain-agnostic entry into the Solana-anchored
 * receipt browser. The full fixture browser (sealed evidence, Merkle proof
 * walkthrough, TxLINE anchoring) lives at /world-cup; this card surfaces the
 * canonical receipt and routes the viewer there.
 *
 * Chain badge: ◎ Solana — proof anchored via TxLINE-Merkle on Solana devnet.
 */
const CANONICAL = {
  fixtureId: '18175981',
  home: 'France',
  away: 'Sweden',
  score: '3–0',
  stage: 'World Cup · Round of 32',
  settlementTx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};

const STAGES = [
  { label: 'Mandate', value: 'v1' },
  { label: 'Decision', value: 'ALLOCATE' },
  { label: 'Sealed', value: 'SHA-256' },
  { label: 'Reconciled', value: 'TxLINE' },
];

export default function SolanaProofSummary() {
  return (
    <div className="space-y-10">
      <Reveal as="section" className="platform-open-section" aria-label="Solana receipt proof">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
              <span className="mc-kicker">Solana receipt · archived</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-ink-faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              ◎ Solana · TxLINE-Merkle
            </span>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            {CANONICAL.stage}
          </p>
          <p className="mt-1.5 font-display text-xl font-semibold text-[var(--color-ink)] sm:text-2xl">
            {CANONICAL.home} <span className="text-[var(--color-ink-faint)]">v</span> {CANONICAL.away}
          </p>
          <p className="mt-1 font-mono text-sm text-[var(--color-accent)]">
            Final {CANONICAL.score}
          </p>

          {/* 4-stage proof chain — compact */}
          <div className="mt-5 flex items-stretch gap-1 overflow-x-auto pb-1">
            {STAGES.map((s, i) => (
              <div key={s.label} className="flex flex-1 items-stretch">
                <div className="flex min-w-[80px] flex-1 flex-col items-center gap-1 border border-[var(--color-rule)] bg-white/[0.02] p-3 text-center">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">{s.label}</span>
                  <span className="font-display text-sm font-bold text-[var(--color-ink)]">{s.value}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="flex items-center px-0.5" aria-hidden>
                    <ArrowRight className="h-3 w-3 text-[var(--color-ink-faint)]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-[var(--color-ink-faint)]">
            The agent&rsquo;s rules, its bet, and its reasoning are fingerprinted and locked before the
            match is played — a 0.1 SOL escrow policy on this fixture settled trustlessly via{' '}
            <span className="font-mono text-[var(--color-ink-muted)]">match-escrow</span> CPI. The record
            can&rsquo;t be rewritten after the fact.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-rule)] pt-4">
            <Link
              href={`/world-cup?fixture=${CANONICAL.fixtureId}`}
              className="mc-action inline-flex items-center gap-1.5"
            >
              <Fingerprint className="h-3.5 w-3.5" />
              Open the full receipt browser
              <ArrowRight className="h-3 w-3" />
            </Link>
            <a
              href={`https://explorer.solana.com/tx/${CANONICAL.settlementTx}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="mc-nav-link no-underline inline-flex items-center gap-1.5 px-3 py-2 text-xs"
            >
              <FileCheck className="h-3 w-3" />
              Settlement tx on devnet
            </a>
          </div>
        </div>
      </Reveal>

      <p className="text-center text-[11px] leading-5 text-[var(--color-ink-faint)]">
        The full Solana receipt browser — sealed evidence, seeded simulation, versioned policy gates,
        and the TxLINE-Merkle anchor walkthrough — lives at{' '}
        <Link href="/world-cup" className="text-[var(--color-ink-muted)] underline decoration-[var(--color-rule-strong)] underline-offset-2 hover:text-[var(--color-ink)]">/world-cup</Link>.
      </p>
    </div>
  );
}
