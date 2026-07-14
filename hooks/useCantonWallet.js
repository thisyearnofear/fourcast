'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useCantonWallet — React hook for Console Wallet (Canton Network) integration.
 *
 * Wraps the @console-wallet/dapp-sdk which communicates with the Console Wallet
 * browser extension via window.postMessage. All calls are client-side only.
 *
 * This is the Canton parallel to Wagmi's useAccount/useConnect hooks.
 * Canton provides private settlement (cBTC/cETH) with Daml smart contracts,
 * complementing Arc's public reputation layer.
 */
export function useCantonWallet() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);       // { partyId, partyName, ... }
  const [network, setNetwork] = useState(null);         // { id, name, ... }
  const [balances, setBalances] = useState(null);       // { coins: [...] }
  const [extensionAvailable, setExtensionAvailable] = useState(null); // null = unknown
  const [error, setError] = useState(null);
  const sdkRef = useRef(null);

  // Lazy-load the SDK (client-side only, avoids SSR window references)
  const getSDK = useCallback(() => {
    if (!sdkRef.current && typeof window !== 'undefined') {
      import('@console-wallet/dapp-sdk').then((mod) => {
        sdkRef.current = mod.consoleWallet;
      });
    }
    return sdkRef.current;
  }, []);

  // Check extension availability on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    import('@console-wallet/dapp-sdk').then(({ consoleWallet }) => {
      sdkRef.current = consoleWallet;
      consoleWallet
        .checkExtensionAvailability()
        .then((res) => {
          if (!cancelled) {
            setExtensionAvailable(res?.status === 'installed');
          }
        })
        .catch(() => {
          if (!cancelled) setExtensionAvailable(false);
        });
    }).catch(() => {
      if (!cancelled) setExtensionAvailable(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Auto-reconnect if already connected from a previous session
  useEffect(() => {
    if (extensionAvailable !== true) return;
    const sdk = getSDK();
    if (!sdk) return;

    sdk.getStatus?.().then((status) => {
      if (status === 'connected') {
        setConnected(true);
        sdk.getPrimaryAccount().then(setAccount).catch(() => {});
        sdk.getActiveNetwork().then(setNetwork).catch(() => {});
      }
    }).catch(() => {});
  }, [extensionAvailable, getSDK]);

  const connect = useCallback(async (opts = {}) => {
    const sdk = getSDK();
    if (!sdk) {
      setError('Console Wallet SDK not loaded');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const res = await sdk.connect({
        name: opts.name || 'Fourcast',
        target: opts.target || 'combined',
      });
      if (res?.status === 'connected' || res === 'connected') {
        setConnected(true);
        const acc = await sdk.getPrimaryAccount();
        setAccount(acc);
        const net = await sdk.getActiveNetwork();
        setNetwork(net);
      }
    } catch (e) {
      setError(e?.message || 'Failed to connect to Console Wallet');
    } finally {
      setConnecting(false);
    }
  }, [getSDK]);

  const disconnect = useCallback(async () => {
    const sdk = getSDK();
    if (!sdk) return;
    try {
      await sdk.disconnect?.();
    } catch {
      // ignore — extension may already be disconnected
    }
    setConnected(false);
    setAccount(null);
    setNetwork(null);
    setBalances(null);
  }, [getSDK]);

  const refreshBalances = useCallback(async () => {
    const sdk = getSDK();
    if (!sdk || !account?.partyId || !network) return;
    try {
      const res = await sdk.getCoinsBalance({
        party: account.partyId,
        network: network.id || network,
      });
      setBalances(res);
    } catch (e) {
      setError(e?.message || 'Failed to fetch Canton balances');
    }
  }, [getSDK, account, network]);

  /**
   * Submit Daml commands to the Canton ledger via Console Wallet.
   * @param {object} opts
   * @param {string[]} opts.actAs    Acting parties (must include connected party)
   * @param {string[]} opts.readAs   Read-as parties
   * @param {object[]} opts.commands  Daml commands (create/exercise)
   * @param {string}   [opts.commandId] Optional command ID
   * @param {boolean}  [opts.wait]   If true, wait for finalization
   */
  const submitCommands = useCallback(async (opts) => {
    const sdk = getSDK();
    if (!sdk || !account?.partyId) {
      throw new Error('Canton wallet not connected');
    }
    const payload = {
      partyId: account.partyId,
      actAs: opts.actAs || [account.partyId],
      readAs: opts.readAs || [],
      commands: opts.commands,
      commandId: opts.commandId,
    };
    if (opts.wait) {
      return sdk.prepareExecuteAndWait(payload);
    }
    return sdk.prepareExecute(payload);
  }, [getSDK, account]);

  /**
   * Query active contracts on Canton for the connected party.
   * @param {string[]} templateIds  Daml template IDs to filter by
   */
  const queryContracts = useCallback(async (templateIds = []) => {
    const sdk = getSDK();
    if (!sdk || !account?.partyId || !network) return [];
    const res = await sdk.getContracts({
      parties: [account.partyId],
      templateIds,
      network: network.id || network,
    });
    return res?.contracts || res || [];
  }, [getSDK, account, network]);

  return {
    // State
    connected,
    connecting,
    account,
    network,
    balances,
    extensionAvailable,
    error,
    // Actions
    connect,
    disconnect,
    refreshBalances,
    submitCommands,
    queryContracts,
    // Raw SDK (for advanced use)
    getSDK,
  };
}
