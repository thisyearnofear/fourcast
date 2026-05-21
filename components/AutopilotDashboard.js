'use client';

import React, { useState, useEffect, useCallback } from 'react';

const PAGE_SIZE = 10;

export function AutopilotDashboard({ isNight = false }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/executions?limit=50');
      const data = await res.json();
      if (data.success) {
        setExecutions(data.executions || []);
      } else {
        setError(data.error || 'Failed to fetch executions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // Compute stats
  const totalTrades = executions.length;
  const successfulTrades = executions.filter(e => e.execution_status === 'SUCCESS').length;
  const failedTrades = executions.filter(e => e.execution_status === 'FAILED').length;
  const successRate = totalTrades > 0 ? (successfulTrades / totalTrades * 100).toFixed(0) : '—';
  const totalSizePct = executions
    .filter(e => e.size_pct != null)
    .reduce((sum, e) => sum + e.size_pct, 0);
  const avgSizePct = totalTrades > 0 ? (totalSizePct / totalTrades * 100).toFixed(1) : '—';

  const visibleExecutions = executions.slice(0, visibleCount);
  const hasMore = visibleCount < executions.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-xl font-medium ${textColor}`}>
            🤖 Autopilot
          </h2>
          <p className={`text-xs ${subtleText} mt-1`}>
            Autonomous trade execution history — Kelly-sized orders placed by the agent
          </p>
        </div>
        <button
          onClick={fetchExecutions}
          disabled={loading}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            isNight
              ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              : 'bg-black/10 hover:bg-black/20 text-black border-black/20'
          } disabled:opacity-40`}
          aria-label="Refresh execution history"
        >
          {loading ? '⟳' : '↻'} Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Trades" value={totalTrades} isNight={isNight} />
        <StatCard label="Success Rate" value={`${successRate}%`} isNight={isNight} accent={successRate !== '—' && parseInt(successRate) > 50} />
        <StatCard label="Avg Size" value={`${avgSizePct}%`} isNight={isNight} />
        <StatCard label="Failed" value={failedTrades} isNight={isNight} accent={false} />
      </div>

      {/* Error */}
      {error && (
        <div className={`text-xs p-3 rounded-lg ${
          isNight ? 'bg-red-500/10 text-red-300' : 'bg-red-100 text-red-700'
        }`}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-24 rounded-xl ${isNight ? 'skeleton' : 'skeleton-light'}`} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && executions.length === 0 && (
        <div className={`text-center py-12 px-4 rounded-xl border ${
          isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/20'
        }`}>
          <div className="text-4xl mb-3 opacity-40">🤖</div>
          <p className={`text-sm ${textColor} opacity-70 mb-1`}>No autopilot trades yet</p>
          <p className={`text-xs ${subtleText}`}>
            Run the agent with <code className={`px-1 py-0.5 rounded text-[10px] ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>autopilot: true</code> to execute trades automatically
          </p>
        </div>
      )}

      {/* Execution Cards */}
      {!loading && visibleExecutions.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-sm font-medium ${textColor}`}>
            Execution History ({executions.length})
          </h3>
          {visibleExecutions.map((exec, i) => (
            <ExecutionCard
              key={exec.id || i}
              exec={exec}
              isNight={isNight}
              textColor={textColor}
              subtleText={subtleText}
            />
          ))}

          {/* Load More */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${
                isNight
                  ? 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10'
                  : 'bg-black/5 hover:bg-black/10 text-black/70 border-black/10'
              }`}
            >
              Show More ({executions.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, isNight, accent = true }) {
  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';
  const accentColor = accent
    ? isNight ? 'text-green-300' : 'text-green-700'
    : isNight ? 'text-red-300' : 'text-red-700';

  return (
    <div className={`glass-subtle rounded-xl p-3 ${typeof value === 'string' && value.includes('%') && parseInt(value) > 0 && accent ? 'border-green-500/20' : ''}`}>
      <div className={`text-2xl font-light ${typeof value === 'number' ? textColor : accentColor}`}>
        {value}
      </div>
      <div className={`text-xs ${subtleText} mt-1`}>{label}</div>
    </div>
  );
}

function ExecutionCard({ exec, isNight, textColor, subtleText }) {
  const isSuccess = exec.execution_status === 'SUCCESS';
  const isFailed = exec.execution_status === 'FAILED';
  const statusIcon = isSuccess ? '✅' : isFailed ? '❌' : '⏳';
  const statusColor = isSuccess
    ? isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-100 text-green-800 border-green-200'
    : isFailed
      ? isNight ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-100 text-red-800 border-red-200'
      : isNight ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-100 text-yellow-800 border-yellow-200';

  const direction = exec.direction || '—';
  const isYes = direction === 'BUY YES';
  const directionColor = isYes
    ? isNight ? 'text-green-300' : 'text-green-700'
    : isNight ? 'text-red-300' : 'text-red-700';

  const timestamp = exec.timestamp
    ? new Date(exec.timestamp * 1000).toLocaleString()
    : '—';
  const edge = exec.edge != null ? `${exec.edge > 0 ? '+' : ''}${(exec.edge * 100).toFixed(1)}%` : '—';
  const sizePct = exec.size_pct != null ? `${(exec.size_pct * 100).toFixed(0)}%` : '—';
  const prob = exec.ai_probability != null ? `${(exec.ai_probability * 100).toFixed(1)}%` : '—';
  const odds = exec.market_odds != null ? `${(exec.market_odds * 100).toFixed(1)}%` : '—';
  const kellyPct = exec.kelly_pct != null ? `${(exec.kelly_pct * 100).toFixed(1)}%` : '—';

  return (
    <div className={`glass-subtle rounded-xl p-4 transition-all hover:scale-[1.005] ${
      isSuccess ? (isNight ? 'border-green-500/20' : 'border-green-200') : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${textColor} truncate`}>
            {exec.market_title || 'Unknown Market'}
          </h4>
          <p className={`text-xs ${subtleText} mt-0.5`}>
            {exec.market_id ? exec.market_id.slice(0, 20) + '…' : ''}
            {exec.platform ? ` · ${exec.platform}` : ''}
          </p>
        </div>
        <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>
          {statusIcon} {exec.execution_status || 'PENDING'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <span className={subtleText}>Direction</span>
          <div className={`font-medium ${directionColor} mt-0.5`}>{direction === 'BUY YES' ? 'BUY YES' : direction === 'BUY NO' ? 'BUY NO' : direction}</div>
        </div>
        <div>
          <span className={subtleText}>Size</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{sizePct}</div>
        </div>
        <div>
          <span className={subtleText}>Edge</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{edge}</div>
        </div>
        <div>
          <span className={subtleText}>Kelly</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{kellyPct}</div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t border-white/10">
        <div>
          <span className={subtleText}>AI Prob</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{prob}</div>
        </div>
        <div>
          <span className={subtleText}>Market Odds</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{odds}</div>
        </div>
        <div>
          <span className={subtleText}>Confidence</span>
          <div className={`font-medium ${textColor} mt-0.5`}>{exec.confidence || '—'}</div>
        </div>
        <div>
          <span className={subtleText}>Time</span>
          <div className={`font-medium ${textColor} mt-0.5 text-[10px]`}>{timestamp}</div>
        </div>
      </div>

      {/* Execution Response (expandable) */}
      {exec.execution_response && (
        <details className="mt-2">
          <summary className={`text-[10px] ${subtleText} cursor-pointer hover:opacity-80 transition-opacity`}>
            Response Details
          </summary>
          <pre className={`mt-1 p-2 rounded-lg text-[10px] font-mono overflow-x-auto ${
            isNight ? 'bg-white/5 text-white/50' : 'bg-black/5 text-black/50'
          }`}>
            {exec.execution_response}
          </pre>
        </details>
      )}
    </div>
  );
}

export default AutopilotDashboard;
