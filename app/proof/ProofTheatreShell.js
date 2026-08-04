'use client';

import { useEffect, useState } from 'react';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import CantonProof from './CantonProof';
import WorldCupClient from '@/app/world-cup/WorldCupClient';
import { BRAND } from '@/constants/brand';

/**
 * Private / Proof — chain-agnostic evidence surface.
 * Default: Canton. Solana receipts available via tab.
 */
const CHAINS = [
  { id: 'canton', label: 'Canton', icon: '◈' },
  { id: 'solana', label: 'Solana', icon: '◎' },
];

export default function ProofTheatreShell() {
  const [chain, setChain] = useState('canton');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
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

  return (
    <AppShell
      title={isCanton ? 'Private position · live' : 'Decision receipts'}
      subtitle={isCanton
        ? (BRAND.pages.proof ?? 'Stake and side hidden. Same ledger, two views.')
        : 'Sealed decisions anchored on Solana.'}
      maxWidth="max-w-5xl"
      subheader={
        <SecondaryNav
          items={CHAINS}
          activeItem={chain}
          onChange={selectChain}
        />
      }
    >
      {isCanton ? <CantonProof /> : <WorldCupClient bare />}
    </AppShell>
  );
}
