'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BRAND } from '@/constants/brand';

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

  // Scheduled autopilot state
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [secretPrompted, setSecretPrompted] = useState(false);

  const liveFeedRef = useRef(null);

  // Track whether Bright Data was actually used during this run
  const [brightDataActive, setBrightDataActive] = useState(false);
  const [brightDataProducts, setBrightDataProducts] = useState({ serp: false, scrapingBrowser: false, webUnlocker: false });

  // Bright Data connection status (fetched once on mount)
  const [bdStatus, setBdStatus] = useState(null);

  const textColor = 'text-white';
  const subtleText = 'text-white/60';
  const mutedBg = 'bg-white/5';
  const cardBg = 'bg-slate-900/60';

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

  // Fetch persisted autopilot schedule on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchSchedule() {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const res = await fetch('/api/agent/schedule');
        const data = await res.json();
        if (!cancelled) {
          if (data.success) {
            setSchedule(data.schedule);
          } else {
            setScheduleError(data.error || 'Failed to fetch schedule');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setScheduleError(err.message);
        }
      } finally {
        if (!cancelled) {
          setScheduleLoading(false);
        }
      }
    }

    fetchSchedule();
    return () => { cancelled = true; };
  }, []);

  // Fetch Bright Data connection status on mount
  useEffect(() => {
    fetch('/api/brightdata/status')
      .then(res => res.json())
      .then(data => { if (data.success) setBdStatus(data); })
      .catch(() => {}); // silent fail, status is optional
  }, []);

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
    setBrightDataActive(false);
    setBrightDataProducts({ serp: false, scrapingBrowser: false, webUnlocker: false });

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

      // eslint-disable-next-line no-constant-condition
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

            // Detect Bright Data usage from step data
            if (update.data?.sources?.length > 0) {
              setBrightDataActive(true);
              setBrightDataProducts(prev => ({ ...prev, serp: true }));
            }
            if (update.data?.deepResearch) {
              if (update.data.deepResearch.product === 'Web Unlocker') {
                setBrightDataProducts(prev => ({ ...prev, webUnlocker: true }));
              } else {
                setBrightDataProducts(prev => ({ ...prev, scrapingBrowser: true }));
              }
            }
            if (update.data?.productsUsed) {
              setBrightDataProducts(prev => ({
                serp: prev.serp || update.data.productsUsed.serp,
                scrapingBrowser: prev.scrapingBrowser || update.data.productsUsed.scrapingBrowser,
                webUnlocker: prev.webUnlocker || update.data.productsUsed.webUnlocker,
              }));
            }
            if (update.data?.brightDataError) {
              setBrightDataActive(true);
            }

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

  // Prompt for admin secret once per session when changing schedule
  const promptForSecret = useCallback(() => {
    if (secretPrompted) return adminSecret || null;
    if (typeof window === 'undefined') return null;
    const provided = window.prompt('Enter admin secret to update schedule:');
    setSecretPrompted(true);
    if (provided === null || provided.trim() === '') {
      setScheduleError('Admin secret required to change schedule.');
      return null;
    }
    setAdminSecret(provided.trim());
    setScheduleError(null);
    return provided.trim();
  }, [adminSecret, secretPrompted]);

  // Update schedule on the server
  const saveSchedule = useCallback(async (next) => {
    setScheduleSaving(true);
    setScheduleError(null);

    const secret = promptForSecret();
    if (secret === null) {
      setScheduleSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/agent/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret,
        },
        body: JSON.stringify(next),
      });

      const data = await res.json();
      if (data.success) {
        setSchedule(data.schedule);
      } else {
        setScheduleError(data.error || 'Failed to update schedule');
      }
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduleSaving(false);
    }
  }, [promptForSecret]);

  const handleToggleSchedule = useCallback(() => {
    if (!schedule || scheduleSaving) return;
    saveSchedule({
      enabled: !schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      dryRun: schedule.dryRun,
      dailyCapPct: schedule.dailyCapPct,
    });
  }, [schedule, scheduleSaving, saveSchedule]);

  const handleIntervalChange = useCallback((e) => {
    if (!schedule || scheduleSaving) return;
    const intervalMinutes = parseInt(e.target.value, 10);
    saveSchedule({
      enabled: schedule.enabled,
      intervalMinutes,
      dryRun: schedule.dryRun,
      dailyCapPct: schedule.dailyCapPct,
    });
  }, [schedule, scheduleSaving, saveSchedule]);

  const handleDryRunToggle = useCallback(() => {
    if (!schedule || scheduleSaving) return;
    saveSchedule({
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      dryRun: !schedule.dryRun,
      dailyCapPct: schedule.dailyCapPct,
    });
  }, [schedule, scheduleSaving, saveSchedule]);

  const handleDailyCapChange = useCallback((e) => {
    if (!schedule || scheduleSaving) return;
    const value = parseFloat(e.target.value);
    if (Number.isNaN(value)) return;
    saveSchedule({
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      dryRun: schedule.dryRun,
      dailyCapPct: Math.max(0.1, Math.min(1, value)),
    });
  }, [schedule, scheduleSaving, saveSchedule]);

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
            🤖 {BRAND.labs.autopilot.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-xs ${subtleText}`}>
              {BRAND.labs.autopilot.description}
            </p>
            {(brightDataActive || !agentRunning) && brightDataActive && (
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30`}>
                {brightDataProducts.scrapingBrowser
                  ? 'Bright Data: SERP + Deep Research'
                  : brightDataProducts.serp
                    ? 'Bright Data: SERP Intelligence'
                    : 'Powered by Bright Data'}
              </span>
            )}
          </div>
          {/* Bright Data connection status */}
          {bdStatus && (
            <div className={`flex items-center gap-3 mt-1.5 text-[10px] ${subtleText}`}>
              <span className="font-medium uppercase tracking-wider">Bright Data:</span>
              <span className={bdStatus.products?.serp ? 'text-emerald-500' : 'text-red-400'}>
                {bdStatus.products?.serp ? 'SERP connected' : 'SERP not configured'}
              </span>
              <span className={bdStatus.products?.scrapingBrowser ? 'text-emerald-500' : 'text-slate-400'}>
                {bdStatus.products?.scrapingBrowser ? 'Scraping Browser connected' : 'Scraping Browser off'}
              </span>
              <span className={bdStatus.products?.webUnlocker ? 'text-emerald-500' : 'text-slate-400'}>
                {bdStatus.products?.webUnlocker ? 'Web Unlocker connected' : 'Web Unlocker off'}
              </span>
            </div>
          )}

          {/* Schedule status */}
          {!scheduleLoading && schedule && (
            <div className={`flex flex-wrap items-center gap-3 mt-1.5 text-[10px] ${subtleText}`}>
              <span className="font-medium uppercase tracking-wider">Schedule:</span>
              <span className={schedule.enabled ? 'text-emerald-500' : 'text-slate-400'}>
                {schedule.enabled
                  ? `Runs every ${schedule.intervalMinutes} minutes via Vercel Cron`
                  : 'Scheduled autopilot is disabled'}
              </span>
              {schedule.dryRun && (
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30`}>
                  Dry Run
                </span>
              )}
              {schedule.enabled && schedule.lastRunAt && (
                <span className='text-white/40'>
                  Last run: {formatRelativeTime(schedule.lastRunAt)}
                </span>
              )}
              {schedule.enabled && schedule.lastRunAt && (
                <span className='text-white/40'>
                  Next eligible run: {formatRelativeTime(schedule.lastRunAt + schedule.intervalMinutes * 60)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Config Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border bg-white/5 hover:bg-white/10 text-white/70 border-white/10`}
            aria-label="Toggle agent config"
          >
            ⚙
          </button>
          {/* Schedule Toggle */}
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all border bg-white/5 hover:bg-white/10 border-white/10 ${scheduleLoading || scheduleSaving ? 'opacity-60' : ''}`}>
            <span className={subtleText}>Schedule</span>
            <button
              onClick={handleToggleSchedule}
              disabled={scheduleLoading || scheduleSaving || !schedule}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                schedule?.enabled ? 'bg-emerald-500' : 'bg-white/20'
              } disabled:cursor-not-allowed`}
              aria-label="Toggle scheduled autopilot"
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  schedule?.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {/* Refresh */}
          <button
            onClick={fetchExecutions}
            disabled={loading || agentRunning}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-white/10 hover:bg-white/20 text-white border-white/20 disabled:opacity-40`}
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
      {/* Schedule Panel */}
      {schedule && (
        <div className={`glass-subtle rounded-xl p-4 space-y-3 border border-emerald-500/20`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-medium ${textColor}`}>Scheduled Autopilot</h3>
            {scheduleSaving && (
              <span className={`text-[10px] ${subtleText}`}>Saving…</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`text-[10px] ${subtleText} block mb-1`}>Run Interval</label>
              <select
                value={schedule.intervalMinutes}
                onChange={handleIntervalChange}
                disabled={scheduleSaving}
                className={`w-full px-2 py-1.5 rounded-lg text-xs border bg-white/5 border-white/10 text-white disabled:opacity-50`}
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 60 minutes</option>
                <option value={120}>Every 2 hours</option>
              </select>
            </div>
            <div>
              <label className={`text-[10px] ${subtleText} block mb-1`}>Daily Spend Cap (% of bankroll)</label>
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.1}
                value={schedule.dailyCapPct}
                onChange={handleDailyCapChange}
                disabled={scheduleSaving}
                className={`w-full px-2 py-1.5 rounded-lg text-xs border bg-white/5 border-white/10 text-white disabled:opacity-50`}
              />
              <p className={`text-[10px] ${subtleText} mt-1`}>
                Max {(schedule.dailyCapPct * 100).toFixed(0)}% of bankroll per day
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${subtleText}`}>Dry Run</span>
              <button
                onClick={handleDryRunToggle}
                disabled={scheduleSaving}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  schedule.dryRun ? 'bg-amber-500' : 'bg-white/20'
                } disabled:cursor-not-allowed`}
                aria-label="Toggle dry run mode"
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    schedule.dryRun ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <p className={`text-[10px] ${subtleText}`}>
              Vercel Cron fires once daily (Hobby plan limit); interval is the minimum gap between runs.
            </p>
          </div>
        </div>
      )}
      {/* Config Panel */}
      {showConfig && (
        <div className={`glass-subtle rounded-xl p-4 space-y-3 border border-cyan-500/20`}>
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
                className={`w-full px-2 py-1.5 rounded-lg text-xs border bg-white/5 border-white/10 text-white`}
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
                className={`w-full px-2 py-1.5 rounded-lg text-xs border bg-white/5 border-white/10 text-white`}
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
        <div className={`glass-subtle rounded-xl border border-cyan-500/20 overflow-hidden`}>
          {/* Progress header */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-white/10`}>
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
      {/* Schedule Error */}
      {scheduleError && (
        <div className={`text-xs p-3 rounded-lg bg-amber-500/10 text-amber-300`}>
          Schedule: {scheduleError}
        </div>
      )}
      {/* Error */}
      {error && (
        <div className={`text-xs p-3 rounded-lg bg-red-500/10 text-red-300`}>
          {error}
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-24 rounded-xl skeleton`} />
          ))}
        </div>
      )}
      {/* Empty State */}
      {!loading && !error && executions.length === 0 && (
        <div className={`text-center py-12 px-4 rounded-xl border bg-white/5 border-white/10`}>
          <div className="text-4xl mb-3 opacity-40">🤖</div>
          <p className={`text-sm ${textColor} opacity-70 mb-1`}>No autopilot trades yet</p>
          <p className={`text-xs ${subtleText}`}>
            Click <strong>Run Agent</strong> to scan markets and execute trades automatically
          </p>
          {bdStatus && !bdStatus.available && (
            <p className={`text-[10px] mt-2 text-cyan-300/50`}>
              Add Bright Data keys to enable real-time web intelligence for deeper analysis
            </p>
          )}
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
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border bg-white/5 hover:bg-white/10 text-white/70 border-white/10`}
            >
              Show More ({executions.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function formatRelativeTime(unixSeconds) {
  const seconds = Date.now() / 1000 - unixSeconds;
  const abs = Math.abs(seconds);
  const suffix = seconds < 0 ? 'from now' : 'ago';

  if (abs < 60) return `just ${suffix === 'ago' ? 'now' : suffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)} min ${suffix}`;
  if (abs < 86400) return `${Math.round(abs / 3600)} hr ${suffix}`;
  return `${Math.round(abs / 86400)} days ${suffix}`;
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
    color = 'text-red-300 border-red-500/30 bg-red-500/10';
  } else if (isComplete) {
    icon = '✅';
    color = 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  } else if (isSkipped) {
    icon = '⏭';
    color = 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
  } else if (isRunning) {
    icon = '⟳';
    color = 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
  } else {
    icon = '•';
    color = 'text-white/50 border-white/10 bg-white/5';
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

  // Extract domain from URL for cleaner display
  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${color}`}>
      <span className="flex-shrink-0 w-4 text-center leading-4">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${textColor} text-[11px]`}>{stepLabel}</span>
          {progressInfo && (
            <span className={`text-[10px] font-mono text-white/40`}>
              [{progressInfo}]
            </span>
          )}
          <span className={`text-[10px] text-white/40 truncate`}>
            {isComplete ? 'complete' : isRunning ? 'running...' : isSkipped ? 'skipped' : message || ''}
          </span>
        </div>
        {marketTitle && (
          <div className={`text-[10px] mt-0.5 truncate text-white/50`}>
            {marketTitle}
          </div>
        )}
        {dataSummary && (
          <div className={`text-[10px] mt-0.5 font-mono text-white/40`}>
            {dataSummary}
          </div>
        )}
        {/* Bright Data error indicator */}
        {data?.brightDataError && (
          <div className={`mt-1.5 p-1.5 rounded border text-[9px] bg-amber-500/10 border-amber-500/20 text-amber-200`}>
            <span className="font-bold">BRIGHT DATA:</span> {data.brightDataError}
          </div>
        )}
        {/* Bright Data SERP sources with domain and rank */}
        {data?.sources && (
          <div className="mt-2 space-y-1">
            {data.sources.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-[9px] truncate hover:underline text-cyan-300/70`}
              >
                <span className={`flex-shrink-0 px-1 rounded text-[8px] font-mono bg-cyan-500/10 text-cyan-400/50`}>
                  {src.rank || idx + 1}
                </span>
                <span className="opacity-50">{getDomain(src.url)}</span>
                <span className="truncate">{src.title}</span>
              </a>
            ))}
          </div>
        )}
        {/* Deep research indicator with structured info */}
        {data?.deepResearch && (
          <div className={`mt-2 p-1.5 rounded border text-[9px] bg-cyan-500/10 border-cyan-500/20 text-cyan-200`}>
            <span className="font-bold">DEEP RESEARCH:</span>
            <span className="ml-1">
              {data.deepResearch.sentenceCount
                ? `${data.deepResearch.sentenceCount} evidence sentences from`
                : `Scraped ${(data.deepResearch.charCount || data.deepResearch.length || 0).toLocaleString()} chars from`}
            </span>
            <a
              href={data.deepResearch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 opacity-70 italic hover:underline"
            >
              {data.deepResearch.title || getDomain(data.deepResearch.url)}
            </a>
            {data.deepResearch.charCount && (
              <span className={`ml-1 text-cyan-300/40`}>
                ({data.deepResearch.charCount.toLocaleString()} chars total)
              </span>
            )}
            {data.deepResearch.product && (
              <span className={`ml-1 text-cyan-300/40`}>
                via {data.deepResearch.product}
              </span>
            )}
          </div>
        )}
        {/* Research Transparency: show products used */}
        {data?.productsUsed && data?.sources && (
          <div className={`mt-1.5 flex items-center gap-2 text-[8px] text-white/30`}>
            <span>Products:</span>
            {data.productsUsed.serp && <span className="px-1 rounded bg-emerald-500/10 text-emerald-500">SERP</span>}
            {data.productsUsed.scrapingBrowser && <span className="px-1 rounded bg-emerald-500/10 text-emerald-500">Scraping Browser</span>}
            {data.productsUsed.webUnlocker && <span className="px-1 rounded bg-emerald-500/10 text-emerald-500">Web Unlocker</span>}
            <span>{data.sources.length} sources</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, isNight, accent = true }) {
  const textColor = 'text-white';
  const subtleText = 'text-white/60';
  const accentColor = accent
    ? 'text-green-300'
    : 'text-red-300';

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
    ? 'bg-green-500/20 text-green-300 border-green-500/30'
    : isFailed
      ? 'bg-red-500/20 text-red-300 border-red-500/30'
      : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';

  const direction = exec.direction || '—';
  const isYes = direction === 'BUY YES';
  const directionColor = isYes
    ? 'text-green-300'
    : 'text-red-300';

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
      isSuccess ? ('border-green-500/20') : ''
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
          <pre className={`mt-1 p-2 rounded-lg text-[10px] font-mono overflow-x-auto bg-white/5 text-white/50`}>
            {exec.execution_response}
          </pre>
        </details>
      )}
    </div>
  );
}

export default AutopilotDashboard;
