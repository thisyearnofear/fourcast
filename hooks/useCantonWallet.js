'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useCantonWallet — React hook for Canton Network wallet integration.
 *
 * Supports two connection modes (auto-selected by env config):
 * 1. Console Wallet (extension) — @console-wallet/dapp-sdk, for end-users
 * 2. Wallet SDK (direct node) — @canton-network/wallet-sdk, for dev/remote
 *
 * This is the Canton parallel to Wagmi's useAccount/useConnect hooks.
 * Canton provides private settlement (cBTC/cETH) with Daml smart contracts,
 * complementing Arc's public reputation layer.
 *
 * For the React context version (recommended), use useCantonWalletContext()
 * from app/CantonWalletLayer.js instead.
 */
export function useCantonWallet() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [balances, setBalances] = useState(null);
  const [extensionAvailable, setExtensionAvailable] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('console-wallet');
  const sdkRef = useRef(null);

  const USE_WALLET_SDK = Boolean(process.env.NEXT_PUBLIC_CANTON_LEDGER_URL);

  useEffect(() => {
    setMode(USE_WALLET_SDK ? 'wallet-sdk' : 'console-wallet');
  }, [USE_WALLET_SDK]);

  // Check extension availability on mount (Console Wallet mode only)
  useEffect(() => {
    if (USE_WALLET_SDK || typeof window === 'undefined') return;
    let cancelled = false;

    import('@console-wallet/dapp-sdk').then(({ consoleWallet }) => {
      if (cancelled) return;
      sdkRef.current = consoleWallet;
      consoleWallet.checkExtensionAvailability()
        .then((res) => { if (!cancelled) setExtensionAvailable(res?.status === 'installed'); })
        .catch(() => { if (!cancelled) setExtensionAvailable(false); });
    }).catch(() => { if (!cancelled) setExtensionAvailable(false); });

    return () => { cancelled = true; };
  }, [USE_WALLET_SDK]);

  const connect = useCallback(async (opts = {}) => {
    setConnecting(true);
    setError(null);
    try {
      if (USE_WALLET_SDK) {
        const { SDK } = await import('@canton-network/wallet-sdk');
        const sdk = await SDK.create({
          ledgerClientUrl: process.env.NEXT_PUBLIC_CANTON_LEDGER_URL,
          auth: process.env.NEXT_PUBLIC_CANTON_AUTH_CONFIG_URL ? {
            method: 'client_credentials',
            configUrl: process.env.NEXT_PUBLIC_CANTON_AUTH_CONFIG_URL,
            credentials: {
              clientId: process.env.NEXT_PUBLIC_CANTON_AUTH_CLIENT_ID,
              clientSecret: process.env.CANTON_AUTH_CLIENT_SECRET,
              audience: process.env.NEXT_PUBLIC_CANTON_AUTH_AUDIENCE,
              scope: 'openid daml_ledger_api offline_access',
            },
          } : undefined,
        });
        sdkRef.current = sdk;
        if (opts.partyId) {
          // Use a pre-allocated party (e.g. FourcastOperator)
          setAccount({ partyId: opts.partyId, partyName: opts.partyHint || opts.partyId });
        } else {
          // Allocate a new external party for end-users (the holder)
          const key = sdk.keys.generate();
          const party = await sdk.party.external.allocate(key, { partyHint: opts.partyHint || 'fourcast-user' });
          setAccount({ partyId: party, partyName: party });
        }
        setConnected(true);
      } else {
        const sdk = sdkRef.current;
        if (!sdk) { setError('Console Wallet SDK not loaded'); return; }
        const res = await sdk.connect({ name: opts.name || 'Fourcast', target: opts.target || 'combined' });
        if (res?.status === 'connected' || res === 'connected') {
          setConnected(true);
          setAccount(await sdk.getPrimaryAccount());
          setNetwork(await sdk.getActiveNetwork());
        }
      }
    } catch (e) {
      setError(e?.message || 'Failed to connect to Canton wallet');
    } finally {
      setConnecting(false);
    }
  }, [USE_WALLET_SDK]);

  const disconnect = useCallback(async () => {
    if (!USE_WALLET_SDK) {
      const sdk = sdkRef.current;
      try { await sdk?.disconnect?.(); } catch { /* ignore */ }
    }
    setConnected(false);
    setAccount(null);
    setNetwork(null);
    setBalances(null);
  }, [USE_WALLET_SDK]);

  const refreshBalances = useCallback(async () => {
    if (!account?.partyId) return;
    try {
      if (USE_WALLET_SDK) {
        const sdk = sdkRef.current;
        if (!sdk?.token) return;
        const balances = await sdk.token.holding.getHoldingBalances({ partyId: account.partyId }).catch(() => []);
        setBalances({ coins: balances });
      } else {
        const sdk = sdkRef.current;
        if (!sdk || !network) return;
        setBalances(await sdk.getCoinsBalance({ party: account.partyId, network: network.id || network }));
      }
    } catch (e) {
      setError(e?.message || 'Failed to fetch Canton balances');
    }
  }, [account, network, USE_WALLET_SDK]);

  const submitCommands = useCallback(async (opts) => {
    if (!account?.partyId) throw new Error('Canton wallet not connected');
    if (USE_WALLET_SDK) {
      const sdk = sdkRef.current;
      const prepared = await sdk.ledger.prepare({
        actAs: opts.actAs || [account.partyId],
        readAs: opts.readAs || [],
        commands: opts.commands,
        commandId: opts.commandId,
      });
      const signed = await prepared.sign();
      return sdk.ledger.execute(signed, { userId: account.partyId, partyId: account.partyId });
    }
    const sdk = sdkRef.current;
    const payload = { partyId: account.partyId, actAs: opts.actAs || [account.partyId], readAs: opts.readAs || [], commands: opts.commands, commandId: opts.commandId };
    return opts.wait ? sdk.prepareExecuteAndWait(payload) : sdk.prepareExecute(payload);
  }, [account, USE_WALLET_SDK]);

  const queryContracts = useCallback(async (templateIds = []) => {
    if (!account?.partyId) return [];
    if (USE_WALLET_SDK) {
      const sdk = sdkRef.current;
      return sdk?.ledger?.acsReader?.read({ parties: [account.partyId], templateIds }).catch(() => []) || [];
    }
    const sdk = sdkRef.current;
    if (!sdk || !network) return [];
    const res = await sdk.getContracts({ parties: [account.partyId], templateIds, network: network.id || network });
    return res?.contracts || res || [];
  }, [account, network, USE_WALLET_SDK]);

  return {
    connected, connecting, account, network, balances, extensionAvailable, error, mode,
    connect, disconnect, refreshBalances, submitCommands, queryContracts,
  };
}
