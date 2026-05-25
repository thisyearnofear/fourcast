'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { movePublisher } from '@/services/movePublisher';
import { publishSignalOnArc, isArcPublishConfigured } from '@/services/arcPublisher';
import { useChainConnections } from '@/hooks/useChainConnections';

/**
 * Unified signal publishing — Arc (primary) or legacy Aptos/Movement.
 * Single hook for markets, signals, and future surfaces.
 */
export function useSignalPublisher() {
  const { resolvePublishChain, chains } = useChainConnections();
  const { account, signAndSubmitTransaction, connected: aptosConnected, network } = useWallet();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);

  const publishToAptos = useCallback(
    async (signalData) => {
      if (!aptosConnected || !account) {
        setPublishError('Connect Aptos/Movement wallet for legacy publish');
        return null;
      }

      setIsPublishing(true);
      setPublishError(null);

      try {
        const payload = movePublisher.preparePublishSignalPayload(signalData, network);
        const response = await signAndSubmitTransaction({
          sender: account.address,
          data: payload,
        });
        const result = await movePublisher.waitForTransaction(response.hash, network);
        if (result.success) return response.hash;
        throw new Error(result.vm_status || 'Transaction failed');
      } catch (error) {
        console.error('Publish failed:', error);
        setPublishError(error.message || 'Failed to publish to chain');
        return null;
      } finally {
        setIsPublishing(false);
      }
    },
    [aptosConnected, account, signAndSubmitTransaction, network]
  );

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
   * Publish to the best available chain: Arc → Movement → Aptos
   */
  const publishSignal = useCallback(
    async (signalData, signalDbId) => {
      const target = resolvePublishChain();
      if (!target) {
        setPublishError('Connect a wallet to publish');
        return { txHash: null, chain: null };
      }

      if (target === 'arc') {
        const txHash = await publishToArc(signalData, signalDbId);
        return { txHash, chain: 'arc' };
      }

      const txHash = await publishToAptos(signalData);
      return { txHash, chain: target };
    },
    [resolvePublishChain, publishToArc, publishToAptos]
  );

  const tipSignal = useCallback(
    async (authorAddress, signalId, amount) => {
      if (!aptosConnected || !account) {
        throw new Error('Connect your wallet to tip');
      }
      if (
        typeof account.address === 'string' &&
        typeof authorAddress === 'string' &&
        account.address.toLowerCase() === authorAddress.toLowerCase()
      ) {
        throw new Error('You cannot tip your own signal');
      }

      const payload = movePublisher.prepareTipAnalystPayload(authorAddress, signalId, amount, network);
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload,
      });
      const result = await movePublisher.waitForTransaction(response.hash, network);
      if (result.success) return response.hash;
      throw new Error(result.vm_status || 'Tip transaction failed');
    },
    [aptosConnected, account, signAndSubmitTransaction, network]
  );

  const getMySignalCount = useCallback(async () => {
    if (!account?.address) return 0;
    return await movePublisher.getSignalCount(account.address, network);
  }, [account, network]);

  return {
    publishSignal,
    publishToAptos,
    publishToArc,
    tipSignal,
    getMySignalCount,
    isPublishing,
    publishError,
    connected: aptosConnected || evmConnected,
    walletAddress: account?.address || evmAddress,
    publishChain: resolvePublishChain(),
    arcPublishReady: isArcPublishConfigured() && chains?.arc?.connected,
  };
}
