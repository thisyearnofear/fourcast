'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

const PAGE_SIZE = 10;
const MAX_LIVE_STEPS = 50;

export function AutopilotDashboard({ isNight = false }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Live SSE agent state
  const [agentRunning, setAgentRunning] = useState(false);
  const [liveSteps, setLiveSteps] = useState([]);
  const abortRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);
  const [agentConfig, setAgentConfig] = useState({
    maxMarkets: 5,
    minVolume: 10000,
    riskTolerance: 0.5,
  });
  const liveFeedRef = useRef(null);

  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';
  const mutedBg = isNight ? 'bg-white/5' : 'bg-black/5';
  const cardBg = isNight ? 'bg-slate-900/60' : 'bg-white/60';

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

  // Auto-scroll live feed
  useEffect(() => {
    if (liveFeedRef.current) {
      liveFeedRef.current.scrollTop = liveFeedRef.current.scrollHeight;
    }
  }, [liveSteps]);

  // ── Run agent with SSE streaming ──────────────────────────────────────
  const runAgent = useCallback(async () => {
    setAgentRunning(true);
    setLiveSteps([]);
    setError(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...agentConfig,
          autopilot: true,
          categories: ['all'],
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Agent failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const update = JSON.parse(line);
            setLiveSteps(prev => {
              const next = [...prev, { ...update, _ts: Date.now() }];
              return next.length > MAX_LIVE_STEPS
                ? next.slice(next.length - MAX_LIVE_STEPS)
                : next;
            });

            // Auto-refresh execution history when agent completes
            if (update.step === 'execute' && update.status === 'complete') {
              fetchExecutions();
            }
            if (update.step === 'edge' && update.status === 'complete' && update.message) {
              // Also refresh if no autopilot run but edge complete
              fetchExecutions();
            }
            if (update.step === 'error') {
              setError(update.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setAgentRunning(false);
      abortRef.current = null;
      // Final refresh of execution history
      fetchExecutions();
    }
  }, [agentConfig, fetchExecutions]);

  const stopAgent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAgentRunning(false);
  }, []);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-xl font-medium ${textColor}`}>
            🤖 Autopilot
          </h2>
          <p className={`text-xs ${subtleText} mt-1`}>
            Live agent loop progress and autonomous trade execution history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Config Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isNight
                ? 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10'
                : 'bg-black/5 hover:bg-black/10 text-black/70 border-black/10'
            }`}
            aria-label="Toggle agent config"
          >
            ⚙
          </button>
          {/* Refresh */}
          <button
            onClick={fetchExecutions}
            disabled={loading || agentRunning}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isNight
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                : 'bg-black/10 hover:bg-black/20 text-black border-black/20'
            } disabled:opacity-40`}
            aria-label="Refresh execution history"
          >
            {loading ? '⟳' : '↻'}
          </button>
          {/* Run / Stop */}
          {agentRunning ? (
            <button
              onClick={stopAgent}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30"
              aria-label="Stop agent"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              onClick={runAgent}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30"
              aria-label="Run agent"
            >
              ▶ Run Agent
            </button>
          )}
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className={`glass-subtle rounded-xl p-4 space-y-3 border ${isNight ? 'border-cyan-500/20' : 'border-cyan-200'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-medium ${textColor}`}>Agent Configuration</h3>
            <button
              onClick={() => setShowConfig(false)}
              className={`text-xs ${subtleText} hover:opacity-80`}
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={`text-[10px] ${subtleText} block mb-1`}>Max Markets</label>
              <input
                type="number"
                min={1}
                max={10}
                value={agentConfig.maxMarkets}
                onChange={e => setAgentConfig(prev => ({ ...prev, maxMarkets: parseInt(e.target.value) || 5 }))}
                className={`w-full px-2 py-1.5 rounded-lg text-xs border ${
                  isNight ? 'bg-white/5 border-white/10 text-white' : 'bg-black/5 border-black/10 text-black'
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] ${subtleText} block mb-1`}>Min Volume</label>
              <input
                type="number"
                min={1000}
                step={1000}
                value={agentConfig.minVolume}
                onChange={e => setAgentConfig(prev => ({ ...prev, minVolume: parseInt(e.target.value) || 10000 }))}
                className={`w-full px-2 py-1.5 rounded-lg text-xs border ${
                  isNight ? 'bg-white/5 border-white/10 text-white' : 'bg-black/5 border-black/10 text-black'
                }`}
              />
            </div>
            <div>
              <label className={`text-[10px] ${subtleText} block mb-1`}>Risk Tolerance</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={agentConfig.riskTolerance}
                onChange={e => setAgentConfig(prev => ({ ...prev, riskTolerance: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <div className={`text-[10px] ${subtleText} mt-0.5 text-right`}>
                {(agentConfig.riskTolerance * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Progress Feed */}
      {liveSteps.length > 0 && (
        <div className={`glass-subtle rounded-xl border ${isNight ? 'border-cyan-500/20' : 'border-cyan-200'} overflow-hidden`}>
          {/* Progress header */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isNight ? 'border-white/10' : 'border-black/10'}`}>
            <div className="flex items-center gap-2">
              {agentRunning && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <h3 className={`text-xs font-medium ${textColor}`}>
                Live Agent Progress
              </h3>
            </div>
            <span className={`text-[10px] ${subtleText}`}>
              {liveSteps.length} updates
            </span>
          </div>

          {/* Scrollable feed */}
          <div
            ref={liveFeedRef}
            className="overflow-y-auto max-h-[320px] p-2 space-y-1"
          >
            {liveSteps.map((step, i) => (
              <LiveStep key={i} step={step} isNight={isNight} textColor={textColor} subtleText={subtleText} />
            ))}
          </div>
        </div>
      )}

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
            Click <strong>Run Agent</strong> above to scan markets and execute trades automatically
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

