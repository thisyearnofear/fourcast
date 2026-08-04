'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useCantonHolderWallet — thin wrapper around @canton-network/dapp-sdk.
 *
 * In Phase 1 we can only read the holder's own contracts and dispute
 * SettlementObligations, because the existing Daml gives the operator
 * exclusive control over create/resolve/settle. This still proves the
 * core Canton value prop: the holder sees contracts that non-signatories
 * cannot see at all.
 */

let sdkPromise = null;

async function loadSdk() {
  if (typeof window === 'undefined') return null;
  if (sdkPromise) return sdkPromise;
  sdkPromise = import('@canton-network/dapp-sdk').then((mod) => mod);
  return sdkPromise;
}

export function useCantonHolderWallet() {
  const [sdk, setSdk] = useState(null);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [primary, setPrimary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadSdk()
      .then((s) => {
        if (mounted.current) setSdk(s);
      })
      .catch((e) => {
        if (mounted.current) setError(e?.message || 'Failed to load Canton dApp SDK');
      });
    return () => { mounted.current = false; };
  }, []);

  const connect = useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    setError(null);
    try {
      await sdk.init();
      const result = await sdk.connect();
      if (result.isConnected) {
        const accts = await sdk.listAccounts();
        if (mounted.current) {
          setConnected(true);
          setAccounts(accts);
          setPrimary(accts.find((a) => a.primary) || accts[0] || null);
        }
      } else {
        throw new Error(result.reason || 'Wallet connection refused');
      }
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Failed to connect wallet');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [sdk]);

  const disconnect = useCallback(async () => {
    if (!sdk) return;
    await sdk.disconnect();
    if (mounted.current) {
      setConnected(false);
      setAccounts([]);
      setPrimary(null);
    }
  }, [sdk]);

  const refreshAccounts = useCallback(async () => {
    if (!sdk) return;
    try {
      const accts = await sdk.listAccounts();
      if (mounted.current) {
        setAccounts(accts);
        setPrimary(accts.find((a) => a.primary) || accts[0] || null);
      }
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Failed to refresh accounts');
    }
  }, [sdk]);

  // Listen to wallet account changes while connected.
  useEffect(() => {
    if (!sdk || !connected) return;
    let cancelled = false;
    const listener = (ev) => {
      if (cancelled) return;
      const accts = Array.isArray(ev) ? ev : [];
      setAccounts(accts);
      setPrimary(accts.find((a) => a.primary) || accts[0] || null);
    };
    sdk.onAccountsChanged(listener).catch(() => {});
    return () => {
      cancelled = true;
      sdk.removeOnAccountsChanged?.(listener).catch(() => {});
    };
  }, [sdk, connected]);

  /**
   * Query active contracts visible to the connected party for a list of templates.
   * templates: [{ module: 'Fourcast.PredictionPosition', name: 'PredictionPosition' }]
   */
  const queryContracts = useCallback(async (templates = []) => {
    if (!sdk || !connected) return [];
    const partyId = primary?.partyId || accounts[0]?.partyId;
    if (!partyId) return [];

    const end = await sdk.ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' });
    const activeAtOffset = end.offset ?? 0;

    const cumulative = templates.map(({ module, name }) => ({
      identifierFilter: {
        TemplateFilter: {
          value: {
          templateId: `#fourcast:${module}:${name}`,
          includeCreatedEventBlob: false,
        },
        },
      },
    }));

    const eventFormat = {
      filtersByParty: {
        [partyId]: { cumulative },
      },
      verbose: false,
    };

    const result = await sdk.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: { activeAtOffset, eventFormat },
    });

    if (!Array.isArray(result)) return [];
    return result.flatMap((item) => {
      const ev = item.contractEntry?.JsActiveContract?.createdEvent;
      if (!ev) return [];
      return [{ contractId: ev.contractId, templateId: ev.templateId, payload: ev.createArgument }];
    });
  }, [sdk, connected, accounts, primary]);

  /**
   * LEGACY v1 only: SettlementObligation.DisputeTransfer. The template no
   * longer exists in fourcast 2.0.0 (atomic settlement replaces obligations);
   * kept dormant for contracts created by the legacy canton 1.0.0 package.
   * Do not call for v2 obligations — there are none.
   */
  const disputeTransfer = useCallback(async (contractId, reason = 'Winner disputes non-payment') => {
    if (!sdk || !connected) throw new Error('Wallet not connected');
    const partyId = primary?.partyId || accounts[0]?.partyId;
    if (!partyId) throw new Error('No party selected');

    // Deliberately the LEGACY package-name, not NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID
    const templateId = '#canton:Fourcast.PredictionPosition:SettlementObligation';

    await sdk.prepareExecuteAndWait({
      actAs: [partyId],
      commands: [{
        ExerciseCommand: {
          templateId,
          contractId,
          choice: 'DisputeTransfer',
          argument: { reason },
        },
      }],
    });
  }, [sdk, connected, accounts, primary]);

  /**
   * Settle one of the holder's own positions WITH THE HOLDER'S OWN KEY
   * (v2 sovereignty lane — Daml choice SettleAsHolder).
   *
   * The server assembles the exact command payload (resolution cid, both
   * escrowed CIP-56 allocation cids, choice contexts, disclosed contracts);
   * this wallet signs and submits it. The server never signs — the economic
   * authorization comes from the holder's key, which is the whole point.
   *
   * resolutionContractId may be omitted; the prepare endpoint discovers it
   * from the position's market. Resolves to the ledger completion
   * (updateId / completionOffset) on success.
   */
  const settleAsHolder = useCallback(async (positionContractId, resolutionContractId) => {
    if (!sdk || !connected) throw new Error('Wallet not connected');
    const partyId = primary?.partyId || accounts[0]?.partyId;
    if (!partyId) throw new Error('No party selected');

    const res = await fetch('/api/canton/settle/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionContractId, resolutionContractId, holderPartyId: partyId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to prepare settlement');

    const { actAs, commands, disclosedContracts } = data.submission;
    return sdk.prepareExecuteAndWait({
      actAs,
      commands,
      ...(Array.isArray(disclosedContracts) && disclosedContracts.length
        ? { disclosedContracts }
        : {}),
    });
  }, [sdk, connected, accounts, primary]);

  return {
    connected,
    accounts,
    primary,
    error,
    loading,
    connect,
    disconnect,
    refreshAccounts,
    queryContracts,
    disputeTransfer,
    settleAsHolder,
  };
}
