'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSignalPublisher } from '@/hooks/useSignalPublisher';
import { useChainConnections } from '@/hooks/useChainConnections';
import { useGlobalToast } from '@/components/ToastProvider';
import { AppShell } from '@/app/components/PageNav';
import NotificationsPanel from '@/components/NotificationsPanel';
import ProfileDrawer from '@/app/components/ProfileDrawer';
import SignalFilters from '@/app/components/signals/SignalFilters';
import SignalCard from '@/app/components/signals/SignalCard';
import LeaderboardTab from '@/app/components/signals/LeaderboardTab';
import OperatorSpotlight from '@/app/components/signals/OperatorSpotlight';
import MySignalsTab from '@/app/components/signals/MySignalsTab';
import DeFiArbitrageTab from '@/app/components/signals/DeFiArbitrageTab';
import { ChainSelector } from '@/components/ChainSelector';
import useFilterStore from '@/hooks/useFilterStore';
import AgentRail from '@/components/AgentRail';
import Reveal from '@/components/motion/Reveal';
import { useCountUp } from '@/hooks/useCountUp';
import { BRAND } from '@/constants/brand';
import { useBackdrop, BACKDROP_STATES } from '@/components/BackdropProvider';

export default function SignalsPage() {
  const { connected, walletAddress } = useSignalPublisher();
  const { chains } = useChainConnections();
  const { addToast } = useGlobalToast();

  const [signals, setSignals] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStatsCache, setUserStatsCache] = useState({});
  const filterStore = useFilterStore();
  const activeTab = filterStore.signalsActiveTab;
  const setActiveTab = (tab) => filterStore.setSignalsActiveTab(tab);

  // Deep-link: ?tab=alerts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('tab') === 'alerts') setActiveTab('alerts');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSignalId, setExpandedSignalId] = useState(null);

  // Backdrop — signal activity state
  const { setState: setBackdrop } = useBackdrop();
  useEffect(() => {
    if (isLoading) { setBackdrop(BACKDROP_STATES.scanning); return; }
    if (error) { setBackdrop(BACKDROP_STATES.breach); return; }
    if (signals.length > 0) { setBackdrop(BACKDROP_STATES.review); return; }
    setBackdrop(BACKDROP_STATES.idle);
  }, [isLoading, error, signals.length, setBackdrop]);

  // Filters & Search (persisted)
  const filters = filterStore.signalsFilters;
  const setFilters = (f) => filterStore.setSignalsFilters(f);
  const sortBy = filterStore.signalsSortBy;
  const setSortBy = (s) => filterStore.setSignalsSortBy(s);

  // Track record state
  const [agentTrackStats, setAgentTrackStats] = useState(null);

  useEffect(() => {
    fetchSignals();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    fetch('/api/agent/track-record')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.stats) setAgentTrackStats(data.stats);
      })
      .catch(err => console.warn('Could not fetch track record:', err.message));
  }, []);

  const calibrationScore = agentTrackStats?.avg_brier_score != null
    ? Math.max(0, Math.round((1 - agentTrackStats.avg_brier_score) * 100))
    : null;
  const agentBrierScore = agentTrackStats?.avg_brier_score ?? null;

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard?limit=20');
      const result = await response.json();
      if (result.success) setLeaderboard(result.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const getUserStats = async (userAddress) => {
    if (!userAddress) return null;
    if (userStatsCache[userAddress]) return userStatsCache[userAddress];
    try {
      const response = await fetch(`/api/stats?address=${userAddress}`);
      const result = await response.json();
      if (result.success) {
        setUserStatsCache(prev => ({ ...prev, [userAddress]: result.stats }));
        return result.stats;
      }
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
    return null;
  };

  const fetchSignals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/signals?limit=50');
      const result = await response.json();
      if (result.success) setSignals(result.signals || []);
      else setError(result.error || 'Failed to load signals');
    } catch (err) {
      console.error('Failed to fetch signals:', err);
      setError('Unable to connect to signals service');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSignals = useMemo(() => {
    let filtered = signals.filter(signal => {
      if (filters.eventId && !signal.event_id?.toLowerCase().includes(filters.eventId.toLowerCase())) return false;
      if (filters.confidence !== 'all' && signal.confidence !== filters.confidence) return false;
      if (filters.oddsEfficiency !== 'all' && signal.odds_efficiency !== filters.oddsEfficiency) return false;
      if (filters.author && !signal.author_address?.toLowerCase().includes(filters.author.toLowerCase())) return false;
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const titleMatch = signal.market_title?.toLowerCase().includes(searchLower);
        const digestMatch = signal.ai_digest?.toLowerCase().includes(searchLower);
        if (!titleMatch && !digestMatch) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'confidence': {
          const order = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
          return (order[b.confidence] || 0) - (order[a.confidence] || 0);
        }
        case 'accuracy': {
          const order = { YES: 2, CORRECT: 2, PENDING: 1, NO: 0, INCORRECT: 0 };
          return (order[b.outcome] || 1) - (order[a.outcome] || 1);
        }
        case 'newest':
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return sorted;
  }, [signals, filters, sortBy]);

  const signalsByEvent = useMemo(() => {
    const grouped = {};
    filteredSignals.forEach(signal => {
      const eventId = signal.event_id || 'unknown';
      if (!grouped[eventId]) grouped[eventId] = [];
      grouped[eventId].push(signal);
    });
    return grouped;
  }, [filteredSignals]);

  const [totalPredictionsRef, totalPredictionsValue] = useCountUp(signals.length);
  const [uniqueEventsRef, uniqueEventsValue] = useCountUp(Object.keys(signalsByEvent).length);
  const [filteredResultsRef, filteredResultsValue] = useCountUp(filteredSignals.length);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const handleProfileClick = (address) => {
    setSelectedProfile(typeof address === 'string' ? address.toLowerCase() : address);
  };

  return (
    <AppShell
      title="Signals"
      subtitle={BRAND.pages.signals}
      subheader={
        <div className="mc-tab-strip">
          {[
            { id: 'feed', label: 'Feed' },
            { id: 'defi', label: 'DeFi' },
            ...(connected ? [{ id: 'my-signals', label: 'Mine' }] : []),
            { id: 'leaderboard', label: 'Leaders' },
            { id: 'alerts', label: 'Alerts' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mc-tab ${activeTab === item.id ? 'is-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <AgentRail />

      {/* Early-stage banner — open section, not glass panel */}
      <section className="mt-2 border-t border-[var(--color-rule)] border-b border-[var(--color-wash)] py-3">
        <p className="mc-kicker" style={{ color: 'var(--color-sealed)' }}>Work in progress</p>
        <p className="mt-1.5 text-sm text-[var(--color-ink)]">
          Signals &amp; Leaders are early — seed wallets and thin stats, not a live reputation product yet.
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Publish a receipt from Markets. For the Canton wedge, use Private.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/markets" className="fc-action px-3 py-1.5 text-xs no-underline">Markets</Link>
          <Link
            href="/proof?chain=canton"
            className="border border-[var(--color-rule)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] no-underline hover:text-[var(--color-ink)]"
          >
            Private
          </Link>
        </div>
      </section>

      {/* Leaderboard spotlight — always above feed unless on leaderboard tab */}
      {leaderboard.length > 0 && activeTab !== 'leaderboard' && (
        <Reveal>
          <OperatorSpotlight operators={leaderboard} onProfileClick={handleProfileClick} />
        </Reveal>
      )}

      {/* Chain selector */}
      {chains?.evm?.connected && (
        <Reveal>
          <div className="mt-4">
            <ChainSelector compact={true} />
          </div>
        </Reveal>
      )}

      {/* Tab content — one open section per branch */}
      {activeTab === 'alerts' && (
        <Reveal>
          <NotificationsPanel />
        </Reveal>
      )}

      {activeTab === 'defi' && (
        <Reveal>
          <DeFiArbitrageTab
            textColor="text-[var(--color-ink)]"
            cardBgColor="bg-[var(--color-paper-raised)] border-[var(--color-rule)]"
          />
        </Reveal>
      )}

      {activeTab === 'leaderboard' && (
        <Reveal>
          <LeaderboardTab
            leaderboard={leaderboard}
            textColor="text-[var(--color-ink)]"
            cardBgColor="bg-[var(--color-paper-raised)] border-[var(--color-rule)]"
            onProfileClick={handleProfileClick}
          />
        </Reveal>
      )}

      {activeTab === 'my-signals' && (
        <Reveal>
          <MySignalsTab
            signals={signals.filter(s => s.author_address === walletAddress)}
            isLoading={isLoading}
            textColor="text-[var(--color-ink)]"
            cardBgColor="bg-[var(--color-paper-raised)] border-[var(--color-rule)]"
            expandedSignalId={expandedSignalId}
            setExpandedSignalId={setExpandedSignalId}
            formatTimestamp={formatTimestamp}
            userAddress={walletAddress}
            calibrationScore={calibrationScore}
            agentBrierScore={agentBrierScore}
          />
        </Reveal>
      )}

      {/* Feed tab — open sections */}
      {activeTab === 'feed' && !isLoading && !error && (
        <Reveal>
          <section className="mt-6 evidence-strip grid grid-cols-3 gap-px bg-[var(--color-paper-soft)]">
            <div className="p-4 bg-[var(--color-paper)]">
              <div ref={totalPredictionsRef} className="text-2xl font-light text-[var(--color-ink)] mb-1">
                {Math.round(totalPredictionsValue)}
              </div>
              <div className="text-xs text-[var(--color-ink-faint)]">Total Predictions</div>
            </div>
            <div className="p-4 bg-[var(--color-paper)]">
              <div ref={uniqueEventsRef} className="text-2xl font-light text-[var(--color-ink)] mb-1">
                {Math.round(uniqueEventsValue)}
              </div>
              <div className="text-xs text-[var(--color-ink-faint)]">Unique Events</div>
            </div>
            <div className="p-4 bg-[var(--color-paper)]">
              <div ref={filteredResultsRef} className="text-2xl font-light text-[var(--color-ink)] mb-1">
                {Math.round(filteredResultsValue)}
              </div>
              <div className="text-xs text-[var(--color-ink-faint)]">Filtered Results</div>
            </div>
          </section>
        </Reveal>
      )}

      {activeTab === 'feed' && !isLoading && !error && filteredSignals.length === 0 && (
        <Reveal>
          <section className="mt-6 border border-[var(--color-rule)] bg-[var(--color-wash-soft)] p-5">
            <p className="text-sm text-[var(--color-ink)]">No published calls in this feed yet.</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              Analyze a market and publish a receipt — reputation scoring here is still early.
            </p>
            <Link href="/markets" className="fc-action mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs no-underline">
              Open Markets
            </Link>
          </section>
        </Reveal>
      )}

      {activeTab === 'feed' && !isLoading && !error && filteredSignals.length > 0 && (
        <div className="space-y-8 mt-6">
          {Object.entries(signalsByEvent).map(([eventId, eventSignals]) => (
            <Reveal key={eventId}>
              <section className="platform-open-section">
                <p className="fc-kicker mb-2">Decision record · {eventSignals.length} entries</p>
                <h3 className="text-lg font-medium text-[var(--color-ink)] mb-3">
                  {eventSignals[0]?.market_title || eventId}
                </h3>

                {eventSignals[0]?.venue && (
                  <p className="text-xs text-[var(--color-ink-faint)] mb-3">
                    Venue · {eventSignals[0].venue}
                  </p>
                )}

                <div className="space-y-3">
                  {eventSignals.map((signal, index) => (
                    <SignalCard
                      key={signal.id || index}
                      signal={signal}
                      index={index}
                      isExpanded={expandedSignalId === signal.id}
                      onToggle={() => setExpandedSignalId(expandedSignalId === signal.id ? null : signal.id)}
                      formatTimestamp={formatTimestamp}
                      textColor="text-[var(--color-ink)]"
                      onProfileClick={handleProfileClick}
                      userStats={userStatsCache[signal.author_address] || null}
                      onExpand={() => {
                        if (!userStatsCache[signal.author_address]) {
                          getUserStats(signal.author_address);
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--color-rule)] flex flex-wrap items-center gap-4 text-xs text-[var(--color-ink-faint)]">
                  <span>{eventSignals.length} prediction{eventSignals.length !== 1 ? 's' : ''} published</span>
                  {eventSignals[0]?.event_time && (
                    <span>Event: {formatTimestamp(eventSignals[0].event_time)}</span>
                  )}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      )}

      {activeTab === 'feed' && isLoading && (
        <Reveal>
          <div className="mt-8 flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--color-rule)] border-t-[var(--color-accent)] animate-spin" />
            <span className="ml-3 text-sm text-[var(--color-ink-faint)]">Loading signals...</span>
          </div>
        </Reveal>
      )}

      {activeTab === 'feed' && error && (
        <Reveal>
          <div className="mt-6 mc-panel p-6 text-center">
            <p className="text-[var(--color-ink)] mb-3">{error}</p>
            <button
              onClick={fetchSignals}
              className="px-4 py-2 text-sm text-[var(--color-ink)] border border-[var(--color-rule)] bg-[var(--color-wash)] hover:bg-[var(--color-paper-soft)] transition-colors"
            >
              Try Again
            </button>
          </div>
        </Reveal>
      )}

      <ProfileDrawer
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        address={selectedProfile}
      />
    </AppShell>
  );
}
