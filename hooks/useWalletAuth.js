'use client';

import { useCallback } from 'react';
import { useSignMessage } from 'wagmi';

// Must match services/walletAuth.js byte-for-byte.
const AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Refresh a day early so a cached token never expires mid-session.
const REFRESH_BEFORE_MS = 24 * 60 * 60 * 1000;

function authMessage(address, issuedAt) {
  return `Fourcast: authenticate ${String(address).toLowerCase()} at ${issuedAt}`;
}

function storageKey(address) {
  return `fourcast_auth_${String(address).toLowerCase()}`;
}

/**
 * useWalletAuth — sign-once wallet auth for user-scoped API calls.
 *
 * getAuthHeaders(address) returns the x-fourcast-* headers, prompting a
 * wallet signature only when no fresh cached token exists for that address.
 * Throws if the user rejects the signature.
 */
export function useWalletAuth() {
  const { signMessageAsync } = useSignMessage();

  // Non-signing peek: returns cached headers or null. Lets pages decide to
  // show a "verify wallet" button instead of auto-prompting a signature.
  const getCachedAuthHeaders = useCallback((address) => {
    if (!address) return null;
    const addr = address.toLowerCase();
    try {
      const cached = JSON.parse(localStorage.getItem(storageKey(addr)) || 'null');
      if (
        cached?.signature &&
        cached?.issuedAt &&
        Date.now() - cached.issuedAt < AUTH_MAX_AGE_MS - REFRESH_BEFORE_MS
      ) {
        return {
          'x-fourcast-address': addr,
          'x-fourcast-issued-at': String(cached.issuedAt),
          'x-fourcast-signature': cached.signature,
        };
      }
    } catch {
      // corrupt cache
    }
    return null;
  }, []);

  const getAuthHeaders = useCallback(
    async (address) => {
      if (!address) throw new Error('No wallet address');
      const addr = address.toLowerCase();

      try {
        const cached = JSON.parse(localStorage.getItem(storageKey(addr)) || 'null');
        if (
          cached?.signature &&
          cached?.issuedAt &&
          Date.now() - cached.issuedAt < AUTH_MAX_AGE_MS - REFRESH_BEFORE_MS
        ) {
          return {
            'x-fourcast-address': addr,
            'x-fourcast-issued-at': String(cached.issuedAt),
            'x-fourcast-signature': cached.signature,
          };
        }
      } catch {
        // corrupt cache — fall through to re-sign
      }

      const issuedAt = Date.now();
      const signature = await signMessageAsync({
        account: address,
        message: authMessage(addr, issuedAt),
      });

      localStorage.setItem(storageKey(addr), JSON.stringify({ issuedAt, signature }));

      return {
        'x-fourcast-address': addr,
        'x-fourcast-issued-at': String(issuedAt),
        'x-fourcast-signature': signature,
      };
    },
    [signMessageAsync]
  );

  return { getAuthHeaders, getCachedAuthHeaders };
}
