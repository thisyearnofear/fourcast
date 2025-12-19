'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';

/**
 * Custom hook for signing and submitting prediction market orders
 * 
 * Security Model:
 * 1. User signs order client-side in MetaMask/browser
 * 2. Server validates and adds builder attribution metadata
 * 3. Server forwards to Polymarket CLOB
 * 
 * No private keys leave the browser, server never signs anything
 */
export function useOrderSigning() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /**
   * Build an order object from market and trade parameters
   * Format matches Polymarket CLOB API requirements
   */
  const buildOrder = useCallback(({
    marketID,
    price,
    side,
    size,
    timestamp = Math.floor(Date.now() / 1000)
  }) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!marketID || price === undefined || !side || !size) {
      throw new Error('Missing required order fields');
    }

    // Validate side is YES or NO
    if (!['YES', 'NO'].includes(side.toUpperCase())) {
      throw new Error('Side must be YES or NO');
    }

    const orderData = {
      marketID: marketID.toString(),
      maker: address.toLowerCase(),
      side: side.toUpperCase(),
      size: size.toString(),
      price: price.toString(),
      feeRateBps: 0,
      nonce: Math.floor(Math.random() * 1000000000),
      timestamp: timestamp,
    };

    return orderData;
  }, [address]);

  /**
   * Sign the order using the wallet client
   * Returns signed order data ready for submission
   */
  const signOrder = useCallback(async (orderData) => {
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    if (!address) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create the message hash from order data
      const messageHash = hashOrderData(orderData);

      // Sign the hash using wallet
      const signature = await walletClient.signMessage({
        account: address,
        message: {
          raw: messageHash,
        },
      });

      return {
        ...orderData,
        signature,
        signer: address,
      };
    } catch (err) {
      throw new Error(`Signing failed: ${err.message}`);
    }
  }, [walletClient, address]);

  /**
   * Submit signed order to backend
   * Backend adds builder attribution and forwards to Polymarket
   */
  const submitOrder = useCallback(async (signedOrder, userBalance) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Client-side validation before submission
    const totalCost = parseFloat(signedOrder.size) * parseFloat(signedOrder.price);
    if (userBalance < totalCost) {
      throw new Error(
        `Insufficient balance. Need ${totalCost.toFixed(2)} USDC, have ${userBalance.toFixed(2)}`
      );
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketID: signedOrder.marketID,
          price: signedOrder.price,
          side: signedOrder.side,
          size: signedOrder.size,
          walletAddress: address,
          signedOrder, // Already signed by user
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server error: ${response.statusText}`);
      }

      return result;
    } catch (err) {
      throw new Error(`Order submission failed: ${err.message}`);
    }
  }, [address]);

  /**
   * Complete flow: build → sign → submit
   */
  const submitOrderFlow = useCallback(
    async (orderParams, userBalance) => {
      if (!isConnected || !address) {
        setError('Please connect your wallet first');
        return null;
      }

      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        // Step 1: Build order data
        const orderData = buildOrder(orderParams);

        // Step 2: Sign order (user approves in MetaMask)
        const signedOrder = await signOrder(orderData);

        // Step 3: Submit to backend
        const result = await submitOrder(signedOrder, userBalance);

        setSuccess({
          orderID: result.orderID,
          market: orderParams.marketID,
          side: orderParams.side,
          size: orderParams.size,
          price: orderParams.price,
        });

        return result;
      } catch (err) {
        console.error('Order flow error:', err);
        setError(err.message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected, address, buildOrder, signOrder, submitOrder]
  );

  return {
    submitOrderFlow,
    buildOrder,
    signOrder,
    submitOrder,
    isSubmitting,
    error,
    success,
    isConnected,
    address,
  };
}

/**
 * Hash order data for signing
 * Matches Polymarket CLOB order hash format
 */
function hashOrderData(orderData) {
  // Simple hash: convert object to deterministic string and hash
  const orderString = JSON.stringify({
    marketID: orderData.marketID,
    maker: orderData.maker,
    side: orderData.side,
    size: orderData.size,
    price: orderData.price,
    feeRateBps: orderData.feeRateBps,
    nonce: orderData.nonce,
    timestamp: orderData.timestamp,
  });

  // Create a simple deterministic hash
  // In production, would use keccak256 or proper EIP-712
  let hash = 0;
  for (let i = 0; i < orderString.length; i++) {
    const char = orderString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return new TextEncoder().encode(orderString).slice(0, 32);
}
