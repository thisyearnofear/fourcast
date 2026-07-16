'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * useCantonWallet — React hook for Canton Network integration.
 *
 * In server-side ledger mode, all operations go through our Next.js API
 * routes. No browser extension or client-side SDK is needed.
 *
 * For the React context version (recommended), use useCantonWalletContext()
 * from app/CantonWalletLayer.js instead.
 */
export function useCantonWallet() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);

  const cantonEnabled = process.env.NEXT_PUBLIC_CANTON_ENABLED === 'true';

  useEffect(() => {
    if (!cantonEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/canton/balance');
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.canton?.configured) {
          setConnected(true);
          setAccount({ partyId: data.canton.operatorPartyId, partyName: 'FourcastOperator' });
          setNetwork({ id: data.canton.network, name: `Canton ${data.canton.network}` });
        }
      } catch { /* server not reachable */ }
    })();
    return () => { cancelled = true; };
  }, [cantonEnabled]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/canton/balance');
      const data = await res.json();
      if (data.success && data.canton?.configured) {
        setConnected(true);
        setAccount({ partyId: data.canton.operatorPartyId, partyName: 'FourcastOperator' });
        setNetwork({ id: data.canton.network, name: `Canton ${data.canton.network}` });
      } else {
        setError(data.error || 'Canton ledger not configured');
      }
    } catch (e) {
      setError(e?.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setConnected(false);
    setAccount(null);
    setNetwork(null);
  }, []);

  const submitCommands = useCallback(async (opts) => {
    if (!connected) throw new Error('Canton ledger not connected');
    const cmd = opts.commands?.[0];
    if (!cmd) throw new Error('No commands');

    if (cmd.CreateCommand?.templateId?.includes('PredictionMarket')) {
      const res = await fetch('/api/canton/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd.CreateCommand.createArguments),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return { tx: { updateId: data.market?.updateId, completionOffset: data.market?.completionOffset } };
    }

    if (cmd.ExerciseCommand?.choice === 'ResolveMarket') {
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

    if (cmd.ExerciseCommand?.choice === 'Settle') {
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

    throw new Error(`Unsupported command: ${Object.keys(cmd)[0]}`);
  }, [connected]);

  const queryContracts = useCallback(async (templateIds = []) => {
    if (!connected) return [];
    const templateStr = templateIds.join(',');
    let type = 'open';
    if (templateStr.includes('PositionSettled')) type = 'settled';
    else if (templateStr.includes('SettlementObligation')) type = 'obligations';
    else if (templateStr.includes('MarketResolution')) type = 'resolutions';
    const res = await fetch(`/api/canton/positions?type=${type}`);
    const data = await res.json();
    return data.success ? (data.positions || []) : [];
  }, [connected]);

  return {
    connected, connecting, account, network, error,
    mode: 'server-ledger', cantonEnabled,
    connect, disconnect, submitCommands, queryContracts,
  };
}
