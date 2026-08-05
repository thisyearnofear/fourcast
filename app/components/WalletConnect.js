'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { useConnector } from '@solana/connector/react';
import { CHAINS } from '@/constants/appConstants';
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
export default function WalletConnect({ isNight = false }) {
 // SSR hydration guard — wagmi hooks return neutral state during SSR that
 // doesn't match the client's resolved state. Defer JSX until after mount.
 const [mounted, setMounted] = useState(false);

 const [showDropdown, setShowDropdown] = useState(false);

 // Get unified chain state
 const { chains, switchToArc, switchToEvmNetwork } = useChainConnections();

 // EVM (Trading)
 const { address: evmAddress } = useAccount();
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
   connector: solanaConnector,
 } = useConnector();

 // Mark as mounted after first client render — gates JSX output to client only.
 useEffect(() => {
 setMounted(true);
 }, []);

 // Styling — disconnected trigger uses the secondary-CTA voice (emerald text
 // + mint border) per design.md so it reads against the operator header.
 // Connected state keeps the document-surface mc-panel look for the pills.
 const triggerDisconnected = 'fc-action--quiet px-4 py-2 text-sm font-medium';
 const triggerConnected = 'mc-panel px-3 py-2 text-sm font-medium text-[var(--color-ink)]';
 const textColor = 'text-[var(--color-ink)]';
 const dropdownGlass = 'mc-panel bg-[var(--color-paper-raised)]';

 // Check if any wallet is connected using unified state
 const isAnyConnected = chains?.evm?.connected || chains?.arc?.connected || canton?.connected || solanaConnected;

 // Format address display
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

 const address = formatAddress(chainState.address);

 return (
 <div key={chain.id} className="mb-4 pb-4 border-b border-[var(--color-rule)] last:mb-0 last:pb-0 last:border-0">
 <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
 <span>{chain.icon}</span>
 {chain.display}
 </div>
 <div className="flex items-center justify-between mb-3">
 <span className={`text-sm ${textColor}`}>{address}</span>
 <button
 onClick={() => {
 disconnectEvm();
 setShowDropdown(false);
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

 return (
 <div className="relative">
 <button
 onClick={() => setShowDropdown(!showDropdown)}
 className={isAnyConnected ? triggerConnected : triggerDisconnected}
 aria-expanded={showDropdown}
 aria-haspopup="menu"
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
 {/* Mobile: single status dot + truncated primary address.
     Replaces the old .platform-wallet max-width clip that silently
     hid connected-state pills on phones. */}
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
 </button>
 {/* Dropdown */}
 {showDropdown && (
 <div className={`absolute right-0 mt-2 w-72 ${dropdownGlass} p-3 z-50 shadow-xl`}>
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
 <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
 <span>{CHAINS.EVM.icon}</span>
 {CHAINS.EVM.display} · venues
 </div>
 <ConnectKitButton mode="dark" />
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
 <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
 <span>◎</span>
 Solana · escrow & proof
 </div>
 {solanaConnected ? (
 <div className="flex items-center justify-between">
 <span className={`text-sm font-mono ${textColor}`}>
 {formatAddress(solanaAccount)}
 </span>
 <button
 onClick={() => { solanaDisconnect(); setShowDropdown(false); }}
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
 <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
 <span>◈</span>
 Canton · operator ledger
 </div>
 {canton?.connected ? (
 <>
 <div className="flex items-center justify-between mb-2">
 <span className={`text-sm ${textColor}`}>
 {canton.account?.partyName || formatAddress(canton.account?.partyId)}
 </span>
 <button
 onClick={() => { canton.disconnect(); setShowDropdown(false); }}
 className={`text-xs px-2 py-1 transition-all hover:bg-[var(--color-paper-soft)] ${textColor} text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]`}
 >
 Disconnect
 </button>
 </div>
 <p className="text-[10px] text-[var(--color-ink-faint)] mb-2">
 Connected to the server-managed operator ledger.
 </p>
 <Link
 href="/proof?chain=canton"
 onClick={() => setShowDropdown(false)}
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
 onClick={() => setShowDropdown(false)}
 className="mt-2 inline-flex w-full items-center justify-center gap-1 px-3 py-2 text-[11px] border border-[var(--color-rule)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-accent)]/30 transition-colors"
 >
 See privacy proof →
 </Link>
 </>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 );
}
