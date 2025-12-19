'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAptosSignalPublisher } from '@/hooks/useAptosSignalPublisher';
import AptosConnectButton from '@/app/components/AptosConnectButton';
import PageNav from '@/app/components/PageNav';
import ProfileDrawer from '@/app/components/ProfileDrawer';
import Scene3D from '@/components/Scene3D';
import { weatherService } from '@/services/weatherService';
import SignalFilters from '@/app/components/signals/SignalFilters';
import SignalCard from '@/app/components/signals/SignalCard';
import LeaderboardTab from '@/app/components/signals/LeaderboardTab';
import MySignalsTab from '@/app/components/signals/MySignalsTab';

export default function SignalsPage() {
    const { connected: aptosConnected, walletAddress, tipSignal } = useAptosSignalPublisher();

    const [signals, setSignals] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [userStatsCache, setUserStatsCache] = useState({}); // Cache user stats
    const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'my-signals', or 'leaderboard'
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedSignalId, setExpandedSignalId] = useState(null); // Track expanded signals

    // Filters & Search
    const [filters, setFilters] = useState({
        eventId: '',
        confidence: 'all',
        oddsEfficiency: 'all',
        author: '', // Filter by author address
        searchText: '' // Full-text search
    });
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'confidence', 'accuracy'

    // Weather for theming
    const [weatherData, setWeatherData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(true);
    const [isNight, setIsNight] = useState(() => {
        const hour = new Date().getHours();
        return hour >= 19 || hour <= 6;
    });

    // Load weather on mount
    useEffect(() => {
        loadWeather();
    }, []);

    // Fetch signals on mount
    useEffect(() => {
        fetchSignals();
        fetchLeaderboard();
    }, []);

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

    const loadWeather = async () => {
        try {
            const location = await weatherService.getCurrentLocation();
            const data = await weatherService.getCurrentWeather(location);
            setWeatherData(data);

            if (data?.location?.localtime) {
                const currentHour = new Date(data.location.localtime).getHours();
                setIsNight(currentHour >= 19 || currentHour <= 6);
            }
        } catch (err) {
            console.warn('Unable to load weather:', err.message);
        } finally {
            setIsLoadingWeather(false);
        }
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
                case 'confidence':
                    // HIGH > MEDIUM > LOW
                    const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
                    return (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0);
                case 'accuracy':
                    // Won > Pending > Lost
                    const accuracyOrder = { YES: 2, CORRECT: 2, PENDING: 1, NO: 0, INCORRECT: 0 };
                    return (accuracyOrder[b.outcome] || 1) - (accuracyOrder[a.outcome] || 1);
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

    const textColor = isNight ? 'text-white' : 'text-black';
    const bgColor = 'bg-black';
    const cardBgColor = isNight ? 'bg-slate-900/60 border-white/20' : 'bg-white/60 border-black/20';

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    const handleProfileClick = (address) => {
        setSelectedProfile(address);
    };

    if (isLoadingWeather) {
        return (
            <div className={`w-screen h-screen flex items-center justify-center ${bgColor}`}>
                <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 border-4 border-current/30 border-t-current rounded-full animate-spin ${textColor} mb-4`}></div>
                    <p className={`${textColor} font-light`}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative">
            {/* 3D Scene Background */}
            <div className="fixed inset-0 z-0">
                <Scene3D
                    weatherData={weatherData}
                    isLoading={isLoadingWeather}
                    quality="ambient"
                />
            </div>

            {/* Scrollable Content */}
            <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
                {/* Header */}
                <header className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
                        <div>
                            <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                                Signals
                            </h1>
                            <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                                Published weather × odds × AI signals registry
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <PageNav currentPage="Signals" isNight={isNight} />
                            <div className="flex items-center space-x-2">
                                <div className="flex flex-col items-end">
                                    <ConnectKitButton mode={isNight ? "dark" : "light"} />
                                    <span className={`text-[10px] ${textColor} opacity-50 mt-0.5`}>Trading</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <AptosConnectButton isNight={isNight} />
                                    <span className={`text-[10px] ${textColor} opacity-50 mt-0.5`}>Identity</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
                        <div className={`inline-flex rounded-2xl p-1 border ${cardBgColor} backdrop-blur-xl flex-wrap gap-1`}>
                            <button
                                onClick={() => setActiveTab('feed')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-light transition-all ${activeTab === 'feed'
                                    ? (isNight ? 'bg-blue-500/30 text-white border border-blue-400/40' : 'bg-blue-400/30 text-black border border-blue-500/40')
                                    : `${textColor} opacity-60 hover:opacity-100`
                                    }`}
                            >
                                📡 Signal Feed
                            </button>
                            {aptosConnected && (
                                <button
                                    onClick={() => setActiveTab('my-signals')}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-light transition-all ${activeTab === 'my-signals'
                                        ? (isNight ? 'bg-green-500/30 text-white border border-green-400/40' : 'bg-green-400/30 text-black border border-green-500/40')
                                        : `${textColor} opacity-60 hover:opacity-100`
                                        }`}
                                >
                                    ⭐ My Signals
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTab('leaderboard')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-light transition-all ${activeTab === 'leaderboard'
                                    ? (isNight ? 'bg-purple-500/30 text-white border border-purple-400/40' : 'bg-purple-400/30 text-black border border-purple-500/40')
                                    : `${textColor} opacity-60 hover:opacity-100`
                                    }`}
                            >
                                🏆 Top Analysts
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex-1">
                    {activeTab === 'leaderboard' ? (
                        <LeaderboardTab
                            leaderboard={leaderboard}
                            isNight={isNight}
                            textColor={textColor}
                            cardBgColor={cardBgColor}
                            onProfileClick={handleProfileClick}
                        />
                    ) : activeTab === 'my-signals' ? (
                        <MySignalsTab
                            signals={signals.filter(s => s.author_address === walletAddress)}
                            isLoading={isLoading}
                            isNight={isNight}
                            textColor={textColor}
                            cardBgColor={cardBgColor}
                            expandedSignalId={expandedSignalId}
                            setExpandedSignalId={setExpandedSignalId}
                            formatTimestamp={formatTimestamp}
                            userAddress={walletAddress}
                        />
                    ) : (
                        <>
                            <SignalFilters
                                filters={filters}
                                setFilters={setFilters}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                                isNight={isNight}
                                textColor={textColor}
                                cardBgColor={cardBgColor}
                            />

                            {/* Stats Summary */}
                            {!isLoading && !error && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                    <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                                        <div className={`text-2xl font-light ${textColor} mb-1`}>{signals.length}</div>
                                        <div className={`text-xs ${textColor} opacity-60`}>Total Signals</div>
                                    </div>
                                    <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                                        <div className={`text-2xl font-light ${textColor} mb-1`}>{Object.keys(signalsByEvent).length}</div>
                                        <div className={`text-xs ${textColor} opacity-60`}>Unique Events</div>
                                    </div>
                                    <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                                        <div className={`text-2xl font-light ${textColor} mb-1`}>{filteredSignals.length}</div>
                                        <div className={`text-xs ${textColor} opacity-60`}>Filtered Results</div>
                                    </div>
                                </div>
                            )}

                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex items-center justify-center py-12">
                                    <div className={`w-6 h-6 border-2 ${isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'} rounded-full animate-spin`}></div>
                                    <span className={`ml-3 ${textColor} opacity-70`}>Loading signals...</span>
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 text-center`}>
                                    <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
                                    <button
                                        onClick={fetchSignals}
                                        className={`px-4 py-2 rounded-lg text-sm font-light ${isNight ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/20 hover:bg-black/30 text-black'}`}
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {/* Signals List */}
                            {!isLoading && !error && filteredSignals.length === 0 && (
                                <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
                                    <div className="text-6xl mb-4">📡</div>
                                    <h3 className={`text-xl font-light ${textColor} mb-2`}>No Signals Yet</h3>
                                    <p className={`${textColor} opacity-60 text-sm`}>
                                        Signals will appear here once published from the Markets page
                                    </p>
                                </div>
                            )}

                            {!isLoading && !error && filteredSignals.length > 0 && (
                                <div className="space-y-6">
                                    {Object.entries(signalsByEvent).map(([eventId, eventSignals]) => (
                                        <div key={eventId} className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6`}>
                                            <h3 className={`text-lg font-light ${textColor} mb-4`}>
                                                {eventSignals[0]?.market_title || eventId}
                                            </h3>

                                            {eventSignals[0]?.venue && (
                                                <div className={`text-sm ${textColor} opacity-60 mb-4`}>
                                                    📍 {eventSignals[0].venue}
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
                                                        isNight={isNight}
                                                        textColor={textColor}
                                                        onProfileClick={handleProfileClick}
                                                        userStats={userStatsCache[signal.author_address] || null}
                                                        onTip={async (amount) => {
                                                            try {
                                                                if (!aptosConnected) {
                                                                    alert("Please connect your wallet to tip!");
                                                                    return;
                                                                }
                                                                const tx = await tipSignal(signal.author_address, signal.signal_id || index, amount || 10000000);
                                                                alert(`Tip sent! Tx: ${tx}`);
                                                            } catch (e) {
                                                                alert(e.message);
                                                            }
                                                        }}
                                                        onExpand={() => {
                                                            if (!userStatsCache[signal.author_address]) {
                                                                getUserStats(signal.author_address);
                                                            }
                                                        }}
                                                    />
                                                ))}
                                            </div>

                                            <div className={`mt-4 pt-4 border-t ${isNight ? 'border-white/10' : 'border-black/10'}`}>
                                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                                    <span className={`${textColor} opacity-60`}>
                                                        {eventSignals.length} signal{eventSignals.length !== 1 ? 's' : ''} published
                                                    </span>
                                                    {eventSignals[0]?.event_time && (
                                                        <span className={`${textColor} opacity-60`}>
                                                            Event: {formatTimestamp(eventSignals[0].event_time)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            <ProfileDrawer
                isOpen={!!selectedProfile}
                onClose={() => setSelectedProfile(null)}
                address={selectedProfile}
                isNight={isNight}
            />
        </div>
    );
}
