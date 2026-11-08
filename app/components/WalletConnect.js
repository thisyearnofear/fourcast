'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { useConnector } from '@solana/connector/react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { CHAINS } from '@/constants/appConstants';
import useAnchoredMenu from '@/hooks/useAnchoredMenu';
import { useChainConnections } from '@/hooks/useChainConnections';
import { useCantonWalletContext } from '@/app/CantonWalletLayer';

/**
 * Unified Wallet Connect Component
 * Single source of truth for wallet connections
 *
 * One EVM wallet covers both surfaces:
 * - Arc: USDC settlement (signals, subscriptions)
 * - Polygon: Polymarket/Kalshi order placement
 */

// Format address display — pure helper shared by pills and the panel rows.
const formatAddress = (address) => {
  if (!address) return '';
  try {
    const str = String(address);
    if (str === '[object Object]') return '';
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  } catch (e) {
    return '';
  }
};

/**
 * CopyableAddress — truncated address that copies the full value on click.
 * The copy glyph fades in on row hover; the check confirms for ~1.4s.
 */
function CopyableAddress({ address }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(address));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable (insecure context / denied) — nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : `Copy ${address}`}
      className="group inline-flex items-center gap-1.5 font-mono text-sm text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
    >
      {formatAddress(address)}
      {copied ? (
        <Check className="h-3 w-3 text-[var(--color-accent)]" aria-hidden="true" />
      ) : (
        <Copy
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/**
 * Rails this surface uses — route-level relevance shown as a muted
 * "used on this page" tag inside the wallet panel.
 */
const ROUTE_RAILS = [
  { match: '/markets', rails: ['evm', 'arc'] },
  { match: '/positions', rails: ['evm'] },
  { match: '/signals', rails: ['arc'] },
  { match: '/proof', rails: ['solana', 'canton'] },
  { match: '/labs/canton', rails: ['canton'] },
];

export default function WalletConnect() {
  // SSR hydration guard — wagmi hooks return neutral state during SSR that
  // doesn't match the client's resolved state. `mounted` from useAnchoredMenu
  // flips on first client effect, gating both the skeleton and the portal.
  const { open, setOpen, mounted, coords, rootRef, menuRef } = useAnchoredMenu();
  const pathname = usePathname();

  // A surface fired fc:wallet-needed (utils/requestWallet.js) because an
  // action needs a chain that isn't connected — open with that rail marked.
  const [neededRail, setNeededRail] = useState(null);
  useEffect(() => {
    const onNeeded = (e) => {
      setNeededRail(e.detail?.chain ?? null);
      setOpen(true);
    };
    window.addEventListener('fc:wallet-needed', onNeeded);
    return () => window.removeEventListener('fc:wallet-needed', onNeeded);
  }, [setOpen]);
  // The explicit request only lives for this open — closing clears it so a
  // later open falls back to route-level relevance (derived-state pattern,
  // same as the pathname close inside useAnchoredMenu).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setNeededRail(null);
  }

  const routeRails = ROUTE_RAILS.find((r) => pathname?.startsWith(r.match))?.rails ?? [];
  const railTag = (rails) => {
    if (rails.includes(neededRail)) {
      return (
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
          required for this action
        </span>
      );
    }
    if (rails.some((r) => routeRails.includes(r))) {
      return (
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-faint)]">
          used on this page
        </span>
      );
    }
    return null;
  };

  // Get unified chain state
  const { chains, switchToArc, switchToEvmNetwork } = useChainConnections();

  // EVM (Trading) — called for subscription to account changes
  useAccount();
  const { disconnect: disconnectEvm } = useDisconnect();

  // Canton (private settlement)
  const canton = useCantonWalletContext();

  // Solana (ConnectorKit — Phantom, Solflare, Backpack)
  const {
    connectors: solanaConnectors,
    connectWallet: solanaConnect,
    disconnectWallet: solanaDisconnect,
    isConnected: solanaConnected,
    isConnecting: solanaConnecting,
    account: solanaAccount,
  } = useConnector();

  // Styling — disconnected trigger uses the secondary-CTA voice (emerald text
  // + mint border) per design.md so it reads against the operator header.
  // Connected state keeps the document-surface mc-panel look for the pills.
  const triggerDisconnected = 'fc-action--quiet inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm';
  const triggerConnected = 'mc-panel inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-ink)]';
  const textColor = 'text-[var(--color-ink)]';

  // Check if any wallet is connected using unified state
  const isAnyConnected = chains?.evm?.connected || chains?.arc?.connected || canton?.connected || solanaConnected;

  // SSR hydration guard — wagmi hooks may return values during SSR that don't
  // match the client. Render a width-matched skeleton until mounted so the
  // header doesn't briefly blank during hydration (matches Connect Wallet
  // button: px-4 py-2 text-sm → ~120×36).
  if (!mounted) {
    // Skeleton wrapper matches the real-render `<div className="relative">`
    // so the header alignment stays pixel-stable through hydration.
    return (
      <div className="relative">
        <div className="w-[120px] h-[36px] bg-[var(--color-paper-raised)]" aria-hidden="true" />
      </div>
    );
  }

  // Safety check - don't render if chains not initialized
  if (!chains) {
    return (
      <button className={triggerDisconnected}>
        Loading...
      </button>
    );
  }

  // Helper to get chain color classes — mapped to semantic tokens so the
  // wallet pills don't reintroduce a raw Tailwind palette.
  const getChainColorClasses = (chain) => {
    const colorMap = {
      blue: 'bg-[var(--color-evidence)]/30 text-[var(--color-evidence)] border-[var(--color-evidence)]/50',
      purple: 'bg-[var(--color-review)]/30 text-[var(--color-review)] border-[var(--color-review)]/50',
      amber: 'bg-[var(--color-sealed)]/30 text-[var(--color-sealed)] border-[var(--color-sealed)]/50',
      indigo: 'bg-[var(--color-evidence)]/30 text-[var(--color-evidence)] border-[var(--color-evidence)]/50',
    };
    return colorMap[chain.color] || colorMap.blue;
  };

  // Helper to render chain section with capabilities
  const renderChainSection = (chain, chainState) => {
    if (!chainState?.connected) return null;

    return (
      <div key={chain.id} className="mb-4 pb-4 border-b border-[var(--color-rule)] last:mb-0 last:pb-0 last:border-0">
        <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
          <span>{chain.icon}</span>
          {chain.display}
        </div>
        <div className="flex items-center justify-between mb-3">
          <CopyableAddress address={chainState.address} />
          <button
            onClick={() => {
              disconnectEvm();
              setOpen(false);
            }}
            className={`text-xs px-2 py-1 transition-colors hover:bg-[var(--color-paper-soft)] ${textColor} text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]`}
          >
            Disconnect
          </button>
        </div>
        <div className="space-y-1 text-xs text-[var(--color-ink-muted)]">
          {(chain.capabilities || []).map(cap => (
            <div key={cap} className="flex items-center gap-2">
              <span className="text-[var(--color-accent)]">✓</span> {cap}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const panel =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Wallet connections"
            style={{ top: coords.top, right: coords.right }}
            className="fc-menu-pop mc-panel fixed z-[var(--z-menu)] w-72 max-w-[calc(100vw-1rem)] border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-3 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            {!isAnyConnected && (
              <p className="text-[10px] text-[var(--color-ink-faint)] mb-3">
                Each rail unlocks a different capability.
              </p>
            )}
            {/* Arc — primary settlement */}
            {chains?.evm?.connected && !chains?.arc?.connected && (
              <button
                type="button"
                onClick={() => switchToArc()}
                disabled={chains.evm?.isSwitching}
                className={`w-full mb-3 px-3 py-2 text-xs font-medium transition-all bg-[var(--color-review)]/30 text-[var(--color-review)] border border-[var(--color-review)]/60 hover:bg-[var(--color-review)]/45 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                🌀 Switch to Arc (USDC settlement)
              </button>
            )}

            <div className="mb-3">
              {renderChainSection(CHAINS.ARC, chains?.arc)}
              {chains?.evm?.connected && !chains?.arc?.connected && renderChainSection(CHAINS.EVM, chains.evm)}
            </div>

            {/* EVM */}
            {!chains?.evm?.connected && (
              <div className="mb-3">
                <div className={`text-xs font-medium ${textColor} mb-1 flex items-center gap-2`}>
                  <span>{CHAINS.EVM.icon}</span>
                  {CHAINS.EVM.display} · venues
                  {railTag(['evm', 'arc'])}
                </div>
                <p className="text-[10px] text-[var(--color-ink-faint)] mb-2">
                  Places orders on Polymarket &amp; Kalshi.
                </p>
                {/* Custom render keeps ConnectKit's modal but styles the trigger
                    in the token voice (evidence blue, square, hairline) — same
                    shape as the Solana connector buttons below. */}
                <ConnectKitButton.Custom>
                  {({ show, isConnecting }) => (
                    <button
                      type="button"
                      onClick={show}
                      disabled={isConnecting}
                      className="w-full px-3 py-2 text-xs font-medium transition-colors bg-[var(--color-evidence)]/30 text-[var(--color-evidence)] border border-[var(--color-evidence)]/60 hover:bg-[var(--color-evidence)]/45 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting ? 'Connecting…' : 'Connect EVM wallet'}
                    </button>
                  )}
                </ConnectKitButton.Custom>
              </div>
            )}

            {chains?.evm?.connected && !chains?.arc?.connected && (
              <button
                type="button"
                onClick={() => switchToEvmNetwork('polygon')}
                className={`mb-3 w-full text-[11px] underline text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]`}
              >
                Use Polygon for trading instead
              </button>
            )}

            {/* Solana — escrow & proof settlement */}
            <div className="mb-3 pt-3 border-t border-[var(--color-rule)]">
              <div className={`text-xs font-medium ${textColor} mb-1 flex items-center gap-2`}>
                <span>◎</span>
                Solana · public escrow
                {railTag(['solana'])}
              </div>
              <p className="text-[10px] text-[var(--color-ink-faint)] mb-2">
                Seals receipts on-chain and escrows public predictions — anyone can audit them.
              </p>
              {solanaConnected ? (
                <div className="flex items-center justify-between">
                  <CopyableAddress address={solanaAccount} />
                  <button
                    onClick={() => { solanaDisconnect(); setOpen(false); }}
                    className={`text-xs px-2 py-1 transition-colors hover:bg-[var(--color-paper-soft)] ${textColor} text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]`}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {solanaConnectors.filter(c => c.ready).length > 0 ? (
                    solanaConnectors.filter(c => c.ready).map(connector => (
                      <button
                        key={connector.id}
                        onClick={() => solanaConnect(connector.id)}
                        disabled={solanaConnecting}
                        className={`w-full px-3 py-2 text-xs font-medium transition-colors bg-[var(--color-review)]/30 text-[var(--color-review)] border border-[var(--color-review)]/60 hover:bg-[var(--color-review)]/45 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                      >
                        {/* Connector logos are arbitrary data:/third-party URIs from the wallet
                            provider — next/image rejects data: URIs and would route unknown hosts
                            through the optimizer for a 16px glyph. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {connector.icon && <img src={connector.icon} alt="" className="w-4 h-4" />}
                        {solanaConnecting ? 'Connecting...' : `Connect ${connector.name}`}
                      </button>
                    ))
                  ) : (
                    <p className={`text-[11px] text-[var(--color-ink-muted)]`}>
                      Install{' '}
                      <a href="https://phantom.app" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-ink)]">Phantom</a> or{' '}
                      <a href="https://solflare.com" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-ink)]">Solflare</a>.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Canton — operator ledger (hidden until enabled) */}
            {canton?.cantonEnabled && (
              <div className="mb-3 pt-3 border-t border-[var(--color-rule)]">
                <div className={`text-xs font-medium ${textColor} mb-1 flex items-center gap-2`}>
                  <span>◈</span>
                  Canton · private settlement
                  {railTag(['canton'])}
                </div>
                <p className="text-[10px] text-[var(--color-ink-faint)] mb-2">
                  Settles with hidden amounts — the math is proven, the sizes stay private.
                </p>
                {canton?.connected ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm ${textColor}`}>
                        {canton.account?.partyName || formatAddress(canton.account?.partyId)}
                      </span>
                      <button
                        onClick={() => { canton.disconnect(); setOpen(false); }}
                        className={`text-xs px-2 py-1 transition-colors hover:bg-[var(--color-paper-soft)] ${textColor} text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]`}
                      >
                        Disconnect
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--color-ink-faint)] mb-2">
                      Connected to the server-managed operator ledger.
                    </p>
                    <Link
                      href="/proof?chain=canton"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors"
                    >
                      See privacy proof →
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => canton.connect({ name: 'Fourcast' })}
                      disabled={canton?.connecting}
                      className={`w-full px-3 py-2 text-xs font-medium transition-all bg-[var(--color-accent)]/30 text-[var(--color-accent)] border border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/45 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {canton?.connecting ? 'Connecting...' : 'Connect operator ledger'}
                    </button>
                    {canton?.error && (
                      <p className="text-[11px] text-[var(--color-breach)] mt-2">{canton.error}</p>
                    )}
                    <Link
                      href="/proof?chain=canton"
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 px-3 py-2 text-[11px] border border-[var(--color-rule)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-accent)]/30 transition-colors"
                    >
                      See privacy proof →
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={isAnyConnected ? triggerConnected : triggerDisconnected}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={isAnyConnected ? 'Wallet connections' : 'Connect wallet'}
      >
        {isAnyConnected ? (
          <>
            {/* Desktop: full chain pills */}
            <div className="hidden gap-1.5 flex-wrap justify-end sm:flex">
              {chains?.arc?.connected && (
                <span className={`px-2 py-0.5 text-xs border ${getChainColorClasses(CHAINS.ARC)}`}>
                  {CHAINS.ARC.icon} Arc
                </span>
              )}
              {chains?.evm?.connected && !chains?.arc?.connected && (
                <span className={`px-2 py-0.5 text-xs border ${getChainColorClasses(CHAINS.EVM)}`}>
                  {CHAINS.EVM.icon} {formatAddress(chains.evm.address)}
                </span>
              )}
              {solanaConnected && solanaAccount && (
                <span className="px-2 py-0.5 text-xs border bg-[var(--color-review)]/30 text-[var(--color-review)] border-[var(--color-review)]/50">
                  ◎ {formatAddress(solanaAccount)}
                </span>
              )}
              {canton?.cantonEnabled && canton?.connected && (
                <span className="px-2 py-0.5 text-xs border bg-[var(--color-accent)]/30 text-[var(--color-accent)] border-[var(--color-accent)]/50">
                  ◈ Canton
                </span>
              )}
            </div>
            {/* Mobile: single status dot + truncated primary address. */}
            <span className="flex items-center gap-1.5 sm:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden />
              <span className="font-mono text-xs text-[var(--color-ink)]">
                {formatAddress(
                  chains?.arc?.address ||
                  chains?.evm?.address ||
                  solanaAccount ||
                  canton?.account?.partyId
                )}
              </span>
            </span>
          </>
        ) : (
          'Connect Wallet'
        )}
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {panel}
    </div>
  );
}
