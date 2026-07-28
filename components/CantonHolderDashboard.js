'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, LogOut, RefreshCw, Shield, AlertCircle, Eye, EyeOff, Coins, CheckCircle2 } from 'lucide-react';
import { useCantonHolderWallet } from '@/hooks/useCantonHolderWallet';

const ASSETS = {
  CBTC: { symbol: 'cBTC', name: 'Canton Bitcoin' },
  CETH: { symbol: 'cETH', name: 'Canton Ethereum' },
};

function truncateCid(cid) {
  if (!cid || cid.length < 20) return cid || '—';
  return `${cid.slice(0, 16)}…${cid.slice(-8)}`;
}

export default function CantonHolderDashboard() {
  const {
    connected, accounts, primary, error, loading,
    connect, disconnect, refreshAccounts, queryContracts, disputeTransfer,
  } = useCantonHolderWallet();

  const [positions, setPositions] = useState([]);
  const [settled, setSettled] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [disputing, setDisputing] = useState({});

  const loadAll = useCallback(async () => {
    if (!connected) return;
    setQueryLoading(true);
    setQueryError(null);
    try {
      const [p, s, o] = await Promise.all([
        queryContracts([{ module: 'Fourcast.PredictionPosition', name: 'PredictionPosition' }]),
        queryContracts([{ module: 'Fourcast.PredictionPosition', name: 'PositionSettled' }]),
        queryContracts([{ module: 'Fourcast.PredictionPosition', name: 'SettlementObligation' }]),
      ]);
      setPositions(p);
      setSettled(s);
      setObligations(o);
    } catch (e) {
      setQueryError(e?.message || 'Failed to query holder contracts');
    } finally {
      setQueryLoading(false);
    }
  }, [connected, queryContracts]);

  useEffect(() => {
    if (connected) loadAll();
  }, [connected, primary?.partyId, loadAll]);

  const canDispute = Boolean(process.env.NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID);

  const handleDispute = async (contractId) => {
    setDisputing((prev) => ({ ...prev, [contractId]: true }));
    try {
      await disputeTransfer(contractId, 'Winner disputes unpaid settlement');
      await loadAll();
    } catch (e) {
      setQueryError(e?.message || 'Dispute failed');
    } finally {
      setDisputing((prev) => ({ ...prev, [contractId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet card */}
      <section className="platform-open-section p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 text-[var(--color-accent)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[var(--color-ink)]">Holder Wallet</h2>
              {connected && primary ? (
                <p className="text-[11px] text-[var(--color-ink-faint)] font-mono">
                  {primary.partyId}
                </p>
              ) : (
                <p className="text-[11px] text-[var(--color-ink-faint)]">
                  Connect Console Wallet to view private positions
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!connected ? (
              <button
                type="button"
                onClick={connect}
                disabled={loading}
                className="mc-action disabled:opacity-50"
              >
                {loading ? 'Connecting…' : 'Connect Console Wallet'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await refreshAccounts();
                    await loadAll();
                  }}
                  disabled={queryLoading}
                  className="inline-flex h-8 w-8 items-center justify-center border border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] transition-colors"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${queryLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="inline-flex items-center gap-1.5 border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/5 px-3 py-1.5 text-[11px] text-[var(--color-breach)] hover:bg-[var(--color-breach)]/10 transition-colors"
                >
                  <LogOut className="h-3 w-3" /> Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/5 p-3 text-[11px] text-[var(--color-breach)]">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Wallet connection failed</p>
                <p className="mt-0.5 opacity-80">{error}</p>
                <p className="mt-2">
                  Make sure the Console Wallet extension is installed and pointed at the HackCanton Devnet.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {connected && (
        <>
          <div className="platform-open-section p-4 text-xs leading-5 text-[var(--color-ink-muted)]">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <div>
                <p className="font-medium text-[var(--color-ink)]">
                  Holder view is read-only
                </p>
                <p>
                  Because the Daml contracts keep market creation, resolution, and settlement under operator control, a connected holder can only view their own private positions and dispute an unpaid settlement obligation.
                </p>
                {primary && (
                  <p className="mt-2 font-mono text-[var(--color-ink-faint)]">
                    Active party: {primary.hint || primary.partyId}
                  </p>
                )}
              </div>
            </div>
          </div>
          <Metrics positions={positions} settled={settled} obligations={obligations} />

          {queryError && (
            <div className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/5 p-3 text-[11px] text-[var(--color-breach)]">
              {queryError}
            </div>
          )}

          <ContractSection
            icon={<Eye className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
            title="Open positions"
            empty="No open positions visible to this party."
          >
            {positions.map((pos) => {
              const p = pos.payload || {};
              const asset = ASSETS[p.settlementAsset] || ASSETS.CBTC;
              return (
                <div
                  key={pos.contractId}
                  className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--color-ink)]">
                        {p.side} · {p.stake} {asset.symbol}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-ink-faint)] font-mono">
                        {p.marketId}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-ink-faint)]">
                      {truncateCid(pos.contractId)}
                    </span>
                  </div>
                </div>
              );
            })}
          </ContractSection>

          <ContractSection
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-evidence)]" />}
            title="Settled positions"
            empty="No settled positions visible to this party."
          >
            {settled.map((pos) => {
              const p = pos.payload || {};
              const asset = ASSETS[p.settlementAsset] || ASSETS.CBTC;
              const isWin = p.winner && p.payout > 0;
              return (
                <div
                  key={pos.contractId}
                  className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--color-ink)]">
                        {p.side} · {p.stake} {asset.symbol} → {p.payout} {asset.symbol}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-ink-faint)] font-mono">
                        {p.marketId}
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium ${isWin ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]'}`}>
                      {isWin ? 'Won' : 'Lost'}
                    </span>
                  </div>
                </div>
              );
            })}
          </ContractSection>

          <ContractSection
            icon={<Coins className="h-3.5 w-3.5 text-[var(--color-sealed)]" />}
            title="Pending payouts"
            empty="No pending obligations visible to this party."
          >
            {obligations.map((ob) => {
              const o = ob.payload || {};
              const asset = ASSETS[o.settlementAsset] || ASSETS.CBTC;
              return (
                <div
                  key={ob.contractId}
                  className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--color-ink)]">
                        {o.amount} {asset.symbol}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-ink-faint)] font-mono">
                        {o.memo || o.marketId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDispute(ob.contractId)}
                      disabled={!canDispute || disputing[ob.contractId]}
                      className="mc-action text-[10px] disabled:opacity-50"
                      title={!canDispute ? 'Set NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID to enable disputes' : ''}
                    >
                      {disputing[ob.contractId] ? 'Disputing…' : 'Dispute'}
                    </button>
                  </div>
                </div>
              );
            })}
          </ContractSection>
        </>
      )}

      {!connected && !loading && (
        <div className="platform-open-section p-6 text-center">
          <Shield className="h-6 w-6 mx-auto mb-3 text-[var(--color-accent)]/60" />
          <h3 className="text-sm font-medium text-[var(--color-ink)] mb-2">
            Why a wallet is required
          </h3>
          <p className="text-xs text-[var(--color-ink-faint)] max-w-md mx-auto leading-5">
            Canton's private prediction positions are only visible to their signatories.
            Without connecting a wallet, this page has no way to prove which contracts belong to you.
            The Console Wallet extension lets the dApp query the ledger as your specific party.
          </p>
          <p className="mt-4 text-[11px] text-[var(--color-ink-faint)] leading-5 max-w-md mx-auto">
            No extension? The <Link href="/canton" className="text-[var(--color-accent)] underline-offset-2 hover:underline">operator workbench</Link> runs
            a live two-party privacy query server-side — no wallet needed.
          </p>
        </div>
      )}
    </div>
  );
}

function Metrics({ positions, settled, obligations }) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden bg-[var(--color-paper-soft)]">
      <Metric label="Open" value={positions.length} />
      <Metric label="Settled" value={settled.length} />
      <Metric label="Payouts" value={obligations.length} />
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-[var(--color-paper)] p-3">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">{label}</div>
      <div className="text-lg font-light font-mono text-[var(--color-accent)]">{value}</div>
    </div>
  );
}

function ContractSection({ icon, title, empty, children }) {
  return (
    <section className="platform-open-section" aria-label={title}>
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="mc-kicker">{title}</span>
        </div>
      </div>
      {Array.isArray(children) && children.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--color-ink-faint)]">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}
