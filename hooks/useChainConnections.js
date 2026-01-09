'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { CHAINS, EVM_NETWORKS, APTOS_NETWORKS, MOVEMENT_NETWORKS, NETWORK_SWITCH_CONFIGS } from '@/constants/appConstants';

/**
 * Unified Chain Connection State Management
 * 
 * Single source of truth for all wallet connections across EVM, Aptos, and Movement.
 * Consolidates wagmi (EVM) and Aptos wallet adapter into one coherent interface.
 * 
 * Product Design:
 * - Movement is explicitly separate from Aptos (not just a flag on Aptos connection)
 * - Each chain has own connection state, address, and capabilities
 * - canPerform(chainId, action) provides semantic clarity vs raw booleans
 * - Safe to check capabilities without touching component props
 * 
 * Usage:
 *   const { chains, canPerform } = useChainConnections();
 *   
 *   if (chains.movement.connected) { ... }
 *   if (canPerform('movement', 'publish_and_monetize')) { ... }
 *   chains.evm.address // Polygon address
 */
export function useChainConnections() {
  // EVM connections via wagmi (Polygon mainnet for USDC trading)
  const { address: evmAddress, isConnected: evmConnected, chain: currentEvmChain } = useAccount();
  const { switchChain: evmSwitchChain, isPending: isEvmSwitching } = useSwitchChain();

  // Aptos/Movement connections via wallet adapter
  const {
    account: aptosAccount,
    connected: aptosWalletConnected,
    wallet: connectedWallet,
    network: aptosNetwork,
    changeNetwork: aptosChangeNetwork,  // ✅ Get network switching function
  } = useWallet();

  // Track preferred networks (user's explicit choice)
  const [preferredEvmNetwork, setPreferredEvmNetwork] = useState('polygon');
  const [preferredAptosNetwork, setPreferredAptosNetwork] = useState('aptos-mainnet');
  const [preferredMovementNetwork, setPreferredMovementNetwork] = useState('movement-mainnet');

  /**
   * Determine if connected wallet is Movement or standard Aptos
   * NOW BASED ON ACTUAL CONNECTED NETWORK (not environment variables)
   */
  const isMovementWallet = useMemo(() => {
    if (!aptosWalletConnected || !aptosNetwork) return false;
    
    // Check ACTUAL connected network from wallet
    const chainId = aptosNetwork?.chainId;
    const networkUrl = aptosNetwork?.url || '';
    
    // Movement Bardock has chainId 250
    // Also check URL as fallback for custom networks
    return chainId === 250 || networkUrl.includes('movement');
  }, [aptosWalletConnected, aptosNetwork]);

  /**
   * Get current EVM network details
   */
  const currentEvmNetwork = useMemo(() => {
    if (!currentEvmChain) return EVM_NETWORKS.POLYGON; // Default
    
    const networkId = currentEvmChain.id;
    return Object.values(EVM_NETWORKS).find(n => n.chainId === networkId) || EVM_NETWORKS.POLYGON;
  }, [currentEvmChain]);

  /**
   * Get current Aptos/Movement network
   */
  const currentAptosNetwork = useMemo(() => {
    if (!aptosNetwork) return APTOS_NETWORKS.MAINNET;
    
    // Aptos network comes as an object with name/chainId
    const networkName = aptosNetwork.name?.toLowerCase() || '';
    if (networkName.includes('testnet')) return APTOS_NETWORKS.TESTNET;
    return APTOS_NETWORKS.MAINNET;
  }, [aptosNetwork]);

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
        availableNetworks: Object.values(EVM_NETWORKS),
        isCorrectNetwork: currentEvmChain?.id === 137, // Polygon is primary
        isSwitching: isEvmSwitching,
      },
      aptos: {
        id: 'aptos',
        connected: aptosWalletConnected && !isMovementWallet,
        address: aptosAccount?.address || null,
        chainName: 'Aptos',
        currentNetwork: currentAptosNetwork,
        availableNetworks: Object.values(APTOS_NETWORKS),
        isCorrectNetwork: true, // Aptos doesn't need chain validation like EVM
      },
      movement: {
        id: 'movement',
        connected: aptosWalletConnected && isMovementWallet,
        address: aptosAccount?.address || null,
        chainName: 'Movement',
        currentNetwork: { id: 'movement-mainnet', name: 'Movement Mainnet', display: 'Movement Mainnet' },
        availableNetworks: Object.values(MOVEMENT_NETWORKS),
        isCorrectNetwork: true,
      },
    }),
    [evmConnected, evmAddress, aptosWalletConnected, isMovementWallet, aptosAccount?.address, currentEvmNetwork, currentAptosNetwork, isEvmSwitching, currentEvmChain]
  );

  /**
   * Check if user can perform an action on a specific chain
   * Centralizes all capability logic
   * 
   * Actions:
   * - 'trade': Place market orders (EVM only)
   * - 'publish': Publish signals (Aptos + Movement)
   * - 'publish_and_monetize': Publish + receive tips (Movement only)
   */
  const canPerform = useCallback((chainId, action) => {
    try {
      const chain = chains[chainId];
      if (!chain?.connected) return false;

      switch (action) {
        case 'trade':
          return chainId === 'evm';
        case 'publish':
          return chainId === 'aptos' || chainId === 'movement';
        case 'publish_and_monetize':
          return chainId === 'movement';
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
   * Check if ANY signal-publishing chain is connected (Aptos or Movement)
   * Useful for "can you publish at all?" checks
   * Always returns a boolean, never undefined
   */
  const canPublish = useMemo(
    () => {
      try {
        return canPerform('aptos', 'publish') || canPerform('movement', 'publish');
      } catch (error) {
        console.warn('Error calculating canPublish:', error);
        return false;
      }
    },
    [canPerform]
  );

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

  /**
   * Switch to Aptos network (mainnet or testnet)
   * Uses wallet adapter's built-in changeNetwork function
   */
  const switchToAptosNetwork = useCallback(async (networkId = 'aptos-mainnet') => {
    if (!aptosWalletConnected || !aptosChangeNetwork) {
      console.warn('Aptos wallet not connected or changeNetwork not available');
      return false;
    }

    try {
      const config = NETWORK_SWITCH_CONFIGS[networkId];
      if (!config) {
        console.error('Unknown network:', networkId);
        return false;
      }

      await aptosChangeNetwork(config);
      setPreferredAptosNetwork(networkId);
      return true;
    } catch (error) {
      console.error('Failed to switch Aptos network:', error);
      return false;
    }
  }, [aptosWalletConnected, aptosChangeNetwork]);

  /**
   * Switch to Movement network (mainnet or testnet)
   * Uses wallet adapter's built-in changeNetwork function
   */
  const switchToMovementNetwork = useCallback(async (networkId = 'movement-testnet') => {
    if (!aptosWalletConnected || !aptosChangeNetwork) {
      console.warn('Aptos wallet not connected or changeNetwork not available');
      return false;
    }

    try {
      const config = NETWORK_SWITCH_CONFIGS[networkId];
      if (!config) {
        console.error('Unknown network:', networkId);
        return false;
      }

      await aptosChangeNetwork(config);
      setPreferredMovementNetwork(networkId);
      return true;
    } catch (error) {
      console.error('Failed to switch Movement network:', error);
      return false;
    }
  }, [aptosWalletConnected, aptosChangeNetwork]);

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
    
    // Network switching
    switchToEvmNetwork,
    switchToAptosNetwork,      // ✅ New: Switch to Aptos
    switchToMovementNetwork,   // ✅ New: Switch to Movement
    getActionGuidance,

    // Legacy: Keep for gradual migration (deprecated)
    // Remove after all consumers updated
    isConnected: evmConnected,
    aptosConnected: aptosWalletConnected,
  };
}
