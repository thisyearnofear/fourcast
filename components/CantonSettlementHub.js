'use client';

import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Plus, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight, Hash, Eye, EyeOff, Shield, Zap, ArrowRight, Lock, Unlock, X, FileCheck, Coins } from 'lucide-react';
import { useCantonWalletContext } from '@/app/CantonWalletLayer';

/**
 * CantonSettlementHub — the operator workbench for private prediction markets.
 *
 * Shows the full lifecycle: markets → positions → resolution → settlement.
 * All operations go through the server-side ledger client (no browser extension needed).
 *
 * Design follows the platform workbench pattern: open sections with evidence rails,
 * no cards unless actionable. The settlement flow is the protagonist.
 */

const ASSETS = {
  CBTC: { symbol: 'cBTC', name: 'Canton Bitcoin', color: 'text-amber-300' },
  CETH: { symbol: 'cETH', name: 'Canton Ethereum', color: 'text-blue-300' },
};

const STATUS_STYLES = {
  open: { label: 'Open', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  resolved: { label: 'Resolved', dot: 'bg-sky-400', text: 'text-sky-300' },
  settled: { label: 'Settled', dot: 'bg-teal-400', text: 'text-teal-300' },
  expired: { label: 'Expired', dot: 'bg-white/30', text: 'text-white/40' },
};

function truncateCid(cid) {
  if (!cid || cid.length < 20) return cid || '';
  return `${cid.slice(0, 16)}...${cid.slice(-8)}`;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'UTC', timeZoneName: 'short',
    }).format(new Date(iso));
  } catch { return iso; }
}

/* ───────────────────── Create Market Panel ───────────────────── */