// ── Live Step Component ─────────────────────────────────────────────────
function LiveStep({ step, isNight, textColor, subtleText }) {
  const { step: stepName, status, message, market, data } = step;

  const isComplete = status === 'complete';
  const isRunning = status === 'running';
  const isSkipped = status === 'skipped';
  const isFailed = status === 'failed';

  // Icon & color
  let icon, color;
  if (isFailed) {
    icon = '❌';
    color = isNight ? 'text-red-300 border-red-500/30 bg-red-500/10' : 'text-red-700 bg-red-50 border-red-200';
  } else if (isComplete) {
    icon = '✅';
    color = isNight ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (isSkipped) {
    icon = '⏭';
    color = isNight ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' : 'text-yellow-700 bg-yellow-50 border-yellow-200';
  } else if (isRunning) {
    icon = '⟳';
    color = isNight ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' : 'text-cyan-700 bg-cyan-50 border-cyan-200';
  } else {
    icon = '•';
    color = isNight ? 'text-white/50 border-white/10 bg-white/5' : 'text-black/50 border-black/10 bg-black/5';
  }

  // Step label
  const stepLabel = stepName?.charAt(0).toUpperCase() + stepName?.slice(1) || 'Update';

  // Market title if available
  const marketTitle = market?.title || null;

  // Progress info for forecast step
  const index = step.index;
  const total = step.total;
  const progressInfo = index != null && total != null ? `${index + 1}/${total}` : null;

  // Data summary for complete steps
  let dataSummary = null;
  if (status === 'complete' && data) {
    if (data.polymarket != null || data.kalshi != null) {
      dataSummary = `${data.polymarket || 0} Polymarket, ${data.kalshi || 0} Kalshi`;
    } else if (data.candidates) {
      dataSummary = `${data.candidates.length} candidates`;
    } else if (data.recommendations) {
      dataSummary = `${data.recommendations.length} recommendations`;
    } else if (data.executed != null) {
      dataSummary = `${data.executed} executed, ${data.failed || 0} failed`;
    }
  }

  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${color}`}>
      <span className="flex-shrink-0 w-4 text-center leading-4">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${textColor} text-[11px]`}>{stepLabel}</span>
          {progressInfo && (
            <span className={`text-[10px] font-mono ${isNight ? 'text-white/40' : 'text-black/40'}`}>
              [{progressInfo}]
            </span>
          )}
          <span className={`text-[10px] ${isNight ? 'text-white/40' : 'text-black/40'} truncate`}>
            {isComplete ? 'complete' : isRunning ? 'running…' : isSkipped ? 'skipped' : message || ''}
          </span>
        </div>
        {marketTitle && (
          <div className={`text-[10px] mt-0.5 truncate ${isNight ? 'text-white/50' : 'text-black/50'}`}>
            {marketTitle}
          </div>
        )}
        {dataSummary && (
          <div className={`text-[10px] mt-0.5 font-mono ${isNight ? 'text-white/40' : 'text-black/40'}`}>
            {dataSummary}
          </div>
        )}
      </div>
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
