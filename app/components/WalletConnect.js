'use client';

import React, { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { CHAINS } from '@/constants/appConstants';
import { useChainConnections } from '@/hooks/useChainConnections';

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
  
  // Get unified chain state
  const { chains } = useChainConnections();
  
  // EVM (Trading)
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { disconnect: disconnectEvm } = useDisconnect();
  
  // Aptos/Movement (Signals) - raw wallet adapter for connection actions
  const { connected: aptosWalletConnected, account: aptosAccount, wallets, connect, disconnect } = useWallet();

  // Styling
  const bgColor = isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20';
  const borderColor = isNight ? 'border-white/20' : 'border-black/20';
  const textColor = isNight ? 'text-white' : 'text-black';
  const dropdownBg = isNight ? 'bg-slate-900/95 border-white/10' : 'bg-white/95 border-black/10';

  // Check if any wallet is connected using unified state
  const isAnyConnected = chains?.evm?.connected || chains?.aptos?.connected || chains?.movement?.connected;

  // Format address display
  const formatAddress = (address) => {
    if (!address) return '';
    const str = address.toString();
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  const evmDisplay = evmAddress ? formatAddress(evmAddress) : null;

  // Safety check - don't render if chains not initialized
  if (!chains) {
    return (
      <button className={`px-4 py-2 rounded-xl text-sm font-light border transition-all ${bgColor} ${borderColor} ${textColor}`}>
        Loading...
      </button>
    );
  }

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
              if (chain.id === 'evm') {
                disconnectEvm();
              } else {
                // For Aptos/Movement, use the raw wallet adapter disconnect
                disconnect();
              }
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
              {chains?.evm?.connected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.EVM)}`}>
                  {CHAINS.EVM.icon} {formatAddress(chains.evm.address)}
                </span>
              )}
              {chains?.aptos?.connected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.APTOS)}`}>
                  {CHAINS.APTOS.icon} {formatAddress(chains.aptos.address)}
                </span>
              )}
              {chains?.movement?.connected && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getChainColorClasses(CHAINS.MOVEMENT)}`}>
                  {CHAINS.MOVEMENT.icon} {formatAddress(chains.movement.address)}
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
            {renderChainSection(CHAINS.EVM, chains?.evm)}
            {renderChainSection(CHAINS.APTOS, chains?.aptos)}
            {renderChainSection(CHAINS.MOVEMENT, chains?.movement)}
          </div>

          {/* EVM Connect Section */}
          {!chains?.evm?.connected && (
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className={`text-xs font-medium ${textColor} mb-3 flex items-center gap-2`}>
                <span>{CHAINS.EVM.icon}</span>
                {CHAINS.EVM.display}
              </div>
              <ConnectKitButton mode={isNight ? "dark" : "light"} />
            </div>
          )}

          {/* Aptos/Movement Connect Section */}
          {!aptosWalletConnected && (
            <div className="mb-4">
              <div className={`text-xs font-medium ${textColor} mb-3`}>
                Connect for Signal Publishing
              </div>
              
              {/* Side-by-side chain info */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className={`p-2 rounded-lg border ${isNight ? 'border-purple-500/20 bg-purple-500/5' : 'border-purple-400/20 bg-purple-400/5'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{CHAINS.APTOS.icon}</span>
                    <span className={`text-xs font-medium ${textColor}`}>{CHAINS.APTOS.name}</span>
                  </div>
                  <div className={`text-xs ${isNight ? 'text-white/50' : 'text-black/50'} space-y-0.5`}>
                    {CHAINS.APTOS.capabilities.map((cap, idx) => (
                      <div key={idx}>✓ {cap}</div>
                    ))}
                  </div>
                </div>
                
                <div className={`p-2 rounded-lg border ${isNight ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{CHAINS.MOVEMENT.icon}</span>
                    <span className={`text-xs font-medium ${textColor}`}>{CHAINS.MOVEMENT.name}</span>
                  </div>
                  <div className={`text-xs ${isNight ? 'text-white/50' : 'text-black/50'} space-y-0.5`}>
                    {CHAINS.MOVEMENT.capabilities.map((cap, idx) => (
                      <div key={idx}>✓ {cap}</div>
                    ))}
                  </div>
                </div>
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
                        console.error('Wallet connection failed:', e);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${textColor} transition-all ${isNight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
              <div className={`text-xs ${isNight ? 'text-white/40' : 'text-black/40'} mt-2`}>
                Network detected automatically from environment config
              </div>
            </div>
          )}

          {/* Footer Info - Chain Purposes */}
          <div className={`mt-4 pt-4 border-t ${isNight ? 'border-white/10' : 'border-black/10'} space-y-1.5`}>
            <div className={`text-xs ${isNight ? 'text-white/40' : 'text-black/40'}`}>
              <p className="flex items-center gap-1.5">
                <span>{CHAINS.EVM.icon}</span>
                <span>{CHAINS.EVM.purpose}</span>
              </p>
            </div>
            <div className={`text-xs ${isNight ? 'text-white/40' : 'text-black/40'}`}>
              <p className="mb-1 font-medium">Signal Networks:</p>
              <p className="flex items-center gap-1.5 ml-2">
                <span>{CHAINS.APTOS.icon}</span>
                <span>{CHAINS.APTOS.purpose}</span>
              </p>
              <p className="flex items-center gap-1.5 ml-2">
                <span>{CHAINS.MOVEMENT.icon}</span>
                <span>{CHAINS.MOVEMENT.purpose}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
