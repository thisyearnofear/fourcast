'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

/**
 * CantonWalletLayer — context provider for Canton Network wallet connectivity.
 *
 * Supports two connection modes:
 *
 * 1. **Console Wallet** (extension) — for end-users. Uses @console-wallet/dapp-sdk
 *    to communicate with the Console Wallet browser extension. Connects to
 *    Canton Network's default infrastructure. No server-side config needed.
 *
 * 2. **Wallet SDK** (direct node) — for dev/remote. Uses @canton-network/wallet-sdk
 *    to connect directly to a Canton participant node (NaaS provider, local Docker,
 *    or CantonNodes.com). Requires ledger URL + auth config in env vars.
 *
 * The mode is selected automatically:
 * - If NEXT_PUBLIC_CANTON_LEDGER_URL is set → Wallet SDK mode
 * - Otherwise → Console Wallet mode (extension-based)
 *
 * Canton provides private settlement (cBTC/cETH) with Daml smart contracts,
 * complementing Arc's public reputation layer and EVM venue execution.
 */
const CantonWalletContext = createContext(null);

// Wallet SDK mode config from env
const WALLET_SDK_CONFIG = {
  ledgerUrl: process.env.NEXT_PUBLIC_CANTON_LEDGER_URL || '',
  authClientId: process.env.NEXT_PUBLIC_CANTON_AUTH_CLIENT_ID || '',
  authClientSecret: process.env.CANTON_AUTH_CLIENT_SECRET || '',
  authConfigUrl: process.env.NEXT_PUBLIC_CANTON_AUTH_CONFIG_URL || '',
  authAudience: process.env.NEXT_PUBLIC_CANTON_AUTH_AUDIENCE || '',
  scanApiUrl: process.env.NEXT_PUBLIC_CANTON_SCAN_API_URL || '',
  validatorUrl: process.env.NEXT_PUBLIC_CANTON_VALIDATOR_URL || '',
  registryUrl: process.env.NEXT_PUBLIC_CANTON_REGISTRY_URL || '',
};

const USE_WALLET_SDK = Boolean(WALLET_SDK_CONFIG.ledgerUrl);

// Feature flag: Canton UI is hidden until a working connection path exists.
// Set NEXT_PUBLIC_CANTON_ENABLED=true once Console Wallet access is approved
// or Wallet SDK credentials are provisioned.
const CANTON_ENABLED = process.env.NEXT_PUBLIC_CANTON_ENABLED === 'true';

