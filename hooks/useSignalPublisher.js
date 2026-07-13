'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { publishSignalOnArc, isArcPublishConfigured } from '@/services/arcPublisher';
import { useChainConnections } from '@/hooks/useChainConnections';

/**
 * Signal publishing on Arc (USDC settlement layer).
 * Single hook for markets, signals, and future surfaces.
 */
export function useSignalPublisher() {
  const { resolvePublishChain, chains } = useChainConnections();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);

  const publishToArc = useCallback(
    async (signalData, signalDbId) => {
      if (!chains?.arc?.connected || !evmConnected || !evmAddress) {
        setPublishError('Switch wallet to Arc testnet (chain 5042002)');
        return null;
      }
      if (!isArcPublishConfigured()) {
        setPublishError('Arc prediction contract not deployed — set NEXT_PUBLIC_PREDICTION_RECEIPT_CONTRACT');
        return null;
      }

      setIsPublishing(true);
      setPublishError(null);

      try {
        const hash = await publishSignalOnArc({
          walletClient,
          publicClient,
          account: evmAddress,
          signalData,
          signalDbId,
        });
        return hash;
      } catch (error) {
        console.error('Arc publish failed:', error);
        setPublishError(error.message || 'Failed to publish on Arc');
        return null;
      } finally {
        setIsPublishing(false);
      }
    },
    [chains?.arc?.connected, evmConnected, evmAddress, walletClient, publicClient]
  );

  /**
   * Publish to Arc (the only settlement chain).
   */
  const publishSignal = useCallback(
    async (signalData, signalDbId) => {
      const target = resolvePublishChain();
      if (!target) {
        setPublishError('Connect a wallet on Arc to publish');
        return { txHash: null, chain: null };
      }

      const txHash = await publishToArc(signalData, signalDbId);
      return { txHash, chain: 'arc' };
    },
    [resolvePublishChain, publishToArc]
  );

  return {
    publishSignal,
    publishToArc,
    isPublishing,
    publishError,
    connected: evmConnected,
    walletAddress: evmAddress,
    publishChain: resolvePublishChain(),
    arcPublishReady: isArcPublishConfigured() && chains?.arc?.connected,
  };
}
