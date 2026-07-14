'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

/**
 * CantonWalletLayer — context provider for Console Wallet (Canton Network).
 *
 * Wraps the @console-wallet/dapp-sdk in a React context so any component
 * can access Canton wallet state without prop drilling. This is the Canton
 * parallel to WagmiProvider/ConnectKitProvider for EVM chains.
 *
 * Canton provides private settlement (cBTC/cETH) with Daml smart contracts,
 * complementing Arc's public reputation layer and EVM venue execution.
 */
const CantonWalletContext = createContext(null);

export function CantonWalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [balances, setBalances] = useState(null);
  const [extensionAvailable, setExtensionAvailable] = useState(null);
  const [error, setError] = useState(null);
  const sdkRef = useRef(null);

  const getSDK = useCallback(() => sdkRef.current, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    import('@console-wallet/dapp-sdk')
      .then(({ consoleWallet }) => {
        if (cancelled) return;
        sdkRef.current = consoleWallet;
        return consoleWallet.checkExtensionAvailability();
      })
      .then((res) => {
        if (!cancelled) setExtensionAvailable(res?.status === 'installed');
      })
      .catch(() => {
        if (!cancelled) setExtensionAvailable(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Auto-reconnect if already connected from a previous session
  useEffect(() => {
    if (extensionAvailable !== true) return;
    const sdk = sdkRef.current;
    if (!sdk?.getStatus) return;

    sdk.getStatus()
      .then((status) => {
        if (status === 'connected') {
          setConnected(true);
          return Promise.all([
            sdk.getPrimaryAccount().then(setAccount).catch(() => {}),
            sdk.getActiveNetwork().then(setNetwork).catch(() => {}),
          ]);
        }
      })
      .catch(() => {});
  }, [extensionAvailable]);

  const connect = useCallback(async (opts = {}) => {
    const sdk = sdkRef.current;
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
  }, []);

  const disconnect = useCallback(async () => {
    const sdk = sdkRef.current;
    if (!sdk) return;
    try { await sdk.disconnect?.(); } catch { /* ignore */ }
    setConnected(false);
    setAccount(null);
    setNetwork(null);
    setBalances(null);
  }, []);

  const refreshBalances = useCallback(async () => {
    const sdk = sdkRef.current;
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
  }, [account, network]);

  const submitCommands = useCallback(async (opts) => {
    const sdk = sdkRef.current;
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
  }, [account]);

  const queryContracts = useCallback(async (templateIds = []) => {
    const sdk = sdkRef.current;
    if (!sdk || !account?.partyId || !network) return [];
    const res = await sdk.getContracts({
      parties: [account.partyId],
      templateIds,
      network: network.id || network,
    });
    return res?.contracts || res || [];
  }, [account, network]);

  // Listen for Canton publish events from the markets page
  useEffect(() => {
    if (!connected || !account?.partyId) return;

    const handler = async (event) => {
      const { signalData, signalId, operatorPartyId } = event.detail || {};
      if (!signalData || !operatorPartyId) return;

      try {
        const { publishPositionOnCanton } = await import('@/services/cantonPublisher');
        const result = await publishPositionOnCanton({
          cantonWallet: { connected, account, submitCommands },
          signalData,
          operatorPartyId,
          wait: true,
        });

        // Update the signal with the Canton contract ID
        if (signalId && result?.tx?.contractId) {
          await fetch('/api/signals', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: signalId,
              tx_hash: result.tx.contractId,
              chain_origin: 'CANTON',
            }),
          });
        }
      } catch (err) {
        console.error('Canton publish event failed:', err);
      }
    };

    window.addEventListener('canton:publishPosition', handler);
    return () => window.removeEventListener('canton:publishPosition', handler);
  }, [connected, account, submitCommands]);

  const value = {
    connected,
    connecting,
    account,
    network,
    balances,
    extensionAvailable,
    error,
    connect,
    disconnect,
    refreshBalances,
    submitCommands,
    queryContracts,
    getSDK,
  };

  return (
    <CantonWalletContext.Provider value={value}>
      {children}
    </CantonWalletContext.Provider>
  );
}

export function useCantonWalletContext() {
  const ctx = useContext(CantonWalletContext);
  if (!ctx) {
    throw new Error('useCantonWalletContext must be used within CantonWalletProvider');
  }
  return ctx;
}
