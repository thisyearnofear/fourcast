'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';

// USDC has 6 decimals on most EVM chains including Arc
const USDC_DECIMALS = 6;

// ABI for the SubscriptionManager contract
const SUBSCRIPTION_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getSubscription',
    outputs: [
      { internalType: 'bool', name: 'active', type: 'bool' },
      { internalType: 'uint8', name: 'tier', type: 'uint8' },
      { internalType: 'uint256', name: 'expiresAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint8', name: 'tier', type: 'uint8' }],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint8', name: 'tier', type: 'uint8' }],
    name: 'getPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
];

// IUSDC ABI (minimal — just transferFrom + allowance + approve)
const USDC_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const USDC_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN || '';
const SUBSCRIPTION_CONTRACT = process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT || '';

export const TIERS = { NONE: 0, PRO: 1, PREMIUM: 2 };

export function useSubscription() {
  const { address, _isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [subscription, setSubscription] = useState({
    active: false,
    tier: TIERS.NONE,
    expiresAt: 0,
    loading: true,
  });
  const [txState, setTxState] = useState({
    status: 'idle', // idle | approving | approving-wallet | subscribing | confirming | success | error
    hash: null,
    error: null,
  });

  const isConfigured = !!(USDC_TOKEN_ADDRESS && SUBSCRIPTION_CONTRACT);

  // Fetch subscription status on mount and when address changes
  const refresh = useCallback(async () => {
    if (!address || !publicClient || !isConfigured) {
      setSubscription(s => ({ ...s, active: false, tier: TIERS.NONE, loading: false }));
      return;
    }

    try {
      const data = await publicClient.readContract({
        address: SUBSCRIPTION_CONTRACT,
        abi: SUBSCRIPTION_ABI,
        functionName: 'getSubscription',
        args: [address],
      });

      setSubscription({
        active: data[0],
        tier: Number(data[1]),
        expiresAt: Number(data[2]),
        loading: false,
      });
    } catch (err) {
      console.warn('Failed to fetch subscription:', err);
      setSubscription(s => ({ ...s, loading: false }));
    }
  }, [address, publicClient, isConfigured]);

  useEffect(() => { refresh(); }, [refresh]);

  // Subscribe to a tier
  const subscribe = useCallback(async (tier) => {
    if (!walletClient || !address || !publicClient || !isConfigured) {
      setTxState({ status: 'error', hash: null, error: 'Wallet not connected' });
      return;
    }

    try {
      // Step 1: Check allowance
      setTxState({ status: 'approving', hash: null, error: null });
      const allowance = await publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [address, SUBSCRIPTION_CONTRACT],
      });

      const price = tier === TIERS.PRO ? parseUnits('9.99', USDC_DECIMALS) : parseUnits('19.99', USDC_DECIMALS);

      // Step 2: Approve if needed
      if (allowance < price) {
        setTxState({ status: 'approving-wallet', hash: null, error: null });
        const approveHash = await walletClient.writeContract({
          address: USDC_TOKEN_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [SUBSCRIPTION_CONTRACT, price],
        });

        setTxState({ status: 'approving', hash: approveHash, error: null });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Step 3: Subscribe
      setTxState({ status: 'subscribing', hash: null, error: null });
      const subscribeHash = await walletClient.writeContract({
        address: SUBSCRIPTION_CONTRACT,
        abi: SUBSCRIPTION_ABI,
        functionName: 'subscribe',
        args: [tier],
      });

      setTxState({ status: 'confirming', hash: subscribeHash, error: null });
      await publicClient.waitForTransactionReceipt({ hash: subscribeHash });

      // Step 4: Success — refresh subscription
      setTxState({ status: 'success', hash: subscribeHash, error: null });
      await refresh();
    } catch (err) {
      console.error('Subscription failed:', err);
      setTxState({ status: 'error', hash: null, error: err?.message || 'Transaction failed' });
    }
  }, [walletClient, address, publicClient, isConfigured, refresh]);

  // Reset transaction state
  const resetTx = useCallback(() => {
    setTxState({ status: 'idle', hash: null, error: null });
  }, []);

  // Check if user has an active subscription (for rate limit bypass)
  const hasActiveSubscription = subscription.active && subscription.tier > TIERS.NONE;

  return {
    subscription,
    txState,
    subscribe,
    resetTx,
    refresh,
    hasActiveSubscription,
    isConfigured,
    tierName: subscription.tier === TIERS.PRO ? 'Pro' : subscription.tier === TIERS.PREMIUM ? 'Premium' : 'Free',
  };
}
