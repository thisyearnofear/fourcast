'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAptosSignalPublisher } from '@/hooks/useAptosSignalPublisher';
import AptosConnectButton from '@/app/components/AptosConnectButton';
import PageNav from '@/app/components/PageNav';
import ProfileDrawer from '@/app/components/ProfileDrawer';
import Scene3D from '@/components/Scene3D';
import { weatherService } from '@/services/weatherService';
import { calculateSignalQuality, getQualityColor, getQualityBgColor, getQualityLabel, calculateOddsImprovement } from '@/utils/signalScoring';

export default function SignalsPage() {
    const { connected: aptosConnected, walletAddress } = useAptosSignalPublisher();
    
    const [signals, setSignals] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
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

    const getConfidenceColor = (confidence) => {
        switch (confidence) {
            case 'HIGH': return isNight ? 'text-green-400' : 'text-green-700';
            case 'MEDIUM': return isNight ? 'text-yellow-400' : 'text-yellow-700';
            case 'LOW': return isNight ? 'text-red-400' : 'text-red-700';
            default: return isNight ? 'text-gray-400' : 'text-gray-700';
        }
    };

    const getConfidenceBadge = (confidence) => {
        const baseClass = 'px-3 py-1 rounded-full text-xs font-light border';
        switch (confidence) {
            case 'HIGH':
                return `${baseClass} ${isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30'}`;
            case 'MEDIUM':
                return `${baseClass} ${isNight ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-400/20 text-yellow-800 border-yellow-400/30'}`;
            case 'LOW':
                return `${baseClass} ${isNight ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-400/20 text-red-800 border-red-400/30'}`;
            default:
                return `${baseClass} ${isNight ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-gray-400/20 text-gray-800 border-gray-400/30'}`;
        }
    };

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
                             getConfidenceBadge={getConfidenceBadge}
                         />
                     ) : (
                        <>
                            {/* Search Bar */}
                            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-6`}>
                                <input
                                    type="text"
                                    value={filters.searchText}
                                    onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                                    placeholder="🔍 Search signals by market or analysis..."
                                    className={`w-full px-4 py-3 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/40' : 'bg-black/10 border-black/20 text-black placeholder-black/40'}`}
                                />
                            </div>

                            {/* Filters & Sort */}
                             <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-8`}>
                                <div className="flex justify-between items-center mb-4">
                                    <label className={`${textColor} text-xs opacity-60 uppercase tracking-wider`}>Filters & Sort</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSortBy('newest')}
                                            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${sortBy === 'newest'
                                                ? (isNight ? 'bg-blue-500/30 text-white border border-blue-400/40' : 'bg-blue-400/30 text-black border border-blue-500/40')
                                                : `${textColor} opacity-60 hover:opacity-100`}`}
                                        >
                                            Newest
                                        </button>
                                        <button
                                            onClick={() => setSortBy('confidence')}
                                            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${sortBy === 'confidence'
                                                ? (isNight ? 'bg-blue-500/30 text-white border border-blue-400/40' : 'bg-blue-400/30 text-black border border-blue-500/40')
                                                : `${textColor} opacity-60 hover:opacity-100`}`}
                                        >
                                            Confidence
                                        </button>
                                        <button
                                            onClick={() => setSortBy('accuracy')}
                                            className={`px-3 py-1.5 text-xs rounded-lg transition-all ${sortBy === 'accuracy'
                                                ? (isNight ? 'bg-blue-500/30 text-white border border-blue-400/40' : 'bg-blue-400/30 text-black border border-blue-500/40')
                                                : `${textColor} opacity-60 hover:opacity-100`}`}
                                        >
                                            Accuracy
                                        </button>
                                    </div>
                                </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                     <div>
                                         <label className={`${textColor} text-xs opacity-60 block mb-1`}>Event ID</label>
                                         <input
                                             type="text"
                                             value={filters.eventId}
                                             onChange={(e) => setFilters(prev => ({ ...prev, eventId: e.target.value }))}
                                             placeholder="Filter by event..."
                                             className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/50' : 'bg-black/10 border-black/20 text-black placeholder-black/50'}`}
                                         />
                                     </div>

                                     <div>
                                         <label className={`${textColor} text-xs opacity-60 block mb-1`}>Confidence</label>
                                         <select
                                             value={filters.confidence}
                                             onChange={(e) => setFilters(prev => ({ ...prev, confidence: e.target.value }))}
                                             className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'}`}
                                         >
                                             <option value="all">All Confidence</option>
                                             <option value="HIGH">High</option>
                                             <option value="MEDIUM">Medium</option>
                                             <option value="LOW">Low</option>
                                         </select>
                                     </div>

                                     <div>
                                         <label className={`${textColor} text-xs opacity-60 block mb-1`}>Odds Efficiency</label>
                                         <select
                                             value={filters.oddsEfficiency}
                                             onChange={(e) => setFilters(prev => ({ ...prev, oddsEfficiency: e.target.value }))}
                                             className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'}`}
                                         >
                                             <option value="all">All Efficiency</option>
                                             <option value="INEFFICIENT">Inefficient</option>
                                             <option value="EFFICIENT">Efficient</option>
                                         </select>
                                     </div>

                                     <div>
                                         <label className={`${textColor} text-xs opacity-60 block mb-1`}>Author</label>
                                         <input
                                             type="text"
                                             value={filters.author}
                                             onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                                             placeholder="Filter by author..."
                                             className={`w-full px-3 py-2 text-sm rounded-lg border ${isNight ? 'bg-white/10 border-white/20 text-white placeholder-white/50' : 'bg-black/10 border-black/20 text-black placeholder-black/50'}`}
                                         />
                                     </div>
                                 </div>
                             </div>

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
                                    {/* Timeline View by Event */}
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

                                            {/* Signal Timeline */}
                                            <div className="space-y-3">
                                                {eventSignals.map((signal, index) => {
                                                        const isExpanded = expandedSignalId === signal.id;
                                                        return (
                                                            <div
                                                                 key={signal.id || index}
                                                                 className={`border-l-2 pl-4 pb-4 cursor-pointer transition-all ${isNight ? 'border-blue-500/30 hover:border-blue-500/60' : 'border-blue-400/30 hover:border-blue-400/60'}`}
                                                                 onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
                                                             >
                                                                 <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                     <span className={getConfidenceBadge(signal.confidence)}>
                                                                         {signal.confidence || 'UNKNOWN'}
                                                                     </span>
                                                                     {/* Quality Score Badge */}
                                                                     {(() => {
                                                                         const quality = calculateSignalQuality(signal);
                                                                         return (
                                                                             <span className={`px-3 py-1 rounded-full text-xs font-light border ${getQualityBgColor(quality, isNight)} ${getQualityColor(quality, isNight)} border-current/30`}>
                                                                                 {getQualityLabel(quality)} ({Math.round(quality)})
                                                                             </span>
                                                                         );
                                                                     })()}
                                                                    {signal.odds_efficiency && (
                                                                        <span className={`px-3 py-1 rounded-full text-xs font-light border ${signal.odds_efficiency === 'INEFFICIENT'
                                                                            ? (isNight ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-400/20 text-orange-800 border-orange-400/30')
                                                                            : (isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30')
                                                                            }`}>
                                                                            {signal.odds_efficiency}
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-xs ${textColor} opacity-50`}>
                                                                        {formatTimestamp(signal.timestamp)}
                                                                    </span>
                                                                    {signal.tx_hash && (
                                                                        <span className={`px-3 py-1 rounded-full text-xs font-light border ${isNight ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-400/20 text-purple-800 border-purple-400/30'}`}>
                                                                            On-chain: {signal.tx_hash.substring(0, 8)}...
                                                                        </span>
                                                                    )}
                                                                    <span className={`ml-auto text-xs opacity-40 ${isExpanded ? 'rotate-180' : ''} transition-transform`}>▼</span>
                                                                </div>

                                                                {signal.ai_digest && (
                                                                    <p className={`text-sm ${textColor} opacity-70 ${isExpanded ? '' : 'line-clamp-2'} transition-all`}>
                                                                        {signal.ai_digest}
                                                                    </p>
                                                                )}

                                                                {isExpanded && signal.weather_json && (
                                                                    <div className={`mt-3 p-3 rounded-lg ${isNight ? 'bg-white/5' : 'bg-black/5'} text-xs space-y-2`}>
                                                                        <p className={`${textColor} font-medium mb-2`}>Weather Data</p>
                                                                        {typeof signal.weather_json === 'string' ? (
                                                                            <p className={`${textColor} opacity-60`}>{signal.weather_json}</p>
                                                                        ) : (
                                                                            <p className={`${textColor} opacity-60`}>{JSON.stringify(signal.weather_json, null, 2)}</p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {isExpanded && signal.market_snapshot_hash && (
                                                                    <div className={`mt-3 p-3 rounded-lg ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                                                        <p className={`text-xs ${textColor} opacity-60`}>
                                                                            <span className="font-medium">Market Snapshot:</span> {signal.market_snapshot_hash}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {signal.author_address && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleProfileClick(signal.author_address);
                                                                        }}
                                                                        className={`text-xs ${textColor} opacity-50 mt-2 hover:opacity-100 hover:underline text-left`}
                                                                    >
                                                                        By: {signal.author_address.substring(0, 6)}...{signal.author_address.substring(signal.author_address.length - 4)}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                            </div>

                                            {/* Event Stats */}
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

function LeaderboardTab({ leaderboard, isNight, textColor, cardBgColor, onProfileClick }) {
    if (!leaderboard || leaderboard.length === 0) {
        return (
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
                <div className="text-6xl mb-4">🏆</div>
                <h3 className={`text-xl font-light ${textColor} mb-2`}>No Ranked Analysts Yet</h3>
                <p className={`${textColor} opacity-60 text-sm`}>
                    Be the first to publish high-quality signals and climb the ranks.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
                {leaderboard.map((user, index) => (
                    <div
                        key={user.user_address}
                        onClick={() => onProfileClick(user.user_address)}
                        className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 flex items-center justify-between hover:scale-[1.01] transition-all cursor-pointer`}
                    >
                        <div className="flex items-center gap-6">
                            <div className={`text-3xl font-thin ${index < 3 ? (isNight ? 'text-yellow-400' : 'text-yellow-600') : 'opacity-40'}`}>
                                #{index + 1}
                            </div>
                            <div>
                                <div className={`text-lg font-light ${textColor}`}>
                                    {user.user_address.substring(0, 6)}...{user.user_address.substring(user.user_address.length - 4)}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20'} opacity-70`}>
                                        {user.total_predictions} Signals
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30'}`}>
                                        {(user.win_rate * 100).toFixed(1)}% Win Rate
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className={`text-sm ${textColor} opacity-60 mb-1`}>Reputation Score</div>
                            <div className={`text-2xl font-light ${textColor}`}>
                                {Math.round(user.win_rate * user.total_predictions * 100)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MySignalsTab({ signals, isLoading, isNight, textColor, cardBgColor, expandedSignalId, setExpandedSignalId, formatTimestamp, getConfidenceBadge }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className={`w-6 h-6 border-2 ${isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'} rounded-full animate-spin`}></div>
                <span className={`ml-3 ${textColor} opacity-70`}>Loading your signals...</span>
            </div>
        );
    }

    if (!signals || signals.length === 0) {
        return (
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
                <div className="text-6xl mb-4">⭐</div>
                <h3 className={`text-xl font-light ${textColor} mb-2`}>No Signals Yet</h3>
                <p className={`${textColor} opacity-60 text-sm`}>
                    Head to Markets to analyze events and publish your first signal on-chain
                </p>
            </div>
        );
    }

    // Calculate personal stats
    const won = signals.filter(s => s.outcome === 'YES' || s.outcome === 'CORRECT').length;
    const lost = signals.filter(s => s.outcome === 'NO' || s.outcome === 'INCORRECT').length;
    const pending = signals.filter(s => s.outcome === 'PENDING' || !s.outcome).length;
    const winRate = (won + lost) > 0 ? ((won / (won + lost)) * 100).toFixed(1) : 'N/A';

    return (
        <div className="space-y-6">
            {/* Personal Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                    <div className={`text-3xl font-light ${textColor} mb-1`}>{signals.length}</div>
                    <div className={`text-xs ${textColor} opacity-60`}>Total Published</div>
                </div>
                <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                    <div className={`text-3xl font-light ${isNight ? 'text-green-400' : 'text-green-600'} mb-1`}>{won}</div>
                    <div className={`text-xs ${textColor} opacity-60`}>Won</div>
                </div>
                <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                    <div className={`text-3xl font-light ${isNight ? 'text-red-400' : 'text-red-600'} mb-1`}>{lost}</div>
                    <div className={`text-xs ${textColor} opacity-60`}>Lost</div>
                </div>
                <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4`}>
                    <div className={`text-3xl font-light ${textColor} mb-1`}>{pending}</div>
                    <div className={`text-xs ${textColor} opacity-60`}>Pending</div>
                </div>
            </div>

            {/* Win Rate */}
            {winRate !== 'N/A' && (
                <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6`}>
                    <div className="flex items-end gap-4">
                        <div>
                            <div className={`text-xs ${textColor} opacity-60 mb-2 uppercase tracking-wider`}>Win Rate</div>
                            <div className={`text-4xl font-light ${isNight ? 'text-green-400' : 'text-green-600'}`}>
                                {winRate}%
                            </div>
                        </div>
                        <div className={`flex-1 h-2 rounded-full ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
                            <div
                                className={`h-full rounded-full ${isNight ? 'bg-green-500' : 'bg-green-600'}`}
                                style={{ width: `${parseFloat(winRate)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Signals List */}
            <div className="space-y-4">
                {signals.map((signal) => {
                    const isExpanded = expandedSignalId === signal.id;
                    const statusColor = signal.outcome === 'YES' || signal.outcome === 'CORRECT'
                        ? (isNight ? 'text-green-400' : 'text-green-600')
                        : signal.outcome === 'NO' || signal.outcome === 'INCORRECT'
                        ? (isNight ? 'text-red-400' : 'text-red-600')
                        : (isNight ? 'text-yellow-400' : 'text-yellow-600');

                    return (
                        <div
                            key={signal.id}
                            className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 cursor-pointer hover:scale-[1.01] transition-all`}
                            onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className={`text-lg font-light ${textColor} mb-2`}>
                                        {signal.market_title || signal.event_id}
                                    </h3>
                                    {signal.venue && (
                                        <p className={`text-sm ${textColor} opacity-60`}>📍 {signal.venue}</p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-2xl font-light ${statusColor}`}>
                                        {signal.outcome === 'PENDING' || !signal.outcome ? '⏳' : signal.outcome === 'YES' || signal.outcome === 'CORRECT' ? '✓' : '✗'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className={getConfidenceBadge(signal.confidence)}>
                                    {signal.confidence || 'UNKNOWN'}
                                </span>
                                {signal.odds_efficiency && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-light border ${signal.odds_efficiency === 'INEFFICIENT'
                                        ? (isNight ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-400/20 text-orange-800 border-orange-400/30')
                                        : (isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30')
                                        }`}>
                                        {signal.odds_efficiency}
                                    </span>
                                )}
                                <span className={`text-xs ${textColor} opacity-50`}>
                                    {formatTimestamp(signal.timestamp)}
                                </span>
                                <span className={`ml-auto text-xs opacity-40 ${isExpanded ? 'rotate-180' : ''} transition-transform`}>▼</span>
                            </div>

                            {signal.ai_digest && (
                                <p className={`text-sm ${textColor} opacity-70 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                    {signal.ai_digest}
                                </p>
                            )}

                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                    {signal.weather_json && (
                                        <div className={`p-3 rounded-lg ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                            <p className={`text-xs ${textColor} font-medium mb-2`}>Weather Data</p>
                                            <p className={`text-xs ${textColor} opacity-60`}>
                                                {typeof signal.weather_json === 'string' ? signal.weather_json : JSON.stringify(signal.weather_json, null, 2)}
                                            </p>
                                        </div>
                                    )}
                                    {signal.tx_hash && (
                                        <div className={`p-3 rounded-lg ${isNight ? 'bg-white/5' : 'bg-black/5'}`}>
                                            <p className={`text-xs ${textColor} opacity-60`}>
                                                <span className="font-medium">On-chain TX:</span> <a href={`https://explorer.aptoslabs.com/txn/${signal.tx_hash}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-100">
                                                    {signal.tx_hash.substring(0, 12)}...
                                                </a>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
