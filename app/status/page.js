'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Public status page showing real-time health of all external providers.
 * Polls /api/meta/health every 30 seconds for live updates.
 */
export default function StatusPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHealth = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/meta/health');
      const data = await res.json();
      if (data.success) {
        setHealth(data);
        setLastUpdated(new Date().toISOString());
        setError(null);
      } else {
        setError('Health endpoint returned an error');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchHealth(true);
  }, [fetchHealth]);

  // Poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchHealth(false), 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const statusBadge = (status) => {
    const colors = {
      healthy:    { dot: 'bg-green-500', text: 'text-green-300', bg: 'bg-green-500/10' },
      degraded:   { dot: 'bg-yellow-500', text: 'text-yellow-300', bg: 'bg-yellow-500/10' },
      unreachable: { dot: 'bg-red-500', text: 'text-red-300', bg: 'bg-red-500/10' },
      disabled:   { dot: 'bg-gray-500', text: 'text-gray-400', bg: 'bg-gray-500/10' },
    };
    const c = colors[status] || colors.disabled;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wider ${c.bg} ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {status}
      </span>
    );
  };

  const formatLatency = (ms) => {
    if (ms == null) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const providerIcon = (key) => {
    const icons = {
      polymarket: '📊',
      kalshi: '📈',
      venice: '🤖',
      synthdata: '🧠',
      database: '🗄️',
    };
    return icons[key] || '🔌';
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-slate-100 flex flex-col items-center px-5 py-10 pb-16">
      {/* Header */}
      <div className="w-full max-w-[640px] mb-12">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="flex h-7 w-7 items-center justify-center text-emerald-300">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="text-[22px] font-light tracking-tight">System Status</h1>
        </div>
        <p className="text-[13px] text-slate-400 font-light leading-relaxed">
          Real-time health of the providers powering Fourcast predictions, signals, and analysis.
          Data refreshes automatically every 30 seconds.
        </p>
      </div>

      {/* Loading State */}
      {loading && !health && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-8 h-8 border-[3px] border-white/10 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-[13px] text-slate-500 font-light">Checking provider health...</p>
        </div>
      )}

      {/* Error State */}
      {error && !health && (
        <div className="w-full max-w-[640px] p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-[14px] text-red-300 mb-4">{error}</p>
          <button
            onClick={() => fetchHealth(true)}
            className="px-5 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 text-[13px] cursor-pointer hover:bg-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Bar */}
      {health && (
        <div
          className={`w-full max-w-[640px] mb-8 p-4 rounded-xl border flex items-center justify-between ${
            health.summary === 'all_healthy'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{health.summary === 'all_healthy' ? '✅' : '⚠️'}</span>
            <div>
              <div className="text-[13px] font-medium text-slate-200">
                {health.summary === 'all_healthy' ? 'All Systems Operational' : 'Degraded Performance'}
              </div>
              <div className="text-[11px] text-slate-500 font-light mt-0.5">
                Last checked: {formatTime(lastUpdated)} · Response: {formatLatency(health.totalLatencyMs)}
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchHealth(true)}
            className="px-3.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-400 text-[12px] cursor-pointer hover:bg-white/10 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Provider Cards */}
      {health && (
        <div className="w-full max-w-[640px] flex flex-col gap-3">
          {Object.entries(health.providers).map(([key, provider]) => (
            <div
              key={key}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-[18px_20px] transition-colors duration-200 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between">
                {/* Left: Icon + Info */}
                <div className="flex gap-3 items-start">
                  <span className="text-[22px] leading-tight">{providerIcon(key)}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-medium text-slate-200">{provider.label}</span>
                      {statusBadge(provider.status)}
                    </div>
                    <p className="text-[12px] text-slate-500 font-light mt-1 max-w-[360px]">
                      {provider.description}
                    </p>
                  </div>
                </div>

                {/* Right: Latency */}
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-normal text-slate-400">{formatLatency(provider.latencyMs)}</div>
                  <div className="text-[11px] text-slate-600 font-light mt-0.5">latency</div>
                </div>
              </div>

              {/* Extended metadata row */}
              <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex gap-6 text-[11px] text-slate-600 font-light">
                {provider.model && (
                  <span>Model: <span className="text-slate-500">{provider.model}</span></span>
                )}
                {provider.type && (
                  <span>Type: <span className="text-slate-500">{provider.type}</span></span>
                )}
                {provider.httpStatus && (
                  <span>HTTP: <span className="text-slate-500">{provider.httpStatus}</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
