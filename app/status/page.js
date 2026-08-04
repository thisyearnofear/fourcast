'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, BarChart3, LineChart, Bot, Brain, Database, Zap } from 'lucide-react';
import {
 getProviderStatusAppearance,
 getSummaryAppearance,
 SUMMARY_LABEL,
} from '@/utils/healthBadge';
import Reveal from '@/components/motion/Reveal';
import useChangeFlash from '@/hooks/useChangeFlash';
import { AppShell } from '@/app/components/PageNav';

const formatLatency = (ms) => {
 if (ms == null) return '—';
 return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

/**
 * LatencyCell — displays a provider's latency value and briefly highlights
 * with the `.fc-tick` wash whenever the value changes between polls.
 */
function LatencyCell({ latencyMs }) {
 const flashing = useChangeFlash(latencyMs);
 return (
 <div className={`text-right shrink-0 ${flashing ? 'fc-tick' : ''}`}>
 <div className="text-[13px] font-normal text-[var(--color-ink-muted)]">{formatLatency(latencyMs)}</div>
 <div className="text-[11px] text-[var(--color-ink-faint)] font-light mt-0.5">latency</div>
 </div>
 );
}

/**
 * Public status page showing real-time health of all external providers.
 * Polls /api/meta/health every 30 seconds for live updates.
 *
 * Macrostructure: Long Document with tabular operational sections
 * (design.md). Token-mapped semantic colors, no off-system slate/blue/red.
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
 const c = getProviderStatusAppearance(status);
 // Pulse the indicator dot for degraded/unreachable (not healthy) states.
 const pulse = status === 'degraded' || status === 'unreachable' ? 'mc-lamp--radar' : '';
 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${c.bg} ${c.text}`}>
 <span className={`w-1.5 h-1.5 ${c.dot} ${pulse}`} />
 {status}
 </span>
 );
 };

 const formatTime = (iso) => {
 if (!iso) return '—';
 return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
 };

 const providerIcon = (key) => {
 const icons = {
 polymarket: BarChart3,
 kalshi: LineChart,
 venice: Bot,
 synthdata: Brain,
 database: Database,
 canton: Zap,
 };
 const Icon = icons[key] || Activity;
 return <Icon className="h-5 w-5 text-[var(--color-ink-muted)]" aria-hidden="true" />;
 };

 // Derived — hoisted out of JSX so the render body doesn't need an IIFE.
 const summaryAppearance = health ? getSummaryAppearance(health.summary) : null;
 const isHealthy = health?.summary === 'all_healthy';

 return (
 <AppShell
      title="Status"
      subtitle="Provider health · refreshes every 30s"
 maxWidth="max-w-3xl"
 wallet={false}
 >
 {/* Loading State */}
 {loading && !health && (
 <div className="flex flex-col items-center gap-4 py-16">
 <div className="w-8 h-8 border-[3px] border-[var(--color-rule)] border-t-[var(--color-accent)] animate-spin" />
 <p className="text-[13px] text-[var(--color-ink-faint)] font-light">Checking provider health...</p>
 </div>
 )}

 {/* Error State */}
 {error && !health && (
 <div className="w-full p-8 bg-[var(--color-breach)]/10 border border-[var(--color-breach)]/20 text-center">
 <p className="text-[14px] text-[var(--color-breach)] mb-4">{error}</p>
 <button
 onClick={() => fetchHealth(true)}
 className="px-5 py-2 border border-[var(--color-rule-strong)] bg-[var(--color-wash)] text-[var(--color-ink)] text-[13px] cursor-pointer hover:bg-[var(--color-paper-soft)] transition-colors"
 >
 Retry
 </button>
 </div>
 )}

 {/* Summary Bar — operational header for the long document */}
 {summaryAppearance && (
 <div
 className={`w-full mb-8 p-4 border flex items-center justify-between ${summaryAppearance.bg} ${summaryAppearance.border}`}
 >
 <div className="flex items-center gap-2.5">
 <span className={`w-2 h-2 ${summaryAppearance.dot} ${isHealthy ? '' : 'mc-lamp--radar'}`} />
 <div>
 <div className="text-[13px] font-medium text-[var(--color-ink)]">
 {SUMMARY_LABEL[health.summary]}
 </div>
 <div className="text-[11px] text-[var(--color-ink-faint)] font-light mt-0.5">
 Last checked: {formatTime(lastUpdated)} · Response: {formatLatency(health.totalLatencyMs)}
 </div>
 </div>
 </div>
 <button
 onClick={() => fetchHealth(true)}
 className="px-3.5 py-1.5 border border-[var(--color-rule)] bg-[var(--color-wash)] text-[var(--color-ink-muted)] text-[12px] cursor-pointer hover:bg-[var(--color-paper-soft)] transition-colors"
 >
 Refresh
 </button>
 </div>
 )}

 {/* Provider records — tabular operational sections, not cards */}
 {health && (
 <div className="w-full flex flex-col gap-3">
 {Object.entries(health.providers).map(([key, provider], index) => (
 <Reveal key={key} delay={Math.min(index * 50, 300)}>
 <div
 className="bg-[var(--color-wash-soft)] border border-[var(--color-rule)] p-[18px_20px] transition-colors duration-200 hover:bg-white/[0.05]"
 >
 <div className="flex items-start justify-between">
 {/* Left: Icon + Info */}
 <div className="flex gap-3 items-start">
 {providerIcon(key)}
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[14px] font-medium text-[var(--color-ink)]">{provider.label}</span>
 {statusBadge(provider.status)}
 </div>
 <p className="text-[12px] text-[var(--color-ink-faint)] font-light mt-1 max-w-[360px]">
 {provider.description}
 </p>
 </div>
 </div>

 {/* Right: Latency */}
 <LatencyCell latencyMs={provider.latencyMs} />
 </div>

 {/* Extended metadata row */}
 <div className="mt-3 pt-2.5 border-t border-[var(--color-rule)] flex gap-6 text-[11px] text-[var(--color-ink-faint)] font-light">
 {provider.model && (
 <span>Model: <span className="text-[var(--color-ink-muted)]">{provider.model}</span></span>
 )}
 {provider.type && (
 <span>Type: <span className="text-[var(--color-ink-muted)]">{provider.type}</span></span>
 )}
 {provider.httpStatus && (
 <span>HTTP: <span className="text-[var(--color-ink-muted)]">{provider.httpStatus}</span></span>
 )}
 </div>
 </div>
 </Reveal>
 ))}
 </div>
 )}
 </AppShell>
 );
}
