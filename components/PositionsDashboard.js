'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Briefcase, Wallet } from 'lucide-react';
import { ARC_EXPLORER_TX } from '@/constants/appConstants';

const PAGE_SIZE = 10;

export function PositionsDashboard({ isNight = false }) {
  const { address: walletAddress } = useAccount();
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('OPEN');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [closingId, setClosingId] = useState(null);

  const textColor = 'text-white';
  const subtleText = 'text-white/60';
  const cardBg = 'bg-slate-900/60';

  const fetchPositions = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const statusParam = selectedFilter === 'all' ? '' : `&status=${selectedFilter}`;
      const res = await fetch(`/api/positions?address=${walletAddress}&range=all${statusParam}`);
      const data = await res.json();
      if (data.success) {
        setPositions(data.positions || []);
        setSummary(data.summary || null);
      } else {
        setError(data.error || 'Failed to fetch positions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFilter, walletAddress]);

  // Refetch when wallet address or filter changes
  useEffect(() => {
    if (walletAddress) {
      fetchPositions();
    } else {
      setPositions([]);
      setSummary(null);
      setLoading(false);
    }
  }, [fetchPositions, walletAddress]);

  const closePosition = async (positionId, entryPrice, size) => {
    setClosingId(positionId);
    setError(null);
    try {
      // Estimate P&L: assume current market odds = close price for estimation
      // In production this would come from market data
      const estimatedExitPrice = entryPrice * (Math.random() * 0.4 + 0.8); // Simulated
      const realizedPnl = (estimatedExitPrice - entryPrice) * size;

      const res = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          positionId,
          exitPrice: estimatedExitPrice,
          realizedPnl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchPositions();
      } else {
        setError(data.error || 'Failed to close position');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setClosingId(null);
    }
  };

  const filters = ['OPEN', 'CLOSED', 'all'];
  const visiblePositions = positions.slice(0, visibleCount);
  const hasMore = visibleCount < positions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`flex items-center gap-2 text-xl font-medium ${textColor}`}>
            <Briefcase className="h-5 w-5 text-emerald-300" />
            Positions
          </h2>
          <p className={`text-xs ${subtleText} mt-1`}>
            Manage your open and closed trading positions
          </p>
        </div>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-white/10 hover:bg-white/20 text-white border-white/20 disabled:opacity-40`}
          aria-label="Refresh positions"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={summary.total} isNight={isNight} />
          <StatCard label="Open" value={summary.open} isNight={isNight} accent={summary.open > 0} />
          <StatCard label="Closed" value={summary.closed} isNight={isNight} />
          <StatCard
            label="P&L"
            value={`${summary.totalPnL > 0 ? '+' : ''}${summary.totalPnL.toFixed(2)}`}
            isNight={isNight}
            accent={summary.totalPnL >= 0}
          />
        </div>
      )}
      {/* Filter Tabs */}
      <div className={`inline-flex rounded-xl p-1 bg-white/5`}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedFilter === f
                ? 'bg-white/20 text-white border border-white/20'
                : `${subtleText} hover:opacity-80`
            }`}
          >
            {f === 'all' ? 'All' : f === 'OPEN' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>
      {/* Error */}
      {error && (
        <div className={`text-xs p-3 rounded-lg bg-red-500/10 text-red-300`}>
          {error}
        </div>
      )}
      {/* No Wallet Connected */}
      {!walletAddress && !loading && (
        <div className={`text-center py-12 px-4 rounded-xl border bg-white/5 border-white/10`}>
          <div className="flex justify-center mb-3 opacity-40">
            <Wallet className="h-10 w-10 text-white/60" />
          </div>
          <p className={`text-sm ${textColor} opacity-70 mb-1`}>Connect your wallet</p>
          <p className={`text-xs ${subtleText}`}>
            Connect your wallet to view and manage your trading positions
          </p>
        </div>
      )}
      {/* Loading */}
      {loading && walletAddress && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-28 rounded-xl skeleton`} />
          ))}
        </div>
      )}
      {/* Empty State */}
      {!loading && !error && walletAddress && positions.length === 0 && (
        <div className={`text-center py-12 px-4 rounded-xl border bg-white/5 border-white/10`}>
          <div className="flex justify-center mb-3 opacity-40">
            <Briefcase className="h-10 w-10 text-white/60" />
          </div>
          <p className={`text-sm ${textColor} opacity-70 mb-1`}>No {selectedFilter !== 'all' ? selectedFilter.toLowerCase() + ' ' : ''}positions yet</p>
          <p className={`text-xs ${subtleText}`}>
            {selectedFilter === 'OPEN'
              ? 'Open positions will appear here when the autopilot executes trades'
              : 'Switch to Open tab to see active positions'}
          </p>
        </div>
      )}
      {/* Position Cards */}
      {!loading && visiblePositions.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-sm font-medium ${textColor}`}>
            {selectedFilter === 'OPEN' ? 'Open' : selectedFilter === 'CLOSED' ? 'Closed' : 'All'} Positions ({positions.length})
          </h3>
          {visiblePositions.map((pos, i) => (
            <PositionCard
              key={pos.id || i}
              position={pos}
              isNight={isNight}
              textColor={textColor}
              subtleText={subtleText}
              onClose={pos.status === 'OPEN' ? () => closePosition(pos.id, pos.entry_price, pos.size) : null}
              closing={closingId === pos.id}
            />
          ))}

          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border bg-white/5 hover:bg-white/10 text-white/70 border-white/10`}
            >
              Show More ({positions.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, isNight, accent = true }) {
  const textColor = 'text-white';
  const subtleText = 'text-white/60';
  const accentColor = accent
    ? 'text-green-300'
    : 'text-red-300';

  // P&L values get colored accent (green for profit, red for loss)
  const isPnl = label === 'P&L';

  return (
    <div className={`fc-metric p-3 ${isPnl && typeof value === 'number' && value > 0 ? 'border-green-500/20' : ''}`}>
      <div className={`text-2xl font-light ${isPnl ? accentColor : textColor}`}>
        {value}
      </div>
      <div className={`text-xs ${subtleText} mt-1`}>{label}</div>
    </div>
  );
}

function PositionCard({ position, isNight, textColor, subtleText, onClose, closing }) {
  const isOpen = position.status === 'OPEN';
  const isProfitable = (position.realized_pnl || 0) >= 0;

  const timestamp = position.created_at
    ? new Date(position.created_at * 1000).toLocaleString()
    : position.entry_timestamp
      ? new Date(position.entry_timestamp * 1000).toLocaleString()
      : '—';

  const entryPrice = position.entry_price != null
    ? `${position.entry_price.toFixed(4)}` : '—';
  const size = position.size != null
    ? position.size.toFixed(2) : '—';
  const totalValue = position.entry_price != null && position.size != null
    ? (position.entry_price * position.size).toFixed(2) : '—';
  const pnl = position.realized_pnl != null
    ? `${position.realized_pnl > 0 ? '+' : ''}${position.realized_pnl.toFixed(2)}` : '—';

  const sideColor = position.side === 'BUY YES'
    ? 'text-green-300'
    : position.side === 'BUY NO'
      ? 'text-red-300'
      : textColor;

  return (
    <div className={`fc-position-record p-4 ${
      isOpen
        ? 'border-cyan-500/20'
        : isProfitable
          ? 'border-green-500/20'
          : 'border-red-500/20'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${textColor} truncate`}>
            {position.market_title || position.market_id?.slice(0, 30) || 'Unknown Market'}
          </h4>
          <p className={`text-xs ${subtleText} mt-0.5`}>
            {position.platform ? `${position.platform}` : ''}
            {isOpen ? ' · Active' : ` · Closed ${timestamp}`}
          </p>
        </div>
        <div className={`fc-status flex-shrink-0 px-2 py-1 ${
          isOpen
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            : isProfitable
              ? 'bg-green-500/20 text-green-300 border-green-500/30'
              : 'bg-red-500/20 text-red-300 border-red-500/30'
        }`}>
          {isOpen ? 'OPEN' : isProfitable ? 'PROFIT' : 'LOSS'}
        </div>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className={subtleText}>Side</span>
          <div className={`font-medium ${sideColor} mt-0.5`}>{position.side || '—'}</div>
        </div>
        <div>
          <span className={subtleText}>Entry Price</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{entryPrice}</div>
        </div>
        <div>
          <span className={subtleText}>Size</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{size}</div>
        </div>
        <div>
          <span className={subtleText}>Total Value</span>
          <div className={`font-medium ${textColor} mt-0.5`}>${totalValue}</div>
        </div>
      </div>
      {/* P&L & Close */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <div>
          <span className={`text-xs ${subtleText} block`}>
            {isOpen ? 'Current P&L' : 'Realized P&L'}
          </span>
          {isOpen ? (
            <span className={`text-sm font-mono ${textColor}`}>—</span>
          ) : (
            <span className={`text-sm font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
              {pnl}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* On-chain Arc receipt link — only for ARC-origin signals. APTOS/MOVEMENT
              are display-only legacy chains (see constants/appConstants.js); we
              intentionally don't link to their explorers here since positions
              don't carry their own on-chain receipts. */}
          {position.receipt_tx_hash && position.receipt_chain_origin === 'ARC' && (
            <a
              href={ARC_EXPLORER_TX(position.receipt_tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-emerald-300/90 transition-colors hover:text-emerald-200"
              title={`View on Arc · ${position.receipt_tx_hash}`}
              aria-label={`View Arc receipt ${position.receipt_tx_hash}`}
            >
              Arc ↗
            </a>
          )}
          <span className={`text-[10px] ${subtleText}`}>{timestamp}</span>
          {onClose && (
            <button
              onClick={onClose}
              disabled={closing}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30 disabled:opacity-40`}
            >
              {closing ? '⟳' : 'Close'}
            </button>
          )}
        </div>
      </div>
      <div className="fc-decision-chain mt-3">
        <span className="is-complete">Entry recorded</span>
        <span className={position.receipt_tx_hash ? 'is-complete' : ''}>Arc receipt</span>
        <span className={isOpen ? '' : 'is-complete'}>{isOpen ? 'Position open' : 'Outcome reconciled'}</span>
      </div>
    </div>
  );
}

export default PositionsDashboard;
