'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { CHAINS, EVM_NETWORKS } from '@/constants/appConstants';
import { ARC_CHAIN_ID } from '@/constants/evmContracts';

/**
 * Unified Chain Connection State Management
 *
 * Single source of truth for wallet connections. One EVM wallet (wagmi)
 * covers both surfaces:
 * - Polygon: Polymarket/Kalshi order placement ('evm')
 * - Arc: USDC settlement — signal publishing, subscriptions ('arc')
 *
 * Usage:
 *   const { chains, canPerform } = useChainConnections();
 *   if (chains.arc.connected) { ... }
 *   if (canPerform('arc', 'publish')) { ... }
 */
export function useChainConnections() {
  // EVM connections via wagmi (Polygon mainnet for USDC trading)
  const { address: evmAddress, isConnected: evmConnected, chain: currentEvmChain } = useAccount();
  const { switchChain: evmSwitchChain, isPending: isEvmSwitching } = useSwitchChain();

  // Track preferred network (user's explicit choice)
  const [preferredEvmNetwork, setPreferredEvmNetwork] = useState('polygon');

  /**
   * Get current EVM network details
   */
  const currentEvmNetwork = useMemo(() => {
    if (!currentEvmChain) return EVM_NETWORKS.POLYGON; // Default

    const networkId = currentEvmChain.id;
    return Object.values(EVM_NETWORKS).find(n => n.chainId === networkId) || EVM_NETWORKS.POLYGON;
  }, [currentEvmChain]);

  /**
   * Unified chain connection state with network tracking
   * Structure matches CHAINS constants for consistency
   */
  const chains = useMemo(
    () => ({
      evm: {
        id: 'evm',
        connected: evmConnected,
        address: evmAddress || null,
        chainName: 'Polygon',
        currentNetwork: currentEvmNetwork,
        availableNetworks: Object.values(EVM_NETWORKS).filter(n => n.id !== 'arc'),
        isCorrectNetwork: currentEvmChain?.id === 137, // Polygon is primary
        isSwitching: isEvmSwitching,
      },
      arc: {
        id: 'arc',
        connected: evmConnected && currentEvmChain?.id === ARC_CHAIN_ID,
        address: evmAddress || null,
        chainName: 'Arc',
        currentNetwork: currentEvmNetwork?.id === 'arc' ? currentEvmNetwork : EVM_NETWORKS.ARC,
        availableNetworks: [EVM_NETWORKS.ARC],
        isCorrectNetwork: currentEvmChain?.id === ARC_CHAIN_ID,
        isSwitching: isEvmSwitching,
      },
    }),
    [evmConnected, evmAddress, currentEvmNetwork, isEvmSwitching, currentEvmChain]
  );

  /**
   * Check if user can perform an action on a specific chain
   * Centralizes all capability logic
   *
   * Actions:
   * - 'trade': Place market orders (EVM)
   * - 'publish': Publish signals (Arc)
   * - 'publish_and_monetize': Publish + receive tips (Arc)
   * - 'settle': Arc-native USDC settlement
   */
  const canPerform = useCallback((chainId, action) => {
    try {
      const chain = chains[chainId];
      if (!chain?.connected) return false;

      switch (action) {
        case 'trade':
          return chainId === 'evm' || chainId === 'arc';
        case 'publish':
        case 'publish_and_monetize':
        case 'settle':
          return chainId === 'arc' && chain.isCorrectNetwork;
        default:
          return false;
      }
    } catch (error) {
      console.warn('Error in canPerform:', error);
      return false;
    }
  }, [chains]);

  /**
   * Get all connected chains for quick checks
   */
  const connectedChains = useMemo(
    () => Object.values(chains).filter(c => c.connected).map(c => c.id),
    [chains]
  );

  /**
   * Check if the signal-publishing chain (Arc) is connected.
   * Always returns a boolean, never undefined
   */
  const canPublish = useMemo(
    () => {
      try {
        return canPerform('arc', 'publish');
      } catch (error) {
        console.warn('Error calculating canPublish:', error);
        return false;
      }
    },
    [canPerform]
  );

  /** Publish target: Arc or nothing */
  const resolvePublishChain = useCallback(() => {
    return canPerform('arc', 'publish') ? 'arc' : null;
  }, [canPerform]);

  /**
   * Switch to a specific EVM network
   * Returns true if switch was successful/initiated
   */
  const switchToEvmNetwork = useCallback(async (networkId) => {
    try {
      const network = Object.values(EVM_NETWORKS).find(n => n.id === networkId);
      if (!network || !evmSwitchChain) return false;

      evmSwitchChain({ chainId: network.chainId });
      setPreferredEvmNetwork(networkId);
      return true;
    } catch (error) {
      console.error('Failed to switch EVM network:', error);
      return false;
    }
  }, [evmSwitchChain]);

  const switchToArc = useCallback(() => switchToEvmNetwork('arc'), [switchToEvmNetwork]);

  /**
   * Get guidance for chain action (what's needed, what to do)
   * Returns { canAct, needsSwitch, targetChain, guidance }
   */
  const getActionGuidance = useCallback((chainId, action) => {
    const chain = chains[chainId];

    if (!chain?.connected) {
      return {
        canAct: false,
        needsSwitch: false,
        guidance: `Connect ${chain?.chainName} wallet`
      };
    }

    // For EVM, check if on correct network
    if (chainId === 'evm' && !chain.isCorrectNetwork) {
      return {
        canAct: false,
        needsSwitch: true,
        targetChain: 'polygon',
        guidance: `Switch to Polygon network to ${action}`
      };
    }

    // For Arc, check if on correct network
    if (chainId === 'arc' && !chain.isCorrectNetwork) {
      return {
        canAct: false,
        needsSwitch: true,
        targetChain: 'arc',
        guidance: `Switch to Arc network to ${action}`
      };
    }

    return {
      canAct: true,
      needsSwitch: false,
      guidance: null
    };
  }, [chains]);

  return {
    // Primary: Unified chain state
    chains,

    // Utility functions
    canPerform,
    connectedChains,
    canPublish,
    resolvePublishChain,

    // Network switching
    switchToEvmNetwork,
    switchToArc,
    getActionGuidance,
    arcChainId: ARC_CHAIN_ID,

    // Legacy compat
    isConnected: evmConnected,
  };
}
