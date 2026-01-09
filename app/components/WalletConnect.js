'use client';

import React, { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { CHAINS } from '@/constants/appConstants';

/**
 * Unified Wallet Connect Component
 * Single source of truth for multi-chain wallet connections
 * 
 * DESIGN PRINCIPLES:
 * - One button for all chains
 * - Clear visual distinction between connected chains
 * - Dropdown shows all connection options
 * - No duplicate button labels
 */
export default function WalletConnect({ isNight = false }) {
  const [showDropdown, setShowDropdown] = useState(false);
  
  // EVM (Trading)
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { disconnect: disconnectEvm } = useDisconnect();
  
  // Aptos/Movement (Signals)
  const { connected: aptosConnected, account: aptosAccount, wallets, connect, disconnect } = useWallet();
  const aptosAddress = aptosAccount?.address?.toString();

  // Styling
  const bgColor = isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20';
  const borderColor = isNight ? 'border-white/20' : 'border-black/20';
  const textColor = isNight ? 'text-white' : 'text-black';
  const dropdownBg = isNight ? 'bg-slate-900/95 border-white/10' : 'bg-white/95 border-black/10';

  // Check if any wallet is connected
  const isAnyConnected = evmConnected || aptosConnected;

  // Format address display
  const formatAddress = (address) => {
    if (!address) return '';
    const str = address.toString();
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  const evmDisplay = evmAddress ? formatAddress(evmAddress) : null;
  const aptosDisplay = aptosAddress ? formatAddress(aptosAddress) : null;

  // Helper to get chain color classes
  const getChainColorClasses = (chain) => {
    const colorMap = {
      blue: 'bg-blue-500/30 text-blue-200 border-blue-500/50',
      purple: 'bg-purple-500/30 text-purple-200 border-purple-500/50',
      amber: 'bg-amber-500/30 text-amber-200 border-amber-500/50'
    };
    return colorMap[chain.color] || colorMap.blue;
  };

  // Helper to render chain section with capabilities
  const renderChainSection = (chain, address, isConnected) => {
    if (!isConnected) return null;
    
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
              chain.id === 'evm' ? disconnectEvm() : disconnect();
              setShowDropdown(false);
            }}
            className={`text-xs px-2 py-1 rounded-lg transition-all ${isNight ? 'hover:bg-white/10' : 'hover:bg-black/10'} ${textColor} opacity-60 hover:opacity-100`}
          >
            Disconnect
          </button>
        </div>
        <div className="space-y-1 text-xs opacity-60">
          {chain.capabilities.map(cap => (
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
        className={`px-4 py-2 rounded-xl text-sm font-light border transition-all ${bgColor} ${borderColor} ${textColor}`}
      >
        {isAnyConnected ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {evmConnected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.EVM)}`}>
                  {CHAINS.EVM.icon} {evmDisplay}
                </span>
              )}
              {aptosConnected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.APTOS)}`}>
                  {CHAINS.APTOS.icon} {aptosDisplay}
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
        <div className={`absolute right-0 mt-2 w-80 rounded-xl border ${dropdownBg} backdrop-blur-xl p-4 z-50 shadow-xl`}>
          {/* Header */}
          <div className={`text-xs font-medium ${isNight ? 'text-white/60' : 'text-black/60'} uppercase tracking-wide mb-4`}>
            Wallet Networks
          </div>

          {/* Connected Chains */}
          <div className="mb-4">
            {renderChainSection(CHAINS.EVM, evmDisplay, evmConnected)}
            {renderChainSection(CHAINS.APTOS, aptosDisplay, aptosConnected)}
          </div>

          {/* EVM Connect Section */}
          {!evmConnected && (
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className={`text-xs font-medium ${textColor} mb-3 flex items-center gap-2`}>
                <span>{CHAINS.EVM.icon}</span>
                {CHAINS.EVM.display}
              </div>
              <ConnectKitButton mode={isNight ? "dark" : "light"} />
            </div>
          )}

          {/* Aptos/Movement Connect Section */}
          {!aptosConnected && (
            <div className="mb-4">
              <div className={`text-xs font-medium ${textColor} mb-2 flex items-center gap-2`}>
                <span>{CHAINS.APTOS.icon}</span>
                {CHAINS.APTOS.display}
              </div>
              <div className="space-y-1.5">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={async () => {
                      try {
                        await connect(wallet.name);
                        setShowDropdown(false);
                      } catch (e) {
                        console.error('Aptos connection failed:', e);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${textColor} transition-all ${isNight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Info - Chain Purposes */}
          <div className={`mt-4 pt-4 border-t border-white/10 space-y-2`}>
            <div className={`text-xs ${isNight ? 'text-white/40' : 'text-black/40'}`}>
              <p><span className={CHAINS.EVM.icon}> {CHAINS.EVM.purpose}</span></p>
              <p><span className={CHAINS.APTOS.icon}> {CHAINS.APTOS.purpose}</span></p>
            </div>
            <div className={`${isNight ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-400/10 border-amber-400/20'} border rounded-lg p-2`}>
              <p className={`text-xs ${isNight ? 'text-amber-300' : 'text-amber-800'}`}>
                <span className={CHAINS.MOVEMENT.icon}> {CHAINS.MOVEMENT.purpose}</span>
              </p>
              <p className={`text-xs ${isNight ? 'text-amber-200/60' : 'text-amber-700/60'} mt-1`}>
                💰 Earn tips from your track record
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
