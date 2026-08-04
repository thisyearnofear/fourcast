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
      title={isCanton ? 'Private positions. Publicly demonstrable privacy.' : 'Proof of decision, anchored on Solana.'}
      subtitle={isCanton
        ? 'Watch the same Canton ledger answer two identities differently, then inspect the atomic settlement invariant behind the position.'
        : 'Audit what an agent knew, which policy constrained it, and how the sealed decision reconciled against a TxLINE outcome proof.'}
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
