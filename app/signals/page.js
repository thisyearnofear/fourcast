'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSignalPublisher } from '@/hooks/useSignalPublisher';
import { useChainConnections } from '@/hooks/useChainConnections';
import useFilterStore from '@/hooks/useFilterStore';
import { useGlobalToast } from '@/components/ToastProvider';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import ProfileDrawer from '@/app/components/ProfileDrawer';
import SignalFilters from '@/app/components/signals/SignalFilters';
import SignalCard from '@/app/components/signals/SignalCard';
import LeaderboardTab from '@/app/components/signals/LeaderboardTab';
import OperatorSpotlight from '@/app/components/signals/OperatorSpotlight';
import MySignalsTab from '@/app/components/signals/MySignalsTab';
import DeFiArbitrageTab from '@/app/components/signals/DeFiArbitrageTab';
import { ChainSelector } from '@/components/ChainSelector';
import NarrativeSteps from '@/components/NarrativeSteps';
import { BRAND } from '@/constants/brand';

export default function SignalsPage() {
 const { connected, walletAddress } = useSignalPublisher();
 const { chains } = useChainConnections();
 const { addToast } = useGlobalToast();

 const [signals, setSignals] = useState([]);
 const [leaderboard, setLeaderboard] = useState([]);
 const [userStatsCache, setUserStatsCache] = useState({}); // Cache user stats
 const filterStore = useFilterStore();
 const activeTab = filterStore.signalsActiveTab;
 const setActiveTab = (tab) => filterStore.setSignalsActiveTab(tab);
 const [selectedProfile, setSelectedProfile] = useState(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState(null);
 const [expandedSignalId, setExpandedSignalId] = useState(null);

 // Filters & Search (persisted)
 const filters = filterStore.signalsFilters;
 const setFilters = (f) => filterStore.setSignalsFilters(f);
 const sortBy = filterStore.signalsSortBy;
 const setSortBy = (s) => filterStore.setSignalsSortBy(s);

 // Track record state (Brier scores, calibration)
 const [agentTrackStats, setAgentTrackStats] = useState(null);

 // Fetch signals on mount
 useEffect(() => {
 fetchSignals();
 fetchLeaderboard();
 }, []);

 // Fetch agent track record for reputation spine
 useEffect(() => {
 fetch('/api/agent/track-record')
 .then(r => r.json())
 .then(data => {
 if (data.success && data.stats) {
 setAgentTrackStats(data.stats);
 }
 })
 .catch(err => console.warn('Could not fetch track record:', err.message));
 }, []);

 // Compute calibration score from Brier
 const calibrationScore = agentTrackStats?.avg_brier_score != null
 ? Math.max(0, Math.round((1 - agentTrackStats.avg_brier_score) * 100))
 : null;
 const agentBrierScore = agentTrackStats?.avg_brier_score ?? null;

 const fetchLeaderboard = async () => {
 try {
 const response = await fetch('/api/leaderboard?limit=20');
 const result = await response.json();
 if (result.success) {
 setLeaderboard(result.leaderboard || []);
 }
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

 if (result.success) {
 setSignals(result.signals || []);
 } else {
 setError(result.error || 'Failed to load signals');
 }
 } catch (err) {
 console.error('Failed to fetch signals:', err);
 setError('Unable to connect to signals service');
 } finally {
 setIsLoading(false);
 }
 };

 // Filter signals with full-text search
 const filteredSignals = useMemo(() => {
 let filtered = signals.filter(signal => {
 // Event ID filter
 if (filters.eventId && !signal.event_id?.toLowerCase().includes(filters.eventId.toLowerCase())) {
 return false;
 }
 // Confidence filter
 if (filters.confidence !== 'all' && signal.confidence !== filters.confidence) {
 return false;
 }
 // Odds Efficiency filter
 if (filters.oddsEfficiency !== 'all' && signal.odds_efficiency !== filters.oddsEfficiency) {
 return false;
 }
 // Author filter
 if (filters.author && !signal.author_address?.toLowerCase().includes(filters.author.toLowerCase())) {
 return false;
 }
 // Full-text search across market title and AI digest
 if (filters.searchText) {
 const searchLower = filters.searchText.toLowerCase();
 const titleMatch = signal.market_title?.toLowerCase().includes(searchLower);
 const digestMatch = signal.ai_digest?.toLowerCase().includes(searchLower);
 if (!titleMatch && !digestMatch) {
 return false;
 }
 }
 return true;
 });

 // Sort signals
 const sorted = [...filtered].sort((a, b) => {
 switch (sortBy) {
 case 'confidence': {
 const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
 return (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
 }
 case 'accuracy': {
 const accuracyOrder = { YES: 2, CORRECT: 2, PENDING: 1, NO: 0, INCORRECT: 0 };
 return (accuracyOrder[b.outcome] || 1) - (accuracyOrder[a.outcome] || 1);
 }
 case 'newest':
 default:
 return b.timestamp - a.timestamp;
 }
 });

 return sorted;
 }, [signals, filters, sortBy]);

 // Group signals by event_id for timeline view
 const signalsByEvent = useMemo(() => {
 const grouped = {};
 filteredSignals.forEach(signal => {
 const eventId = signal.event_id || 'unknown';
 if (!grouped[eventId]) {
 grouped[eventId] = [];
 }
 grouped[eventId].push(signal);
 });
 return grouped;
 }, [filteredSignals]);

 const textColor = 'text-white';
 const bgColor = 'bg-black';
 const cardBgColor = 'bg-slate-900/60 border-white/20';

 const formatTimestamp = (timestamp) => {
 if (!timestamp) return 'Unknown';
 const date = new Date(timestamp * 1000);
 return date.toLocaleString();
 };

 // Normalize to lowercase — the DB stores addresses lowercased (see
 // services/db.js saveSignal/openPosition) but spotlight cards may carry a
 // checksummed variant. Cheap insurance against a 404 on the ProfileDrawer.
 const handleProfileClick = (address) => {
 setSelectedProfile(typeof address === 'string' ? address.toLowerCase() : address);
 };

 return (
 <AppShell
 title="Signals"
 subtitle={BRAND.pages.signals}
 subheader={
 <div className="space-y-3">
 <NarrativeSteps currentStep="scored" />
 <SecondaryNav
 items={[
 { id: 'feed', label: 'Signal Feed', icon: '📡' },
 { id: 'defi', label: 'DeFi Arbs', icon: '💱' },
 ...(connected ? [{ id: 'my-signals', label: 'My Track Record', icon: '🎯' }] : []),
 { id: 'leaderboard', label: 'Top Analysts', icon: '🏆' },
 ]}
 activeItem={activeTab}
 onChange={setActiveTab}
 />
 </div>
 }
 >
 <>
 {/* Operator Spotlight — framing line + 3-analyst proof strip.
 Surfaces the highest-tracked authors so first-time visitors
 see "this is a feed of verified operators" within 5 seconds
 of landing. Renders above every tab so the acquisition-loop
 promise isn't gated on which tab the visitor opens. */}
 <div className="mb-8">
 <p className="mb-4 max-w-2xl text-sm font-light leading-relaxed text-white/[0.55]">
 Browse signals from verified Quant Operators. Follow analysts whose{' '}
 <span className="text-emerald-300">Audited Track Record</span>{' '}
 matches your conviction — every fill, outcome, and Brier score lands on Arc.
 </p>
 {leaderboard.length > 0 && activeTab !== 'leaderboard' && (
 <OperatorSpotlight
 operators={leaderboard}
 onProfileClick={handleProfileClick}
 />
 )}
 </div>

 {/* EVM Network Selector (Trading chains) */}
 {chains?.evm?.connected && (
 <div className="mb-6">
 <ChainSelector compact={true} />
 </div>
 )}

 {activeTab === 'defi' ? (
 <DeFiArbitrageTab
 textColor={textColor}
 cardBgColor={cardBgColor}
 />
 ) : activeTab === 'leaderboard' ? (
 <LeaderboardTab
 leaderboard={leaderboard}
 textColor={textColor}
 cardBgColor={cardBgColor}
 onProfileClick={handleProfileClick}
 />
 ) : activeTab === 'my-signals' ? (
 <MySignalsTab
 signals={signals.filter(s => s.author_address === walletAddress)}
 isLoading={isLoading}
 textColor={textColor}
 cardBgColor={cardBgColor}
 expandedSignalId={expandedSignalId}
 setExpandedSignalId={setExpandedSignalId}
 formatTimestamp={formatTimestamp}
 userAddress={walletAddress}
 calibrationScore={calibrationScore}
 agentBrierScore={agentBrierScore}
 />
 ) : (
 <>
 <SignalFilters
 filters={filters}
 setFilters={setFilters}
 sortBy={sortBy}
 setSortBy={setSortBy}
 textColor={textColor}
 cardBgColor={cardBgColor}
 />

 {/* Stats Summary — evidence strip, not card grid */}
 {!isLoading && !error && (
 <div className="evidence-strip grid grid-cols-3 gap-px bg-white/10 mb-10">
 <div className="p-4 bg-[var(--color-paper)]">
 <div className={`text-2xl font-light ${textColor} mb-1`}>{signals.length}</div>
 <div className={`text-xs ${textColor} opacity-60`}>Total Predictions</div>
 </div>
 <div className="p-4 bg-[var(--color-paper)]">
 <div className={`text-2xl font-light ${textColor} mb-1`}>{Object.keys(signalsByEvent).length}</div>
 <div className={`text-xs ${textColor} opacity-60`}>Unique Events</div>
 </div>
 <div className="p-4 bg-[var(--color-paper)]">
 <div className={`text-2xl font-light ${textColor} mb-1`}>{filteredSignals.length}</div>
 <div className={`text-xs ${textColor} opacity-60`}>Filtered Results</div>
 </div>
 </div>
 )}

 {/* Loading State */}
 {isLoading && (
 <div className="flex items-center justify-center py-12">
 <div className={`w-6 h-6 border-2 border-white/30 border-t-white animate-spin`}></div>
 <span className={`ml-3 ${textColor} opacity-70`}>Loading signals...</span>
 </div>
 )}

 {/* Error State */}
 {error && (
 <div className={`mc-panel p-6 text-center`}>
 <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
 <button
 onClick={fetchSignals}
 className={`px-4 py-2 text-sm font-light bg-white/20 hover:bg-white/30 text-white`}
 >
 Try Again
 </button>
 </div>
 )}

 {/* Signals List */}
 {!isLoading && !error && filteredSignals.length === 0 && (
 <div className={`mc-panel p-12 text-center`}>
 <div className="text-6xl mb-4">🎯</div>
 <h3 className={`text-xl font-light ${textColor} mb-2`}>No Predictions Yet</h3>
 <p className={`${textColor} opacity-60 text-sm`}>
 Head to Markets, analyze an event, and make your first call to start building a track record
 </p>
 </div>
 )}

 {!isLoading && !error && filteredSignals.length > 0 && (
 <div className="space-y-10">
 {Object.entries(signalsByEvent).map(([eventId, eventSignals]) => (
 <section key={eventId} className="platform-open-section">
 <p className="fc-kicker mb-2">Decision record · {eventSignals.length} entries</p>
 <h3 className={`text-lg font-medium ${textColor} mb-4`}>
 {eventSignals[0]?.market_title || eventId}
 </h3>

 {eventSignals[0]?.venue && (
 <div className={`text-sm ${textColor} opacity-60 mb-4`}>
 Venue · {eventSignals[0].venue}
 </div>
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
 textColor={textColor}
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

 <div className={`mt-4 pt-4 border-t border-white/10`}>
 <div className="flex flex-wrap items-center gap-4 text-xs">
 <span className={`${textColor} opacity-60`}>
 {eventSignals.length} prediction{eventSignals.length !== 1 ? 's' : ''} published
 </span>
 {eventSignals[0]?.event_time && (
 <span className={`${textColor} opacity-60`}>
 Event: {formatTimestamp(eventSignals[0].event_time)}
 </span>
 )}
 </div>
 </div>
 </section>
 ))}
 </div>
 )}
 </>
 )}
 </>
 <ProfileDrawer
 isOpen={!!selectedProfile}
 onClose={() => setSelectedProfile(null)}
 address={selectedProfile}
 />
 </AppShell>
 );
}
