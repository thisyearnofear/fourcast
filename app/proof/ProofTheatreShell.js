'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import CantonProof from './CantonProof';
import WorldCupClient from '@/app/world-cup/WorldCupClient';
import { BRAND } from '@/constants/brand';
import GlassPanel from '@/components/ui/GlassPanel';

/**
 * Private / Proof — chain-agnostic evidence surface.
 * Default: Canton. Solana receipts available via tab.
 * ?present=1 (Canton only): finals recording surface — no app chrome.
 * &flow=manual: presenter-driven progression instead of timed auto-advance.
 */
const CHAINS = [
  { id: 'canton', label: 'Canton', icon: '◈' },
  { id: 'solana', label: 'Solana', icon: '◎' },
];

/**
 * PresentShell — the stage. Identity, evidence, climax. Nothing else:
 * no nav, wallet, status, chain switcher, or footer (footer hidden via
 * body[data-fc-present] in global CSS while mounted).
 */
function PresentShell({ children }) {
  useEffect(() => {
    document.body.dataset.fcPresent = '1';
    return () => {
      delete document.body.dataset.fcPresent;
    };
  }, []);

  return (
    <div className="fc-present relative flex min-h-screen flex-col text-[var(--color-ink)]">
      <div className="platform-atmosphere" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 font-display text-sm text-[var(--color-accent)]">
            {BRAND.emoji}
          </span>
          <span className="font-display text-base tracking-tight">{BRAND.name}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
          Canton · BitSafe
        </span>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {children}
      </main>
      {/* Presenter-only escape hatch: invisible in recordings, appears on
          keyboard focus (Tab). Browser back also exits. */}
      <Link href="/proof?chain=canton" className="fc-present__exit">
        Exit present
      </Link>
    </div>
  );
}

export default function ProofTheatreShell() {
  const [chain, setChain] = useState('canton');
  /** null = URL not read yet; keeps first paint free of app chrome. */
  const [present, setPresent] = useState(null);
  const [flow, setFlow] = useState('auto');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setPresent(params.get('present') === '1');
    if (params.get('flow') === 'manual') setFlow('manual');
    const c = params.get('chain');
    if (c === 'solana' || c === 'canton') {
      setChain(c);
    } else if (params.get('fixture')) {
      setChain('solana');
    }
  }, []);

  const selectChain = (nextChain) => {
    setChain(nextChain);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('chain', nextChain);
    if (nextChain === 'canton') url.searchParams.delete('fixture');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const isCanton = chain === 'canton';

  if (present === null) {
    return <div className="min-h-screen" aria-hidden="true" />;
  }

  if (present && isCanton) {
    return (
      <PresentShell>
        <CantonProof present flow={flow} />
      </PresentShell>
    );
  }

  return (
    <AppShell
      title={isCanton ? "They can't see your size" : 'Decision receipts'}
      subtitle={isCanton
        ? (BRAND.pages.proof ?? 'Secret. Locked. Paid.')
        : 'Sealed decisions anchored on Solana.'}
      maxWidth="max-w-5xl"
      subheader={
        <div className={isCanton ? 'fc-proof-chain-nav fc-proof-chain-nav--canton' : undefined}>
          <SecondaryNav
            items={CHAINS}
            activeItem={chain}
            onChange={selectChain}
          />
        </div>
      }
    >
      {isCanton ? <CantonProof /> : <WorldCupClient bare />}
    </AppShell>
  );
}
