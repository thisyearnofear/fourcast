'use client';

import React, { useState, useEffect } from 'react';
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
 const triggerConnected = 'mc-panel px-3 py-2 text-sm font-medium text-white';
 const textColor = 'text-white';
 const dropdownGlass = 'mc-panel bg-slate-900/95';

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
 <div className="w-[120px] h-[36px] bg-white/5" aria-hidden="true" />
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

 // Helper to get chain color classes
 const getChainColorClasses = (chain) => {
 const colorMap = {
 blue: 'bg-blue-500/30 text-blue-200 border-blue-500/50',
 purple: 'bg-purple-500/30 text-purple-200 border-purple-500/50',
 amber: 'bg-amber-500/30 text-amber-200 border-amber-500/50',
 indigo: 'bg-indigo-500/30 text-indigo-200 border-indigo-500/50',
 };
 return colorMap[chain.color] || colorMap.blue;
 };

 // Helper to render chain section with capabilities
 const renderChainSection = (chain, chainState) => {
 if (!chainState?.connected) return null;

 const address = formatAddress(chainState.address);

 return (
 <div key={chain.id} className="mb-4 pb-4 border-b border-white/15 last:mb-0 last:pb-0 last:border-0">
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
 className={`text-xs px-2 py-1 transition-colors hover:bg-white/10 ${textColor} text-white/70 hover:text-white`}
 >
 Disconnect
 </button>
 </div>
 <div className="space-y-1 text-xs text-white/75">
 {(chain.capabilities || []).map(cap => (
 <div key={cap} className="flex items-center gap-2">
 <span className="text-green-400">✓</span> {cap}
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
 <span className="px-2 py-0.5 text-xs border bg-purple-500/30 text-purple-200 border-purple-500/50">
 ◎ {formatAddress(solanaAccount)}
 </span>
 )}
 {canton?.cantonEnabled && canton?.connected && (
 <span className="px-2 py-0.5 text-xs border bg-teal-500/30 text-teal-200 border-teal-500/50">
 ◈ Canton
 </span>
 )}
 </div>
 {/* Mobile: single status dot + truncated primary address.
     Replaces the old .platform-wallet max-width clip that silently
     hid connected-state pills on phones. */}
 <span className="flex items-center gap-1.5 sm:hidden">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
 <span className="font-mono text-xs text-white">
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
 className={`w-full mb-3 px-3 py-2 text-xs font-medium transition-all bg-indigo-500/30 text-indigo-100 border border-indigo-400/60 hover:bg-indigo-500/45 disabled:opacity-50 disabled:cursor-not-allowed`}
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
 className={`mb-3 w-full text-[11px] underline text-white/70 hover:text-white`}
 >
 Use Polygon for trading instead
 </button>
 )}

 {/* Solana — escrow & proof settlement */}
 <div className="mb-3 pt-3 border-t border-white/15">
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
 className={`text-xs px-2 py-1 transition-colors hover:bg-white/10 ${textColor} text-white/70 hover:text-white`}
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
 className={`w-full px-3 py-2 text-xs font-medium transition-colors bg-purple-500/30 text-purple-100 border border-purple-400/60 hover:bg-purple-500/45 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
 >
 {connector.icon && <img src={connector.icon} alt="" className="w-4 h-4" />}
 {solanaConnecting ? 'Connecting...' : `Connect ${connector.name}`}
 </button>
 ))
 ) : (
 <p className={`text-[11px] text-white/70`}>
 Install{' '}
 <a href="https://phantom.app" target="_blank" rel="noreferrer" className="underline hover:text-white">Phantom</a> or{' '}
 <a href="https://solflare.com" target="_blank" rel="noreferrer" className="underline hover:text-white">Solflare</a>.
 </p>
 )}
 </div>
 )}
 </div>

 {/* Canton — private settlement (hidden until enabled) */}
 {canton?.cantonEnabled && (
 <div className="mb-3 pt-3 border-t border-white/15">
 <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
 <span>◈</span>
 Canton · private
 </div>
 {canton?.connected ? (
 <>
 <div className="flex items-center justify-between mb-2">
 <span className={`text-sm ${textColor}`}>
 {canton.account?.partyName || formatAddress(canton.account?.partyId)}
 </span>
 <button
 onClick={() => { canton.disconnect(); setShowDropdown(false); }}
 className={`text-xs px-2 py-1 transition-all hover:bg-white/10 ${textColor} text-white/70 hover:text-white`}
 >
 Disconnect
 </button>
 </div>
 <button
 onClick={() => canton.refreshBalances()}
 className="text-[11px] underline text-teal-300 hover:text-teal-200"
 >
 Refresh balances
 </button>
 </>
 ) : (
 <>
 <button
 type="button"
 onClick={() => canton.connect({ name: 'Fourcast' })}
 disabled={canton?.connecting || (canton?.mode === 'console-wallet' && canton?.extensionAvailable === false)}
 className={`w-full px-3 py-2 text-xs font-medium transition-all bg-teal-500/30 text-teal-100 border border-teal-400/60 hover:bg-teal-500/45 disabled:opacity-50 disabled:cursor-not-allowed`}
 >
 {canton?.connecting
 ? 'Connecting...'
 : canton?.mode === 'wallet-sdk'
 ? 'Connect to Canton Node'
 : canton?.extensionAvailable === false
 ? 'Install Console Wallet extension'
 : 'Connect Console Wallet'}
 </button>
 {canton?.error && (
 <p className="text-[11px] text-red-400 mt-2">{canton.error}</p>
 )}
 </>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 );
}