export function CantonWalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);       // { partyId, partyName }
  const [network, setNetwork] = useState(null);
  const [balances, setBalances] = useState(null);
  const [extensionAvailable, setExtensionAvailable] = useState(null);
  const [error, setError] = useState(null);
  const [mode] = useState(USE_WALLET_SDK ? 'wallet-sdk' : 'console-wallet');

  const consoleSdkRef = useRef(null);   // @console-wallet/dapp-sdk
  const walletSdkRef = useRef(null);     // @canton-network/wallet-sdk SDK instance

  const getConsoleSDK = useCallback(() => consoleSdkRef.current, []);
  const getWalletSDK = useCallback(() => walletSdkRef.current, []);

  // --- Console Wallet mode: load extension SDK ---
  useEffect(() => {
    if (USE_WALLET_SDK) return;
    if (typeof window === 'undefined') return;
    let cancelled = false;

    import('@console-wallet/dapp-sdk')
      .then(({ consoleWallet }) => {
        if (cancelled) return;
        consoleSdkRef.current = consoleWallet;
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

  // --- Console Wallet auto-reconnect ---
  useEffect(() => {
    if (USE_WALLET_SDK) return;
    if (extensionAvailable !== true) return;
    const sdk = consoleSdkRef.current;
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

  // --- Wallet SDK mode: initialize SDK on mount ---
  useEffect(() => {
    if (!USE_WALLET_SDK) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;

    (async () => {
      try {
        const { SDK } = await import('@canton-network/wallet-sdk');

        const authConfig = WALLET_SDK_CONFIG.authConfigUrl
          ? {
              auth: {
                method: 'client_credentials',
                configUrl: WALLET_SDK_CONFIG.authConfigUrl,
                credentials: {
                  clientId: WALLET_SDK_CONFIG.authClientId,
                  clientSecret: WALLET_SDK_CONFIG.authClientSecret,
                  audience: WALLET_SDK_CONFIG.authAudience,
                  scope: 'openid daml_ledger_api offline_access',
                },
              },
            }
          : {};

        const sdkOptions = {
          ledgerClientUrl: WALLET_SDK_CONFIG.ledgerUrl,
          ...authConfig,
          token: {
            validatorUrl: WALLET_SDK_CONFIG.validatorUrl,
            scanApiUrl: WALLET_SDK_CONFIG.scanApiUrl,
            auth: authConfig.auth,
            registries: WALLET_SDK_CONFIG.registryUrl
              ? [WALLET_SDK_CONFIG.registryUrl]
              : [],
          },
        };

        const sdk = await SDK.create(sdkOptions);
        if (cancelled) return;
        walletSdkRef.current = sdk;

        // List existing parties
        const parties = await sdk.party.list().catch(() => []);
        if (cancelled) return;
        if (parties.length > 0) {
          setAccount({ partyId: parties[0], partyName: parties[0] });
          setConnected(true);
        }
        setNetwork({ id: WALLET_SDK_CONFIG.ledgerUrl, name: 'Canton (Wallet SDK)' });
      } catch (e) {
        if (!cancelled) {
          setError(`Wallet SDK init failed: ${e?.message || e}`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // --- Connect ---
  const connect = useCallback(async (opts = {}) => {
    setConnecting(true);
    setError(null);

    try {
      if (USE_WALLET_SDK) {
        // Wallet SDK mode: allocate a new party or use a pre-allocated one
        const sdk = walletSdkRef.current;
        if (!sdk) throw new Error('Wallet SDK not initialized');

        if (opts.partyId) {
          // Use a pre-allocated party (e.g. FourcastOperator)
          setAccount({ partyId: opts.partyId, partyName: opts.partyHint || opts.partyId });
          setConnected(true);
        } else {
          // Allocate a new external party for end-users (the holder)
          const key = sdk.keys.generate();
          const party = await sdk.party.external.allocate(key, {
            partyHint: opts.partyHint || 'fourcast-user',
          });

          setAccount({ partyId: party, partyName: party });
          setConnected(true);
        }
      } else {
        // Console Wallet mode: connect via extension
        const sdk = consoleSdkRef.current;
        if (!sdk) {
          setError('Console Wallet SDK not loaded');
          return;
        }

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
      }
    } catch (e) {
      setError(e?.message || 'Failed to connect to Canton wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(async () => {
    if (!USE_WALLET_SDK) {
      const sdk = consoleSdkRef.current;
      if (sdk) {
        try { await sdk.disconnect?.(); } catch { /* ignore */ }
      }
    }
    setConnected(false);
    setAccount(null);
    setNetwork(null);
    setBalances(null);
  }, []);

  // --- Refresh balances ---
  const refreshBalances = useCallback(async () => {
    if (!account?.partyId) return;

    try {
      if (USE_WALLET_SDK) {
        const sdk = walletSdkRef.current;
        if (!sdk?.token) return;
        const balances = await sdk.token.holding.getHoldingBalances({
          partyId: account.partyId,
        }).catch(() => []);
        setBalances({ coins: balances });
      } else {
        const sdk = consoleSdkRef.current;
        if (!sdk || !network) return;
        const res = await sdk.getCoinsBalance({
          party: account.partyId,
          network: network.id || network,
        });
        setBalances(res);
      }
    } catch (e) {
      setError(e?.message || 'Failed to fetch Canton balances');
    }
  }, [account, network]);

  // --- Submit Daml commands ---
  const submitCommands = useCallback(async (opts) => {
    if (!account?.partyId) {
      throw new Error('Canton wallet not connected');
    }

    if (USE_WALLET_SDK) {
      const sdk = walletSdkRef.current;
      if (!sdk) throw new Error('Wallet SDK not initialized');

      // Prepare + sign + execute via Wallet SDK
      const prepared = await sdk.ledger.prepare({
        actAs: opts.actAs || [account.partyId],
        readAs: opts.readAs || [],
        commands: opts.commands,
        commandId: opts.commandId,
      });

      // Sign with the user's key
      const signed = await prepared.sign();
      const result = await sdk.ledger.execute(signed, {
        userId: account.partyId,
        partyId: account.partyId,
      });

      return { tx: { contractId: result?.completionId || result?.submissionId } };
    }

    // Console Wallet mode
    const sdk = consoleSdkRef.current;
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

  // --- Query active contracts ---
  const queryContracts = useCallback(async (templateIds = []) => {
    if (!account?.partyId) return [];

    if (USE_WALLET_SDK) {
      const sdk = walletSdkRef.current;
      if (!sdk) return [];
      const contracts = await sdk.ledger.acsReader.read({
        parties: [account.partyId],
        templateIds,
      }).catch(() => []);
      return contracts;
    }

    // Console Wallet mode
    const sdk = consoleSdkRef.current;
    if (!sdk || !network) return [];
    const res = await sdk.getContracts({
      parties: [account.partyId],
      templateIds,
      network: network.id || network,
    });
    return res?.contracts || res || [];
  }, [account, network]);

  // --- Upload DAR (Wallet SDK mode only) ---
  const uploadDar = useCallback(async (darBytes, packageId) => {
    if (!USE_WALLET_SDK) {
      throw new Error('DAR upload only available in Wallet SDK mode');
    }
    const sdk = walletSdkRef.current;
    if (!sdk) throw new Error('Wallet SDK not initialized');
    return sdk.ledger.dar.upload(darBytes, packageId);
  }, []);

  // --- Listen for Canton publish events from the markets page ---
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
    // State
    connected,
    connecting,
    account,
    network,
    balances,
    extensionAvailable,
    error,
    mode,  // 'console-wallet' | 'wallet-sdk'
    cantonEnabled: CANTON_ENABLED,
    // Actions
    connect,
    disconnect,
    refreshBalances,
    submitCommands,
    queryContracts,
    uploadDar,
    // Raw SDKs (for advanced use)
    getConsoleSDK,
    getWalletSDK,
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
