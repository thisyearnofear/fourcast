'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import { ARC_EXPLORER_TX } from '@/constants/appConstants';
import GlowList from '@/components/ui/GlowList';

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

  const textColor = 'text-[var(--color-ink)]';
  const subtleText = 'text-[var(--color-ink-muted)]';
  const cardBg = 'bg-[var(--color-paper-raised)]';

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

  // No-wallet: one clear empty — skip filter chrome and duplicate page title.
  if (!walletAddress && !loading) {
    return (
      <div className="positions-workbench border-t border-[var(--color-rule)] pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-md">
            <p className="mc-kicker">Public book</p>
            <p className={`mt-1.5 text-sm ${textColor}`}>
              Connect an EVM wallet to see venue positions after you act on Markets.
            </p>
            <p className={`mt-2 text-xs ${subtleText}`}>
              Size that must stay hidden → nav Private (privacy proof · CBTC). Not this wallet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/markets" className="fc-action px-3 py-2 text-xs no-underline">
              Browse markets
            </Link>
            <Link
              href="/proof?chain=canton"
              className="border border-[var(--color-rule)] px-3 py-2 text-xs text-[var(--color-ink-muted)] no-underline transition-colors hover:border-[var(--color-rule-strong)] hover:text-[var(--color-ink)]"
            >
              See privacy proof
            </Link>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-4 py-4">
          <Wallet className="h-4 w-4 shrink-0 text-[var(--color-ink-faint)]" aria-hidden />
          <p className={`text-xs ${subtleText}`}>
            Use <span className="text-[var(--color-ink)]">Connect Wallet</span> in the header, then return here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-readable positions-workbench space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="mc-kicker">Public book</p>
        <button
          type="button"
          onClick={fetchPositions}
          disabled={loading}
          className="flex-shrink-0 border border-[var(--color-rule-strong)] bg-[var(--color-paper-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Refresh positions"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>
      {/* Summary Cards */}
      {summary && (
        <div className="evidence-strip grid grid-cols-2 gap-px bg-[var(--color-paper-soft)] sm:grid-cols-4">
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
      <div className={`inline-flex p-1 bg-[var(--color-paper-raised)]`}>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setSelectedFilter(f)}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              selectedFilter === f
                ? 'bg-white/20 text-[var(--color-ink)] border border-[var(--color-rule-strong)]'
                : `${subtleText} hover:opacity-80`
            }`}
          >
            {f === 'all' ? 'All' : f === 'OPEN' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>
      {/* Error */}
      {error && (
        <div className={`text-xs p-3 bg-[var(--color-breach)]/10 text-[var(--color-breach)]`}>
          {error}
        </div>
      )}
      {/* Loading */}
      {loading && walletAddress && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-28 skeleton`} />
          ))}
        </div>
      )}
      {/* Empty State */}
      {!loading && !error && walletAddress && positions.length === 0 && (
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-4 py-6">
          <p className={`text-sm ${textColor}`}>
            No {selectedFilter !== 'all' ? `${selectedFilter.toLowerCase()} ` : ''}positions on this address.
          </p>
          <p className={`mt-1 text-xs ${subtleText}`}>
            Act on Markets first. Hidden size and CBTC settle live on Private.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/markets" className="fc-action px-3 py-2 text-xs no-underline">
              Markets
            </Link>
            <Link
              href="/proof?chain=canton"
              className="border border-[var(--color-rule)] px-3 py-2 text-xs text-[var(--color-ink-muted)] no-underline hover:text-[var(--color-ink)]"
            >
              See privacy proof
            </Link>
          </div>
        </div>
      )}
      {/* Position Cards — GlowList progressive disclosure */}
      {!loading && visiblePositions.length > 0 && (
        <GlowList
          count={visiblePositions.length}
          label="position"
          defaultOpen={false}
          renderSummary={() => (
            <span className="inline-flex items-center rounded-full bg-field px-2 py-0.5 text-[10px] font-medium text-ink-faint shadow-hairline">
              {selectedFilter === 'OPEN' ? 'Open' : selectedFilter === 'CLOSED' ? 'Closed' : 'All'}
            </span>
          )}
          emptyLabel={`No ${selectedFilter.toLowerCase()} positions`}
        >
          <div className="mt-2 border-t border-[var(--color-rule)]">
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
              className="w-full border border-[var(--color-rule)] bg-[var(--color-paper-raised)] py-2.5 text-sm font-medium text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-paper-soft)]"
            >
              Show More ({positions.length - visibleCount} remaining)
            </button>
          )}
          </div>
        </GlowList>
      )}
    </div>
  );
}

function StatCard({ label, value, isNight, accent = true }) {
  const textColor = 'text-[var(--color-ink)]';
  const subtleText = 'text-[var(--color-ink-muted)]';
  const accentColor = accent
    ? 'text-[var(--color-accent)]'
    : 'text-[var(--color-breach)]';

  // P&L values get colored accent (green for profit, red for loss)
  const isPnl = label === 'P&L';

  return (
    <div className={`fc-metric p-3 ${isPnl && typeof value === 'number' && value > 0 ? 'border-[var(--color-accent)]/20' : ''}`}>
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
    ? 'text-[var(--color-accent)]'
    : position.side === 'BUY NO'
      ? 'text-[var(--color-breach)]'
      : textColor;

  return (
    <article className={`position-record border-b border-[var(--color-rule)] px-1 py-5 sm:px-3 ${
      isOpen
        ? 'border-[var(--color-evidence)]/20'
        : isProfitable
          ? 'border-[var(--color-accent)]/20'
          : 'border-[var(--color-breach)]/20'
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
            ? 'bg-[var(--color-evidence)]/20 text-[var(--color-evidence)] border-[var(--color-evidence)]/30'
            : isProfitable
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/30'
              : 'bg-[var(--color-breach)]/20 text-[var(--color-breach)] border-[var(--color-breach)]/30'
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
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-rule)]">
        <div>
          <span className={`text-xs ${subtleText} block`}>
            {isOpen ? 'Current P&L' : 'Realized P&L'}
          </span>
          {isOpen ? (
            <span className={`text-sm font-mono ${textColor}`}>—</span>
          ) : (
            <span className={`text-sm font-mono ${isProfitable ? 'text-[var(--color-accent)]' : 'text-[var(--color-breach)]'}`}>
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
              className="text-[10px] font-medium text-[var(--color-accent)]/90 transition-colors hover:opacity-80"
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
              className="border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/20 px-3 py-1 text-xs font-medium text-[var(--color-breach)] transition-colors hover:bg-[var(--color-breach)]/30 disabled:cursor-not-allowed disabled:opacity-40"
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
    </article>
  );
}

export default PositionsDashboard;
