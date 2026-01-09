'use client';

import { useMemo } from 'react';
import { useChainConnections } from '@/hooks/useChainConnections';
import { EVM_NETWORKS, APTOS_NETWORKS, MOVEMENT_NETWORKS } from '@/constants/appConstants';

/**
 * Smart Chain/Network Selector
 * 
 * Shows available networks for currently connected chains
 * Lets users switch between networks without leaving the app
 * 
 * Design: Glass morphism, inline, minimal footprint
 * Use: Optional - embed where chain selection matters
 */
export function ChainSelector({ compact = false, showLabel = true, onNetworkChange }) {
  const { chains, switchToEvmNetwork } = useChainConnections();

  const connectedChainOptions = useMemo(() => {
    const options = [];

    // EVM networks
    if (chains.evm.connected) {
      options.push({
        category: 'Trading (EVM)',
        icon: '📊',
        networks: chains.evm.availableNetworks,
        currentNetwork: chains.evm.currentNetwork,
        onSwitch: switchToEvmNetwork,
        chainId: 'evm'
      });
    }

    // Aptos or Movement signals (most wallets support both)
    if (chains.aptos.connected || chains.movement.connected) {
      const isMovement = chains.movement.connected;
      const isPureAptos = chains.aptos.connected && !chains.movement.connected;
      
      options.push({
        // If Movement wallet: show "Aptos | Movement" (both available)
        // If pure Aptos wallet: show "Aptos" only
        category: isPureAptos ? 'Signals (Aptos)' : 'Signals (Aptos | Movement)',
        icon: isMovement ? '💎' : '📡',
        networks: isMovement ? chains.movement.availableNetworks : chains.aptos.availableNetworks,
        currentNetwork: isMovement ? chains.movement.currentNetwork : chains.aptos.currentNetwork,
        chainId: isMovement ? 'movement' : 'aptos'
      });
    }

    return options;
  }, [chains, switchToEvmNetwork]);

  if (connectedChainOptions.length === 0) {
    return null; // Nothing to show if no chains connected
  }

  if (compact) {
    return <CompactChainSelector options={connectedChainOptions} onNetworkChange={onNetworkChange} />;
  }

  return <FullChainSelector options={connectedChainOptions} onNetworkChange={onNetworkChange} />;
}

/**
 * Compact version: Single line with dropdowns
 */
function CompactChainSelector({ options, onNetworkChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((option) => (
        <div key={option.chainId} className="flex items-center gap-1">
          <span className="text-sm opacity-70">{option.icon}</span>
          {option.onSwitch ? (
            <select
              defaultValue={option.currentNetwork.id}
              onChange={(e) => {
                option.onSwitch(e.target.value);
                onNetworkChange?.({ chainId: option.chainId, networkId: e.target.value });
              }}
              className="px-2 py-1 text-xs rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              {option.networks.map((net) => (
                <option key={net.id} value={net.id}>
                  {net.display}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2 py-1 text-xs text-white/70">
              {option.currentNetwork.display}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Full version: Card-style with icons and descriptions
 */
function FullChainSelector({ options, onNetworkChange }) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <div
          key={option.chainId}
          className="backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{option.icon}</span>
              <h4 className="text-sm font-medium text-white">{option.category}</h4>
            </div>
            <span className="text-xs text-white/50">
              {option.currentNetwork.display}
            </span>
          </div>

          {option.onSwitch ? (
            <div className="flex gap-2 flex-wrap">
              {option.networks.map((net) => (
                <button
                  key={net.id}
                  onClick={() => {
                    option.onSwitch(net.id);
                    onNetworkChange?.({ chainId: option.chainId, networkId: net.id });
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-light transition-all ${
                    option.currentNetwork.id === net.id
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/10 text-white/70 border border-white/10 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {net.display}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/50 italic">
              Switch in your wallet settings (cannot switch from app)
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
