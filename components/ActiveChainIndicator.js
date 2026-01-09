'use client';

import { useEffect, useState } from 'react';
import { useChainConnections } from '@/hooks/useChainConnections';
import { CHAINS } from '@/constants/appConstants';

/**
 * ActiveChainIndicator - Consolidated component for showing active chain status
 * 
 * DESIGN PRINCIPLES:
 * - Equal treatment of Aptos and Movement (no "premium" bias)
 * - Clear capability communication
 * - Minimal, informative UI
 * - Single source of truth for chain indication
 * 
 * Usage:
 *   <ActiveChainIndicator variant="badge" />    // Small badge
 *   <ActiveChainIndicator variant="full" />     // Full info card
 *   <ActiveChainIndicator variant="inline" />   // Inline text
 */
export function ActiveChainIndicator({ variant = 'badge', isNight = false, className = '' }) {
  const [mounted, setMounted] = useState(false);
  const { chains } = useChainConnections();

  // Wait for client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Safety check for SSR
  if (!mounted || !chains) return null;

  // Determine active signal chain (Movement or Aptos)
  const activeChain = chains?.movement?.connected
    ? CHAINS.MOVEMENT
    : chains?.aptos?.connected
      ? CHAINS.APTOS
      : null;

  const activeAddress = chains?.movement?.connected
    ? chains.movement.address
    : chains?.aptos?.connected
      ? chains.aptos.address
      : null;

  if (!activeChain) return null;

  // Styling
  const textColor = isNight ? 'text-white' : 'text-black';
  const mutedColor = isNight ? 'text-white/60' : 'text-black/60';
  const borderColor = isNight ? 'border-white/20' : 'border-black/20';

  const chainColorMap = {
    purple: isNight ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-400/20 text-purple-800 border-purple-400/30',
    amber: isNight ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-400/20 text-amber-800 border-amber-400/30',
  };

  const chainStyle = chainColorMap[activeChain.color];

  // Badge variant - compact display
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${chainStyle} ${className}`}>
        <span>{activeChain.icon}</span>
        <span className="text-xs font-medium">{activeChain.name}</span>
      </div>
    );
  }

  // Inline variant - minimal text
  if (variant === 'inline') {
    return (
      <span className={`${mutedColor} text-xs ${className}`}>
        {activeChain.icon} {activeChain.name}
      </span>
    );
  }

  // Full variant - detailed card with capabilities
  return (
    <div className={`backdrop-blur-xl border ${borderColor} rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{activeChain.icon}</span>
          <div>
            <h4 className={`text-sm font-medium ${textColor}`}>
              Active: {activeChain.name}
            </h4>
            <p className={`text-xs ${mutedColor}`}>
              {typeof activeAddress === 'string' ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="space-y-1.5">
        <p className={`text-xs ${mutedColor} font-medium mb-1`}>Capabilities:</p>
        {activeChain.capabilities.map((cap, idx) => (
          <div key={idx} className={`text-xs ${textColor} flex items-center gap-1.5`}>
            <span className="text-green-400">✓</span>
            <span>{cap}</span>
          </div>
        ))}
        {activeChain.disabled.length > 0 && activeChain.disabled.map((dis, idx) => (
          <div key={idx} className={`text-xs ${mutedColor} flex items-center gap-1.5 opacity-50`}>
            <span>○</span>
            <span>{dis}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ChainComparisonCard - Side-by-side comparison for wallet connection
 * Shows Aptos and Movement as equal alternatives
 */
export function ChainComparisonCard({ onSelectChain, isNight = false }) {
  const textColor = isNight ? 'text-white' : 'text-black';
  const mutedColor = isNight ? 'text-white/60' : 'text-black/60';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';

  const chains = [
    { chain: CHAINS.APTOS, recommended: false },
    { chain: CHAINS.MOVEMENT, recommended: false }
  ];

  return (
    <div className="space-y-3">
      <p className={`text-sm ${mutedColor} mb-3`}>
        Choose your network for signal publishing:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {chains.map(({ chain }) => {
          const chainColorMap = {
            purple: isNight ? 'hover:border-purple-500/30' : 'hover:border-purple-400/30',
            amber: isNight ? 'hover:border-amber-500/30' : 'hover:border-amber-400/30',
          };

          return (
            <button
              key={chain.id}
              onClick={() => onSelectChain?.(chain.id)}
              className={`text-left backdrop-blur-xl border ${borderColor} ${chainColorMap[chain.color]} rounded-xl p-4 transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{chain.icon}</span>
                <h3 className={`text-sm font-medium ${textColor}`}>{chain.name}</h3>
              </div>

              <p className={`text-xs ${mutedColor} mb-3`}>{chain.purpose}</p>

              {/* Capabilities */}
              <div className="space-y-1">
                {chain.capabilities.map((cap, idx) => (
                  <div key={idx} className={`text-xs ${textColor} flex items-center gap-1.5`}>
                    <span className="text-green-400">✓</span>
                    <span>{cap}</span>
                  </div>
                ))}
                {chain.disabled.length > 0 && chain.disabled.map((dis, idx) => (
                  <div key={idx} className={`text-xs ${mutedColor} flex items-center gap-1.5 opacity-40`}>
                    <span>○</span>
                    <span>{dis}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <p className={`text-xs ${mutedColor} mt-3 text-center`}>
        Both networks use the same wallets (Petra, Martian, etc.)
      </p>
    </div>
  );
}
