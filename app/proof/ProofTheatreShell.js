'use client';

import { useEffect, useState } from 'react';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import CantonProof from './CantonProof';
import WorldCupClient from '@/app/world-cup/WorldCupClient';

/**
 * Proof Theatre — the unified, chain-agnostic evidence surface.
 *
 * One audit trail across chains. The chain is a badge on each proof, not a
 * section: a Solana-anchored decision receipt and a Canton atomic-settlement
 * proof are both "a proof" the viewer can audit. This replaces the old split
 * where /world-cup proved things on Solana and /canton proved things on
 * Canton, forcing a judge to know which chain to visit.
 *
 * Chain selection is driven by ?chain=canton | solana (defaults to canton,
 * the newly-unified surface that used to live at /canton).
 */
const CHAINS = [
  { id: 'canton', label: 'Canton settlement', icon: '◈' },
  { id: 'solana', label: 'Solana receipts', icon: '◎' },
];

export default function ProofTheatreShell() {
  const [chain, setChain] = useState('canton');

  // Honour ?chain= on mount so deep-links (e.g. /canton → /proof?chain=canton)
  // land on the right module. Also honour ?fixture= by defaulting to solana,
  // since a fixture deep-link targets the Solana receipt browser.
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

  return (
    <AppShell
      title="Proof Theatre"
      subtitle="One audit trail across chains. A Solana-anchored decision receipt and a Canton atomic-settlement proof are both proof — the chain is a badge on each, not a section."
      maxWidth="max-w-5xl"
      subheader={
        <SecondaryNav
          items={CHAINS}
          activeItem={chain}
          onChange={setChain}
        />
      }
    >
      {chain === 'canton' ? <CantonProof /> : <WorldCupClient bare />}
    </AppShell>
  );
}
