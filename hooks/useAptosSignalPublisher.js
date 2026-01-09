'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { aptosPublisher } from '@/services/aptosPublisher';

/**
 * Custom hook for publishing signals to Aptos
 * 
 * Product Design:
 * 1. User clicks "Publish Signal" → wallet popup
 * 2. User approves → signal saves to SQLite + Aptos
 * 3. Success → shows tx_hash and explorer link
 * 4. Failure → signal still in SQLite, can retry
 * 
 * Security:
 * - No private keys in backend
 * - User wallet signs all transactions
 * - Each signal tied to user's address (reputation)
 */
export function useAptosSignalPublisher() {
    const { account, signAndSubmitTransaction, connected, network } = useWallet();
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState(null);

    /**
     * Publish signal to Aptos blockchain
     * Returns tx_hash on success, null on failure
     */
    const publishToAptos = useCallback(async (signalData) => {
        if (!connected || !account) {
            setPublishError('Please connect your Aptos wallet first');
            return null;
        }

        setIsPublishing(true);
        setPublishError(null);

        try {
            // Prepare transaction payload with current network context
            const payload = aptosPublisher.preparePublishSignalPayload(signalData, network);

            // User wallet signs and submits transaction
            const response = await signAndSubmitTransaction({
                sender: account.address,
                data: payload,
            });

            // Wait for transaction confirmation
            const result = await aptosPublisher.waitForTransaction(response.hash);

            if (result.success) {
                return response.hash;
            } else {
                throw new Error(result.vm_status || 'Transaction failed');
            }
        } catch (error) {
            console.error('Aptos publish failed:', error);
            setPublishError(error.message || 'Failed to publish to Aptos');
            return null;
        } finally {
            setIsPublishing(false);
        }
    }, [connected, account, signAndSubmitTransaction]);

    /**
     * Tip an analyst (Movement Only)
     */
    const tipSignal = useCallback(async (authorAddress, signalId, amount) => {
        if (!connected || !account) {
            throw new Error("Please connect your wallet to tip");
        }

        // Prevent tipping yourself
        if (account.address === authorAddress) {
            throw new Error("You cannot tip your own signal");
        }

        try {
            const payload = aptosPublisher.prepareTipAnalystPayload(authorAddress, signalId, amount, network);

            const response = await signAndSubmitTransaction({
                sender: account.address,
                data: payload,
            });

            // Wait for transaction confirmation
            const result = await aptosPublisher.waitForTransaction(response.hash);

            if (result.success) {
                return response.hash;
            } else {
                throw new Error(result.vm_status || 'Tip transaction failed');
            }
        } catch (error) {
            console.error("Tip failed:", error);
            throw error;
        }
    }, [connected, account, signAndSubmitTransaction]);

    /**
     * Get user's signal count
     */
    const getMySignalCount = useCallback(async () => {
        if (!account?.address) return 0;
        return await aptosPublisher.getSignalCount(account.address);
    }, [account]);

    return {
        publishToAptos,
        tipSignal,
        getMySignalCount,
        isPublishing,
        publishError,
        connected,
        walletAddress: account?.address,
    };
}
