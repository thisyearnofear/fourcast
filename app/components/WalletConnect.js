'use client';

import React, { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { CHAINS } from '@/constants/appConstants';
import { BRAND } from '@/constants/brand';
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
  const [showDropdown, setShowDropdown] = useState(false);

  // Get unified chain state
  const { chains, switchToArc, switchToEvmNetwork } = useChainConnections();

  // EVM (Trading)
  const { address: evmAddress } = useAccount();
  const { disconnect: disconnectEvm } = useDisconnect();

  // Canton (private settlement)
  const canton = useCantonWalletContext();

  // Styling - Glass CSS classes (DRY)
  const glassBtn = 'glass-subtle';
  const textColor = 'text-white';
  const dropdownGlass = 'glass-heavy bg-slate-900/95';

  // Check if any wallet is connected using unified state
  const isAnyConnected = chains?.evm?.connected || chains?.arc?.connected || canton?.connected;

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

  // Safety check - don't render if chains not initialized
  if (!chains) {
    return (
      <button className={`px-4 py-2 rounded-xl text-sm font-light ${glassBtn} ${textColor}`}>
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
      <div key={chain.id} className="mb-4 pb-4 border-b border-white/10 last:mb-0 last:pb-0 last:border-0">
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
            className={`text-xs px-2 py-1 rounded-lg transition-all hover:bg-white/10 ${textColor} opacity-60 hover:opacity-100`}
          >
            Disconnect
          </button>
        </div>
        <div className="space-y-1 text-xs opacity-60">
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
        className={`px-4 py-2 rounded-xl text-sm font-light ${glassBtn} ${textColor}`}
      >
        {isAnyConnected ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-wrap justify-end">
              {chains?.arc?.connected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.ARC)}`}>
                  {CHAINS.ARC.icon} Arc
                </span>
              )}
              {chains?.evm?.connected && !chains?.arc?.connected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.EVM)}`}>
                  {CHAINS.EVM.icon} {formatAddress(chains.evm.address)}
                </span>
              )}
              {canton?.connected && (
                <span className="px-2 py-0.5 rounded-full text-xs border bg-teal-500/30 text-teal-200 border-teal-500/50">
                  ◈ Canton
                </span>
              )}
            </div>
          </div>
        ) : (
          'Connect Wallet'
        )}
      </button>
      {/* Dropdown */}
      {showDropdown && (
        <div className={`absolute right-0 mt-2 w-80 rounded-xl ${dropdownGlass} p-4 z-50 shadow-xl`}>
          {/* Header */}
          <div className={`text-xs font-medium text-white/60 uppercase tracking-wide mb-2`}>
            Wallet Networks
          </div>

          {/* Helper Text - Explains why different networks */}
          {!isAnyConnected && (
            <p className={`text-xs text-white/40 mb-4 leading-relaxed`}>
              {BRAND.walletExplainer.headline}{' '}
              {BRAND.walletExplainer.layers.map((l) => l.name).join(' · ')}.
            </p>
          )}

          {chains?.evm?.connected && !chains?.arc?.connected && (
            <button
              type="button"
              onClick={() => switchToArc()}
              disabled={chains.evm?.isSwitching}
              className={`w-full mb-4 px-3 py-2 rounded-lg text-xs font-medium transition-all bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 hover:bg-indigo-500/30`}
            >
              🌀 Switch to Arc testnet (USDC settlement)
            </button>
          )}

          {chains?.arc?.connected && (
            <p className={`text-[10px] mb-3 text-indigo-300/70`}>
              ✓ Arc testnet — ready to publish signals in USDC
            </p>
          )}

          {/* Connected Chains */}
          <div className="mb-4">
            {renderChainSection(CHAINS.ARC, chains?.arc)}
            {chains?.evm?.connected && !chains?.arc?.connected && renderChainSection(CHAINS.EVM, chains.evm)}
          </div>

          {/* EVM Connect Section */}
          {!chains?.evm?.connected && (
            <div className="mb-4">
              <div className={`text-xs font-medium ${textColor} mb-1 flex items-center gap-2`}>
                <span>{CHAINS.EVM.icon}</span>
                {CHAINS.EVM.display}
              </div>
              <p className={`text-[10px] text-white/40 mb-3`}>
                Connect EVM wallet, then switch to Arc or Polygon via network picker
              </p>
              <ConnectKitButton mode="dark" />
            </div>
          )}

          {chains?.evm?.connected && !chains?.arc?.connected && (
            <button
              type="button"
              onClick={() => switchToEvmNetwork('polygon')}
              className={`mb-4 w-full text-[10px] underline text-white/40`}
            >
              Use Polygon for trading instead
            </button>
          )}

          {/* Canton (Private Settlement) Section */}
          <div className="mb-4 pt-4 border-t border-white/10">
            <div className={`text-xs font-medium ${textColor} mb-1 flex items-center gap-2`}>
              <span>◈</span>
              Canton (Private Settlement)
            </div>
            {canton?.connected ? (
              <>
                <p className={`text-[10px] text-teal-300/70 mb-2`}>
                  ✓ Console Wallet connected — cBTC/cETH private positions active
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm ${textColor}`}>
                    {canton.account?.partyName || formatAddress(canton.account?.partyId)}
                  </span>
                  <button
                    onClick={() => { canton.disconnect(); setShowDropdown(false); }}
                    className={`text-xs px-2 py-1 rounded-lg transition-all hover:bg-white/10 ${textColor} opacity-60 hover:opacity-100`}
                  >
                    Disconnect
                  </button>
                </div>
                {canton.network && (
                  <p className="text-[10px] text-white/40 mb-2">
                    Network: {canton.network.name || canton.network.id || 'Canton'}
                  </p>
                )}
                <button
                  onClick={() => canton.refreshBalances()}
                  className="text-[10px] underline text-teal-300/60 hover:text-teal-300"
                >
                  Refresh cBTC/cETH balances
                </button>
              </>
            ) : (
              <>
                <p className={`text-[10px] text-white/40 mb-3`}>
                  Private settlement with cBTC/cETH — position sizes hidden from all third parties via Daml smart contracts
                </p>
                <button
                  type="button"
                  onClick={() => canton.connect({ name: 'Fourcast' })}
                  disabled={canton?.connecting || canton?.extensionAvailable === false}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all bg-teal-500/20 text-teal-200 border border-teal-400/30 hover:bg-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {canton?.connecting
                    ? 'Connecting...'
                    : canton?.extensionAvailable === false
                      ? 'Install Console Wallet extension'
                      : 'Connect Console Wallet'}
                </button>
                {canton?.error && (
                  <p className="text-[10px] text-red-400/70 mt-2">{canton.error}</p>
                )}
              </>
            )}
          </div>

          {/* Footer Info - Chain Purposes */}
          <div className={`mt-4 pt-4 border-t border-white/10 space-y-1.5`}>
            <div className={`text-xs text-white/40`}>
              <p className="flex items-center gap-1.5">
                <span>{CHAINS.ARC.icon}</span>
                <span>{CHAINS.ARC.purpose}</span>
              </p>
              <p className="flex items-center gap-1.5 mt-1">
                <span>◈</span>
                <span>Canton — private cBTC/cETH settlement with hidden position sizes</span>
              </p>
              <p className="flex items-center gap-1.5 mt-1">
                <span>{CHAINS.EVM.icon}</span>
                <span>{CHAINS.EVM.purpose}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
