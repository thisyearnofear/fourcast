'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, LogOut, RefreshCw, Shield, AlertCircle, Eye, EyeOff, Coins, CheckCircle2, FileCheck, Hash } from 'lucide-react';
import { useCantonHolderWallet } from '@/hooks/useCantonHolderWallet';
import EduWait from '@/components/EduWait';

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
    connect, disconnect, refreshAccounts, queryContracts, settleAsHolder,
  } = useCantonHolderWallet();

  const [positions, setPositions] = useState([]);
  const [settled, setSettled] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [resolutions, setResolutions] = useState([]);
  // Per-position wallet-settle state: cid -> { status: 'busy'|'done'|'error', error?, receipt? }
  const [settleState, setSettleState] = useState({});

  const loadAll = useCallback(async () => {
    if (!connected) return;
    setQueryLoading(true);
    setQueryError(null);
    try {
      const [p, s, a, res] = await Promise.all([
        queryContracts([{ module: 'Fourcast.PredictionPosition', name: 'PredictionPosition' }]),
        queryContracts([{ module: 'Fourcast.PredictionPosition', name: 'PositionSettled' }]),
        queryContracts([{ module: 'Fourcast.Token', name: 'TokenAllocation' }]),
        queryContracts([{ module: 'Fourcast.PredictionMarket', name: 'MarketResolution' }]),
      ]);
      setPositions(p);
      setSettled(s);
      setAllocations(a);
      setResolutions(res);
    } catch (e) {
      setQueryError(e?.message || 'Failed to query holder contracts');
    } finally {
      setQueryLoading(false);
    }
  }, [connected, queryContracts]);

  useEffect(() => {
    if (connected) loadAll();
  }, [connected, primary?.partyId, loadAll]);

  const handleSettle = useCallback(async (contractId) => {
    setSettleState((s) => ({ ...s, [contractId]: { status: 'busy' } }));
    try {
      const result = await settleAsHolder(contractId);
      const receiptId = result?.updateId || result?.transaction?.updateId || result?.completionOffset || null;
      setSettleState((s) => ({ ...s, [contractId]: { status: 'done', receipt: receiptId ? String(receiptId) : null } }));
      await loadAll();
    } catch (e) {
      setSettleState((s) => ({ ...s, [contractId]: { status: 'error', error: e?.message || 'Settlement failed' } }));
    }
  }, [settleAsHolder, loadAll]);

  return (
    <div className="mobile-readable space-y-6">
      {/* Wallet card */}
      <section className="platform-open-section p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 text-[var(--color-accent)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="mc-kicker">Private · Canton</p>
              {connected && primary ? (
                <p className="mt-1 text-[11px] text-[var(--color-ink-faint)] font-mono truncate max-w-[240px]" title={primary.partyId}>
                  {primary.hint || primary.partyId}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--color-ink-muted)] max-w-sm">
                  Privacy proof needs no wallet — open Private in the nav. Holder signing lands when a CIP-0103 gateway is available.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!connected ? (
              <>
                <Link
                  href="/proof?chain=canton"
                  className="fc-action px-3 py-2 text-xs no-underline"
                >
                  Open privacy proof
                </Link>
                <details className="text-xs text-[var(--color-ink-faint)]">
                  <summary className="cursor-pointer list-none underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                    Advanced
                  </summary>
                  <button
                    type="button"
                    onClick={connect}
                    disabled={loading}
                    className="mt-2 border border-[var(--color-rule)] px-3 py-2 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-50"
                  >
                    {loading ? 'Connecting…' : 'Connect holder wallet'}
                  </button>
                </details>
              </>
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
                  Holder wallet is optional. Prefer{' '}
                  <Link href="/proof?chain=canton" className="underline underline-offset-2">
                    privacy proof
                  </Link>
                  {' '}— no wallet required.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {connected && (
        <>
          <Metrics positions={positions} settled={settled} allocations={allocations} />

          {queryError && (
            <div className="border border-[var(--color-breach)]/20 bg-[var(--color-breach)]/5 p-3 text-[11px] text-[var(--color-breach)]">
              {queryError}
            </div>
          )}

          <ContractSection
            icon={<Eye className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
            title="Open positions"
            empty="Nothing open. Positions you take land here — visible only to you and the operator."
          >
            {positions.map((pos) => {
              const p = pos.payload || {};
              const asset = ASSETS[p.settlementAsset] || ASSETS.CBTC;
              const st = settleState[pos.contractId];
              const resolved = resolutions.some((r2) => r2.payload?.marketId === p.marketId);
              return (
                <div
                  key={pos.contractId}
                  className={`fc-ledger-enter border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5 ${resolved ? 'fc-live-rail bg-[var(--color-accent)]/[0.03]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3 pl-1">
                    <div>
                      <div className="text-sm text-[var(--color-ink)]">
                        <span className="font-mono text-[var(--color-sealed)]">{p.side}</span>
                        {' · '}
                        <span className="font-mono text-[var(--color-accent)]">{p.stake} {asset.symbol}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-ink-faint)] font-mono">
                        {p.marketId}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[var(--color-ink-faint)] hidden sm:inline">
                        {truncateCid(pos.contractId)}
                      </span>
                      <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-mono ${resolved ? 'border-[var(--color-accent)]/35 text-[var(--color-accent)]' : 'border-[var(--color-rule)] text-[var(--color-ink-faint)]'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${resolved ? 'bg-[var(--color-accent)] mc-lamp--live' : 'bg-white/25'}`} style={resolved ? { display: 'inline-block', boxShadow: '0 0 8px var(--color-accent)' } : undefined} />
                        {resolved ? 'resolved' : 'awaiting resolution'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSettle(pos.contractId)}
                        disabled={st?.status === 'busy' || !resolved}
                        className={`mc-action text-[10px] disabled:opacity-40 ${resolved && st?.status !== 'busy' ? 'fc-action--pulse' : ''}`}
                        title={resolved ? 'Settle with your wallet key' : 'Awaiting market resolution'}
                      >
                        {st?.status === 'busy' ? 'Signing…' : resolved ? 'Settle' : 'Awaiting resolve'}
                      </button>
                    </div>
                  </div>
                  {st?.status === 'busy' && (
                    <EduWait
                      active
                      delayMs={0}
                      line="One signature · atomic payout"
                      className="mt-2 pl-1 text-[var(--color-sealed)]"
                    />
                  )}
                  {st?.status === 'error' && (
                    <p className="mt-2 pl-1 text-[10px] text-[var(--color-breach)]">{st.error}</p>
                  )}
                  {st?.status === 'done' && (
                    <div className="fc-settle-stamp mt-3 p-3">
                      <div className="flex items-start gap-2.5">
                        <FileCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-sealed)]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-[var(--color-sealed)]">
                            Settled · atomic
                          </p>
                          {st.receipt && (
                            <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-muted)] break-all">
                              <Hash className="mr-1 inline h-3 w-3 text-[var(--color-sealed)]/70" />
                              <span className="fc-reconciled-stamp">{st.receipt}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </ContractSection>

          <ContractSection
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-evidence)]" />}
            title="Settled positions"
            empty="No settled positions yet. Winning receipts land here — with on-ledger update ids."
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
            title="Escrowed funds"
            empty="Nothing locked. CIP-56 escrow allocations appear here as stake and payout legs are funded."
          >
            {allocations.map((al) => {
              const a = al.payload?.allocation || al.payload || {};
              const leg = a.transferLeg || {};
              const mine = leg.sender === primary?.partyId;
              return (
                <div
                  key={al.contractId}
                  className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--color-ink)]">
                        {leg.amount} {leg.instrumentId?.id || 'token'}
                        <span className="text-[var(--color-ink-faint)] ml-2">{mine ? 'your stake (locked)' : 'counterparty payout (locked)'}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-ink-faint)] font-mono">
                        {a.settlement?.settlementRef?.id}
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--color-accent)]">locked in escrow</span>
                  </div>
                </div>
              );
            })}
          </ContractSection>
        </>
      )}

      {!connected && !loading && (
        <div className="platform-open-section p-5 text-center">
          <Shield className="h-5 w-5 mx-auto mb-2 text-[var(--color-accent)]/60" />
          <h3 className="text-sm font-medium text-[var(--color-ink)] mb-1">
            Connect to claim
          </h3>
          <p className="text-xs text-[var(--color-ink-faint)] max-w-sm mx-auto leading-5">
            Private positions are only visible to signatories.
          </p>
          <p className="mt-3 text-[11px] text-[var(--color-ink-faint)]">
            Or run the{' '}
            <Link href="/proof?chain=canton" className="text-[var(--color-accent)] underline-offset-2 hover:underline">privacy check</Link>
            {' '}— no wallet needed.
          </p>
        </div>
      )}
    </div>
  );
}

function Metrics({ positions, settled, allocations }) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-soft)]">
      <Metric label="Open" value={positions.length} tone="accent" />
      <Metric label="Settled" value={settled.length} tone="sealed" />
      <Metric label="Escrowed" value={allocations.length} tone="evidence" />
    </div>
  );
}

function Metric({ label, value, tone = 'accent' }) {
  const color = {
    accent: 'text-[var(--color-accent)]',
    sealed: 'text-[var(--color-sealed)]',
    evidence: 'text-[var(--color-evidence)]',
  }[tone] || 'text-[var(--color-accent)]';
  return (
    <div className="bg-[var(--color-paper)] p-3">
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-1">{label}</div>
      <div className={`text-lg font-light font-mono tabular-nums ${color}`}>{value}</div>
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
