'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * CantonWalletLayer — context provider for Canton Network integration.
 *
 * In server-side ledger mode (the default), all Daml commands and contract
 * queries go through our Next.js API routes, which use the direct JSON Ledger
 * API with OIDC password grant auth. No browser extension or client-side SDK
 * is needed — credentials stay server-side.
 *
 * The operator (FourcastOperator) is automatically "connected" — the server
 * has the credentials to act as that party. End-user holder parties would
 * be allocated in a future multi-party flow.
 *
 * Canton provides private settlement (cBTC/cETH) with Daml smart contracts,
 * complementing Arc's public reputation layer and EVM venue execution.
 */
const CantonWalletContext = createContext(null);

// Feature flag: Canton UI is hidden until enabled
const CANTON_ENABLED = process.env.NEXT_PUBLIC_CANTON_ENABLED === 'true';

export function CantonWalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);

  // Check server-side ledger status on mount
  useEffect(() => {
    if (!CANTON_ENABLED) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/canton/balance');
        const data = await res.json();
        if (cancelled) return;

        if (data.success && data.canton?.configured) {
          setConnected(true);
          setAccount({
            partyId: data.canton.operatorPartyId,
            partyName: 'FourcastOperator',
          });
          setNetwork({
            id: data.canton.network,
            name: `Canton ${data.canton.network}`,
          });
        }
      } catch {
        // Server not reachable — stay disconnected
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // --- Connect (server-side mode: just verify connectivity) ---
  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/canton/balance');
      const data = await res.json();

      if (data.success && data.canton?.configured) {
        setConnected(true);
        setAccount({
          partyId: data.canton.operatorPartyId,
          partyName: 'FourcastOperator',
        });
        setNetwork({
          id: data.canton.network,
          name: `Canton ${data.canton.network}`,
        });
      } else {
        setError(data.error || 'Canton ledger not configured on server');
      }
    } catch (e) {
      setError(e?.message || 'Failed to connect to Canton ledger');
    } finally {
      setConnecting(false);
    }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(async () => {
    setConnected(false);
    setAccount(null);
    setNetwork(null);
  }, []);

  // --- Submit Daml commands via API route ---
  const submitCommands = useCallback(async (opts) => {
    if (!connected) throw new Error('Canton ledger not connected');

    // Determine which API route to use based on command type
    const cmd = opts.commands?.[0];
    if (!cmd) throw new Error('No commands to submit');

    if (cmd.CreateCommand) {
      // Market or position creation
      const templateId = cmd.CreateCommand.templateId || '';
      if (templateId.includes('PredictionMarket')) {
        const res = await fetch('/api/canton/markets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd.CreateCommand.createArguments),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return { tx: { updateId: data.market?.updateId, completionOffset: data.market?.completionOffset } };
      }
      // Position creation would go through a positions POST route
      // For now, return the command for the caller to handle
      return { tx: { contractId: null }, command: cmd };
    }

    if (cmd.ExerciseCommand) {
      const { choice } = cmd.ExerciseCommand;
      if (choice === 'ResolveMarket') {
        const res = await fetch('/api/canton/markets/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketContractId: cmd.ExerciseCommand.contractId,
            outcome: cmd.ExerciseCommand.argument?.outcome,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return { tx: { updateId: data.resolution?.updateId, completionOffset: data.resolution?.completionOffset } };
      }
      if (choice === 'Settle') {
        const res = await fetch('/api/canton/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionContractId: cmd.ExerciseCommand.contractId,
            resolutionContractId: cmd.ExerciseCommand.argument?.resolutionCid,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return { tx: { updateId: data.settlement?.updateId, completionOffset: data.settlement?.completionOffset } };
      }
    }

    throw new Error(`Unsupported command type: ${Object.keys(cmd)[0]}`);
  }, [connected]);

  // --- Query active contracts via API route ---
  const queryContracts = useCallback(async (templateIds = []) => {
    if (!connected) return [];

    // Determine query type from template IDs
    const templateStr = templateIds.join(',');
    let type = 'open';
    if (templateStr.includes('PositionSettled')) type = 'settled';
    else if (templateStr.includes('SettlementObligation')) type = 'obligations';
    else if (templateStr.includes('MarketResolution')) type = 'resolutions';

    const res = await fetch(`/api/canton/positions?type=${type}`);
    const data = await res.json();
    if (!data.success) return [];
    return data.positions || [];
  }, [connected]);

  const value = {
    connected,
    connecting,
    account,
    network,
    error,
    mode: 'server-ledger',
    cantonEnabled: CANTON_ENABLED,
    connect,
    disconnect,
    submitCommands,
    queryContracts,
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