function CreateMarketPanel({ onCreated, onStatus }) {
  const [question, setQuestion] = useState('');
  const [asset, setAsset] = useState('CBTC');
  const [days, setDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!question.trim()) return;
    setSubmitting(true);
    setError(null);
    onStatus?.('Creating market on Canton ledger...');
    try {
      const res = await fetch('/api/canton/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          settlementAsset: asset,
          deadline: new Date(Date.now() + days * 86400000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setQuestion('');
      onStatus?.(`Market created · offset ${data.market?.completionOffset ?? '?'}`);
      onCreated?.();
    } catch (e) {
      setError(e.message);
      onStatus?.(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Prediction question</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will BTC exceed $150K by end of 2026?"
          className="mc-input w-full px-3 py-2.5 text-sm"
          disabled={submitting}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Settlement asset</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ASSETS).map(([key, { symbol, color }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAsset(key)}
                disabled={submitting}
                className={`px-3 py-2 text-xs font-medium transition-all border ${
                  asset === key
                    ? 'bg-teal-400/10 border-teal-400/30 text-teal-200'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/70'
                }`}
              >
                <span className={asset === key ? color : ''}>{symbol}</span>
                <span className="ml-1.5 opacity-50">{key === 'CBTC' ? 'Bitcoin' : 'Ethereum'}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Duration</label>
          <div className="flex items-center gap-2">
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                disabled={submitting}
                className={`flex-1 px-2 py-2 text-xs font-medium transition-all border ${
                  days === d
                    ? 'bg-teal-400/10 border-teal-400/30 text-teal-200'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/70'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="border border-red-400/20 bg-red-400/10 p-2 text-[11px] text-red-200">{error}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={submitting || !question.trim()}
        className="mc-action disabled:opacity-40 disabled:cursor-not-allowed w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        {submitting ? 'Creating...' : 'Create market on Canton'}
      </button>
    </div>
  );
}

/* ───────────────────── Market Row ───────────────────── */

function MarketRow({ market, resolution, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const payload = market.payload || market;

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white leading-snug truncate">
            {payload.question || 'Untitled market'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40 font-mono">
            <span>{payload.marketId || '—'}</span>
            <span className="h-3 w-px bg-white/10" />
            <span>{payload.settlementAsset === 'CETH' ? 'cETH' : 'cBTC'}</span>
            <span className="h-3 w-px bg-white/10" />
            <span>{formatTime(payload.createdAt)}</span>
          </div>
        </div>
        {resolution ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-sky-400/20 bg-sky-400/5 text-sky-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {resolution.payload?.outcome?.replace('Resolved', '') || 'Resolved'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-emerald-400/20 bg-emerald-400/5 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        )}
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 sm:px-5">
          <div className="border-t border-white/[0.06] pt-3 space-y-2">
            <DetailRow label="Contract ID" value={truncateCid(market.contractId)} mono />
            <DetailRow label="Deadline" value={formatTime(payload.deadline)} />
            {resolution && (
              <>
                <DetailRow label="Resolution" value={resolution.payload?.outcome} mono />
                <DetailRow label="Resolved at" value={formatTime(resolution.payload?.resolvedAt)} />
              </>
            )}
            {!resolution && onResolve && (
              <ResolveControls marketCid={market.contractId} onResolved={onResolve} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResolveControls({ marketCid, onResolved }) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  const resolve = async (outcome) => {
    setResolving(true);
    setError(null);
    try {
      const res = await fetch('/api/canton/markets/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketContractId: marketCid, outcome }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onResolved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="pt-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Resolve outcome</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => resolve('ResolvedYes')}
          disabled={resolving}
          className="flex-1 px-3 py-2 text-[11px] font-medium border border-emerald-400/20 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
        >
          YES wins
        </button>
        <button
          type="button"
          onClick={() => resolve('ResolvedNo')}
          disabled={resolving}
          className="flex-1 px-3 py-2 text-[11px] font-medium border border-red-400/20 bg-red-400/5 text-red-300 hover:bg-red-400/10 transition-colors disabled:opacity-40"
        >
          NO wins
        </button>
        <button
          type="button"
          onClick={() => resolve('Voided')}
          disabled={resolving}
          className="px-3 py-2 text-[11px] font-medium border border-white/10 bg-white/[0.03] text-white/50 hover:text-white/70 transition-colors disabled:opacity-40"
        >
          Void
        </button>
      </div>
      {error && <p className="mt-2 text-[10px] text-red-200">{error}</p>}
    </div>
  );
}

/* ───────────────────── Position Row ───────────────────── */

function PositionRow({ position, resolutions, onSettled }) {
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState(null);
  const payload = position.payload || position;

  const matchingResolution = resolutions?.find((r) =>
    r.payload?.marketId === payload.marketId
  );

  const handleSettle = async () => {
    if (!matchingResolution) return;
    setSettling(true);
    setError(null);
    try {
      const res = await fetch('/api/canton/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionContractId: position.contractId,
          resolutionContractId: matchingResolution.contractId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onSettled?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSettling(false);
    }
  };

  const outcomeLabel = payload.side === 'Yes' ? 'YES' : 'NO';
  const assetMeta = ASSETS[payload.settlementAsset] || ASSETS.CBTC;

  return (
    <div className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${payload.side === 'Yes' ? 'text-emerald-300' : 'text-red-300'}`}>
              {outcomeLabel}
            </span>
            <span className="text-[10px] text-white/40 font-mono">
              {payload.marketId}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/40 font-mono">
            <span className={assetMeta.color}>{payload.stake} {assetMeta.symbol}</span>
            <span className="h-3 w-px bg-white/10" />
            <span>Holder: {payload.holder?.split('::')[0] || '—'}</span>
          </div>
        </div>

        {matchingResolution && (
          <button
            type="button"
            onClick={handleSettle}
            disabled={settling}
            className="mc-action text-[10px] disabled:opacity-40"
          >
            {settling ? 'Settling...' : 'Settle'}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[10px] text-red-200">{error}</p>}
    </div>
  );
}

/* ───────────────────── Shared Detail Row ───────────────────── */

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 shrink-0 text-white/40">{label}</span>
      <span className={`text-white/70 truncate ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

/* ───────────────────── Settlement Hub ───────────────────── */

export default function CantonSettlementHub() {
  const canton = useCantonWalletContext();

  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [settledPositions, setSettledPositions] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Load available parties
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/canton/parties');
        const data = await res.json();
        if (data.success && data.parties.length > 0) {
          setParties(data.parties);
          setSelectedPartyId(data.parties[0].id); // Default to first party
        }
      } catch (e) {
        console.error('Failed to load parties:', e);
      }
    })();
  }, []);

  const loadAll = useCallback(async () => {
    if (!canton.connected || !selectedPartyId) return;
    setLoading(true);
    setError(null);
    try {
      const partyQuery = `?partyId=${encodeURIComponent(selectedPartyId)}`;
      const [marketsRes, resolutionsRes, positionsRes, settledRes, obligationsRes] = await Promise.all([
        fetch(`/api/canton/markets${partyQuery}`),
        fetch(`/api/canton/positions${partyQuery}&type=resolutions`),
        fetch(`/api/canton/positions${partyQuery}&type=open`),
        fetch(`/api/canton/positions${partyQuery}&type=settled`),
        fetch(`/api/canton/positions${partyQuery}&type=obligations`),
      ]);

      const [marketsData, resolutionsData, positionsData, settledData, obligationsData] = await Promise.all([
        marketsRes.json(), resolutionsRes.json(), positionsRes.json(), settledRes.json(), obligationsRes.json(),
      ]);

      setMarkets(marketsData.markets || []);
      setResolutions(resolutionsData.positions || []);
      setPositions(positionsData.positions || []);
      setSettledPositions(settledData.positions || []);
      setObligations(obligationsData.positions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [canton.connected, selectedPartyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Match resolutions to markets for display
  const marketsWithStatus = markets.map((m) => {
    const res = resolutions.find((r) => r.payload?.marketId === m.payload?.marketId);
    return { market: m, resolution: res };
  });

  const activeMarkets = marketsWithStatus.filter(({ resolution }) => !resolution);
  const resolvedMarkets = marketsWithStatus.filter(({ resolution }) => !!resolution);

  return (
    <div className="space-y-8">

      {/* Status strip */}
      <div className="platform-open-section">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-teal-300/80" />
              <span className="mc-kicker">Settlement hub · Canton Devnet</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Party selector */}
              {parties.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40">View as:</label>
                  <select
                    value={selectedPartyId || ''}
                    onChange={(e) => setSelectedPartyId(e.target.value)}
                    className="text-xs bg-[var(--color-paper)] border border-white/10 text-white px-2 py-1 rounded"
                  >
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name} ({party.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {status && (
                <span className="text-[10px] text-teal-300/70 font-mono">{status}</span>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${canton.connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <span className="text-[10px] text-white/50">
                  {canton.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button type="button" onClick={loadAll} disabled={loading} className="inline-flex h-7 w-7 items-center justify-center border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40" aria-label="Refresh">
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 sm:px-5">
            <p className="border border-red-400/20 bg-red-400/10 p-2 text-[11px] text-red-200">{error}</p>
          </div>
        )}

        {/* Metrics strip */}
        <div className="grid grid-cols-2 gap-px overflow-hidden bg-white/10 sm:grid-cols-5">
          <MetricCell label="Markets" value={markets.length} accent={markets.length > 0} />
          <MetricCell label="Active" value={activeMarkets.length} />
          <MetricCell label="Open positions" value={positions.length} />
          <MetricCell label="Settled" value={settledPositions.length} accent={settledPositions.length > 0} />
          <MetricCell label="Pending payouts" value={obligations.length} accent={obligations.length > 0} />
        </div>
      </div>

      {/* Create Market */}
      <section className="platform-open-section" aria-label="Create prediction market">
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-teal-300/60" />
            <span className="mc-kicker">Create prediction market</span>
          </div>
          {createOpen ? <ChevronDown className="h-4 w-4 text-white/30" /> : <ChevronRight className="h-4 w-4 text-white/30" />}
        </button>
        {createOpen && (
          <div className="border-t border-[var(--mc-rule)] px-4 py-4 sm:px-5">
            <CreateMarketPanel
              onCreated={loadAll}
              onStatus={setStatus}
            />
          </div>
        )}
      </section>

      {/* Active Markets */}
      <section className="platform-open-section" aria-label="Active prediction markets">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-emerald-300/60" />
            <span className="mc-kicker">Active markets · {activeMarkets.length}</span>
          </div>
        </div>
        {loading && markets.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-white/40">Loading markets...</div>
        ) : activeMarkets.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-white/40">
            {markets.length > 0 ? 'All markets have been resolved' : 'No markets created yet. Create one above to get started.'}
          </div>
        ) : (
          <div>
            {activeMarkets.map(({ market, resolution }) => (
              <MarketRow
                key={market.contractId}
                market={market}
                resolution={resolution}
                onResolve={loadAll}
              />
            ))}
          </div>
        )}
      </section>

      {/* Resolved Markets */}
      {resolvedMarkets.length > 0 && (
        <section className="platform-open-section" aria-label="Resolved markets">
          <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-300/60" />
              <span className="mc-kicker">Resolved markets · {resolvedMarkets.length}</span>
            </div>
          </div>
          {resolvedMarkets.map(({ market, resolution }) => (
            <MarketRow
              key={market.contractId}
              market={market}
              resolution={resolution}
            />
          ))}
        </section>
      )}

      {/* Open Positions */}
      <section className="platform-open-section" aria-label="Open prediction positions">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-teal-300/60" />
            <span className="mc-kicker">Open positions · {positions.length}</span>
            <span className="text-[9px] text-white/30 ml-1">(private — visible only to operator + holder)</span>
          </div>
        </div>
        {positions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-white/40">
            No open positions. Positions are created when a trader takes a side on a market.
          </div>
        ) : (
          positions.map((pos) => (
            <PositionRow
              key={pos.contractId}
              position={pos}
              resolutions={resolutions}
              onSettled={loadAll}
            />
          ))
        )}
      </section>

      {/* Settled Positions */}
      {settledPositions.length > 0 && (
        <section className="platform-open-section" aria-label="Settled positions">
          <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Unlock className="h-3.5 w-3.5 text-teal-300/60" />
              <span className="mc-kicker">Settled positions · {settledPositions.length}</span>
            </div>
          </div>
          {settledPositions.map((pos) => {
            const p = pos.payload || pos;
            const assetMeta = ASSETS[p.settlementAsset] || ASSETS.CBTC;
            const isWin = p.winner && p.winner === p.holder;
            return (
              <div key={pos.contractId} className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${p.side === 'Yes' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {p.side}
                      </span>
                      <span className={`text-[10px] font-mono ${isWin ? 'text-emerald-300' : 'text-white/40'}`}>
                        {isWin ? 'WON' : 'LOST'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40 font-mono">
                      {p.stake} {assetMeta.symbol} → <span className={isWin ? 'text-emerald-300' : 'text-white/40'}>{p.payout} {assetMeta.symbol}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-teal-400/20 bg-teal-400/5 text-teal-300">
                    <FileCheck className="h-2.5 w-2.5" /> Settled
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Pending Obligations */}
      {obligations.length > 0 && (
        <section className="platform-open-section" aria-label="Pending settlement obligations">
          <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-amber-300/60" />
              <span className="mc-kicker">Pending payouts · {obligations.length}</span>
            </div>
          </div>
          {obligations.map((ob) => {
            const o = ob.payload || ob;
            const assetMeta = ASSETS[o.settlementAsset] || ASSETS.CBTC;
            return (
              <div key={ob.contractId} className="border-b border-white/[0.06] last:border-b-0 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white">
                      <span className={assetMeta.color}>{o.amount} {assetMeta.symbol}</span>
                      <span className="text-white/40 ml-2">to {o.winner?.split('::')[0] || '—'}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40 font-mono">
                      {o.memo || o.marketId}
                    </div>
                  </div>
                  <a
                    href="https://consolewallet.io/develop/ledger"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mc-action text-[10px]"
                  >
                    Pay via Console Wallet
                  </a>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[10px] text-white/40 leading-5">
              Transfer cBTC/cETH to each winner via the NODERS Console Wallet, then confirm on-ledger.
              In production, CIP-56 token transfers automate this step.
            </p>
          </div>
        </section>
      )}

      {/* Not connected fallback */}
      {!canton.connected && !loading && (
        <div className="platform-open-section px-4 py-8 text-center">
          <p className="text-xs text-white/50 mb-3">
            Canton ledger not connected. The operator needs server-side OIDC credentials to access the Canton Devnet.
          </p>
          <p className="text-[10px] text-white/30 font-mono">
            Set CANTON_JSON_API_URL + OIDC credentials in .env.local
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, accent }) {
  return (
    <div className="p-3 bg-[var(--color-paper)]">
      <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className={`text-lg font-light font-mono ${accent ? 'text-teal-300' : 'text-white/80'}`}>
        {value}
      </div>
    </div>
  );
}
