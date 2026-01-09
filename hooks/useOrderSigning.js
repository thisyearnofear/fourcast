'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';

const POLYGON_CHAIN_ID = 137;
const EXCHANGE_CONTRACT = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

const DOMAIN = {
  name: "Polymarket CTF Exchange",
  version: "1",
  chainId: POLYGON_CHAIN_ID,
  verifyingContract: EXCHANGE_CONTRACT,
};

const TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" },
  ],
};

/**
 * Custom hook for signing and submitting prediction market orders
 * 
 * Uses standard EIP-712 signing compatible with Polymarket's CTF Exchange
 */
export function useOrderSigning() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /**
   * Sign the order using the wallet client (EIP-712)
   */
  const signOrder = useCallback(async ({ tokenID, price, size, side }) => {
    if (!walletClient) throw new Error('Wallet client not available');
    if (!address) throw new Error('Wallet not connected');
    if (!tokenID) throw new Error('Token ID is required');

    // Assume we are BUYING the outcome token (Long YES or Long NO)
    // side input is 'YES' or 'NO' (used for UI), but for the Order Struct:
    // If we are paying Collateral (USDC) to buy Tokens -> Side = 0 (BUY)
    const orderSide = 0; // BUY

    // Calculate amounts (6 decimals for USDC and CTF Tokens)
    // Maker Amount (USDC to pay) = size * price
    const makerAmountVal = parseFloat(size) * parseFloat(price);
    const makerAmount = parseUnits(makerAmountVal.toFixed(6), 6);
    
    // Taker Amount (Tokens to receive) = size
    const takerAmount = parseUnits(parseFloat(size).toFixed(6), 6);

    const salt = Math.floor(Math.random() * 1000000000);
    // Use timestamp as nonce for uniqueness
    const nonce = Date.now(); 

    const order = {
      salt: BigInt(salt),
      maker: address,
      signer: address,
      taker: "0x0000000000000000000000000000000000000000", // Open order
      tokenId: BigInt(tokenID),
      makerAmount,
      takerAmount,
      expiration: BigInt(0), // GTC
      nonce: BigInt(nonce),
      feeRateBps: BigInt(0),
      side: orderSide,
      signatureType: 0 // EOA
    };

    try {
      const signature = await walletClient.signTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Order',
        message: order
      });

      return {
        order,
        signature,
        // Helper to convert BigInts to strings for JSON payload
        // Uses snake_case keys as expected by Polymarket CLOB API
        payload: {
          token_id: tokenID.toString(),
          price: price.toString(),
          side: "BUY", // CLOB API expects string "BUY" or "SELL"
          size: size.toString(),
          fee_rate_bps: 0,
          nonce: nonce,
          expiration: 0,
          signature: signature
        }
      };
    } catch (err) {
      throw new Error(`Signing failed: ${err.message}`);
    }
  }, [walletClient, address]);

  /**
   * Submit signed order to backend
   */
  const submitOrder = useCallback(async (signedData, originalMarketID) => {
    if (!address) throw new Error('Wallet not connected');

    // Client-side validation
    // const { order } = signedData;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketID: originalMarketID, // Use original Market ID (Condition ID) for backend validation
          price: signedData.payload.price,
          side: signedData.payload.side,
          size: signedData.payload.size,
          walletAddress: address,
          signedOrder: signedData.payload // This matches CLOB API requirements
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
   * Complete flow: sign → submit
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
        // Step 1: Sign order (user approves in MetaMask)
        const signedData = await signOrder(orderParams);

        // Step 2: Submit to backend
        // Pass original marketID (Condition ID) for validation, separate from Token ID
        const result = await submitOrder(signedData, orderParams.marketID);

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
    [isConnected, address, signOrder, submitOrder]
  );

  return {
    submitOrderFlow,
    signOrder,
    submitOrder,
    isSubmitting,
    error,
    success,
    isConnected,
    address,
  };
}
