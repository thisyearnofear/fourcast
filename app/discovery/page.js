'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConnectKitButton } from 'connectkit';
import PageNav from '@/app/components/PageNav';
import Scene3D from '@/components/Scene3D';

const DiscoveryPage = () => {
  // State management
  const [markets, setMarkets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: 'all',
    minVolume: '50000',
    search: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [expandedMarketId, setExpandedMarketId] = useState(null);

  // Weather data for backdrop
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  // Theme detection based on weather data
  const [isNight, setIsNight] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour <= 6;
  });
  const [timeOfDay, setTimeOfDay] = useState(() => {
    const hour = new Date().getHours();
    if (hour >= 19 || hour <= 6) return 'night';
    if (hour >= 6 && hour < 8) return 'dawn';
    if (hour >= 17 && hour < 19) return 'dusk';
    return 'day';
  });

  // Load weather data on mount
  useEffect(() => {
    const loadWeather = async () => {
      try {
        const { weatherService } = await import('@/services/weatherService');
        const location = await weatherService.getCurrentLocation();
        const data = await weatherService.getCurrentWeather(location);
        setWeatherData(data);
        
        // Set theme based on loaded weather
        if (data?.location?.localtime) {
          const localTime = data.location.localtime;
          const currentHour = new Date(localTime).getHours();
          setIsNight(currentHour >= 19 || currentHour <= 6);
          
          if (currentHour >= 19 || currentHour <= 6) {
            setTimeOfDay('night');
          } else if (currentHour >= 6 && currentHour < 8) {
            setTimeOfDay('dawn');
          } else if (currentHour >= 17 && currentHour < 19) {
            setTimeOfDay('dusk');
          } else {
            setTimeOfDay('day');
          }
        }
      } catch (err) {
        console.error('Failed to load weather:', err);
        // Fallback to time-based detection
        const hour = new Date().getHours();
        setIsNight(hour >= 19 || hour <= 6);
      } finally {
        setIsLoadingWeather(false);
      }
    };
    
    loadWeather();
  }, []);

  // Fetch markets on mount and filter changes
  useEffect(() => {
    fetchMarkets();
  }, [filters.category, filters.minVolume]);

  // Color scheme based on theme (matching your WeatherPage pattern)
  const textColor = useMemo(() => isNight ? 'text-white' : 'text-black', [isNight]);
  const bgClass = useMemo(() => 
    isNight 
      ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800' 
      : 'bg-gradient-to-br from-blue-50 via-white to-blue-100',
    [isNight]
  );

  const fetchMarkets = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // REFACTORED: Use new edge-ranked discovery via API
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: filters.search || null, // Optional location filter
          eventType: 'all',
          confidence: 'all',
          limitCount: 50 // More results for discovery page
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        let filtered = result.markets || [];
        
        // Apply volume filter
        if (filters.minVolume) {
          const minVol = parseInt(filters.minVolume);
          filtered = filtered.filter(m => (m.volume24h || 0) >= minVol);
        }
        
        // Apply category filter
        if (filters.category !== 'all') {
          filtered = filtered.filter(m => {
            const tags = m.tags || [];
            return tags.some(tag => tag.toLowerCase() === filters.category.toLowerCase());
          });
        }
        
        setMarkets(filtered);
      } else {
        setError(result.error || 'Failed to load markets');
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      setError('Unable to connect to Polymarket data service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setFilters(prev => ({ ...prev, search: searchQuery.trim() }));
      await fetchMarkets();
      setSearchQuery('');
    }
  }, [searchQuery]);

  const analyzeMarket = async (market) => {
    setSelectedMarket(market);
    setExpandedMarketId(market.id);
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketTitle: market.title || market.question,
          description: market.description,
          tags: market.tags || [],
          currentBid: market.bid || 0,
          currentAsk: market.ask || 0,
          volume24h: market.volume24h || 0,
          liquidity: market.liquidity || 0,
          marketID: market.id || market.tokenID,
          resolutionDate: market.expiresAt || market.resolutionDate
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Failed to analyze market');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'HIGH': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400'; 
      case 'LOW': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceIcon = (confidence) => {
    switch (confidence) {
      case 'HIGH': return '🎯';
      case 'MEDIUM': return '⚖️';
      case 'LOW': return '❓';
      default: return '❓';
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* 3D Scene Background */}
      <div className="fixed inset-0 z-0">
        <Scene3D 
          weatherData={weatherData}
          isLoading={isLoadingWeather}
        />
      </div>
      
      {/* Scrollable Content Container */}
      <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-12">
          <div className="mb-6 sm:mb-0">
            <h1 className={`text-4xl sm:text-4xl font-thin tracking-wide ${textColor}`}>
              Weather-Sensitive Edges
            </h1>
            <p className={`text-sm ${textColor} opacity-60 mt-3 font-light max-w-md`}>
              Top-ranked prediction markets with exploitable weather-related inefficiencies
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <PageNav currentPage="Discovery" isNight={isNight} />
            
            <ConnectKitButton
              mode={isNight ? "dark" : "light"}
              customTheme={{
                "--ck-accent-color": isNight ? "#3b82f6" : "#1e293b",
                "--ck-accent-text": "#ffffff",
                "--ck-primary-button-background": isNight ? "rgba(255,255,255,0.2)" : "#1f2937",
              }}
            />
          </div>
        </header>

        {/* Search and Filters */}
        <div className={`backdrop-blur-xl border rounded-3xl p-6 mb-8 transition-all duration-300 ${
          isNight ? 'bg-slate-900/60 border-white/20' : 'bg-white/60 border-white/40'
        }`}>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search by location (e.g. Chicago, Miami, New York)..."
       className={`w-full px-4 py-2.5 rounded-xl text-sm font-light ${
          isNight
            ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
            : 'bg-black/10 border border-black/20 text-black placeholder-black/50'
        } focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all`}
      disabled={isLoading}
    />
            </div>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className={`px-4 py-2.5 rounded-xl text-sm font-light ${
                isNight 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-black/10 border border-black/20 text-black'
              } focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all`}
              disabled={isLoading}
            >
              <option value="all">All Categories</option>
              <option value="Sports">Sports</option>
              <option value="Weather">Weather</option>
            </select>

            {/* Volume Filter */}
            <select
              value={filters.minVolume}
              onChange={(e) => setFilters(prev => ({ ...prev, minVolume: e.target.value }))}
              className={`px-4 py-2.5 rounded-xl text-sm font-light ${
                isNight 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-black/10 border border-black/20 text-black'
              } focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all`}
              disabled={isLoading}
            >
              <option value="10000">$10k+ Volume</option>
              <option value="50000">$50k+ Volume</option>
              <option value="100000">$100k+ Volume</option>
            </select>

            {/* Search Button */}
            <button
              type="submit"
              disabled={!searchQuery.trim() || isLoading}
              className={`px-8 py-2.5 rounded-xl text-sm font-light transition-all disabled:opacity-40 border ${
                isNight
                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30'
                  : 'bg-blue-400/20 hover:bg-blue-400/30 text-blue-800 border-blue-500/30'
              }`}
            >
              Search
            </button>
          </form>
        </div>

        {/* Results Summary */}
        {!isLoading && !error && (
          <div className={`${textColor} opacity-70 text-sm mb-4`}>
            Found {markets.length} weather-sensitive markets
            {filters.search && ` for "${filters.search}"`}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className={`w-6 h-6 border-2 ${
              isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'
            } rounded-full animate-spin`}></div>
            <span className={`ml-3 ${textColor} opacity-70`}>Loading markets...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className={`backdrop-blur-md border rounded-2xl p-6 max-w-md text-center ${
              isNight ? 'bg-red-500/20 border-red-500/30' : 'bg-red-400/20 border-red-400/30'
            }`}>
              <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
              <button
                onClick={fetchMarkets}
                className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                  isNight
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-black/20 hover:bg-black/30 text-black'
                }`}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Markets Grid */}
        {!isLoading && !error && markets.length > 0 && (
          <div className="space-y-4">
            {markets.map((market, index) => {
              const isExpanded = expandedMarketId === market.id;
              const isHidden = expandedMarketId && !isExpanded;
              
              return (
              <div
                key={market.id || index}
                className={`backdrop-blur-xl border rounded-3xl transition-all duration-500 ${
                  isExpanded
                    ? 'fixed inset-4 p-8 z-40 overflow-y-auto'
                    : 'p-5 sm:p-6'
                } ${
                  isHidden
                    ? 'opacity-0 pointer-events-none scale-95'
                    : `opacity-100 hover:scale-[1.01] ${
                      isNight 
                        ? 'bg-slate-900/70 border-white/20 hover:bg-slate-900/80' 
                        : 'bg-white/70 border-white/40 hover:bg-white/75'
                    }`
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Market Info */}
                  <div className="flex-1 space-y-3">
                    <h3 className={`text-lg font-light ${textColor} leading-relaxed tracking-wide`}>
                      {market.title || market.question}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                       {market.tags && market.tags.length > 0 && (
                          market.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className={`px-3 py-1 rounded-full font-light border ${
                              isNight ? 'bg-purple-500/10 text-purple-200 border-purple-500/20' : 'bg-purple-400/10 text-purple-800 border-purple-400/20'
                            }`}>
                              {typeof tag === 'string' ? tag : tag.label || tag}
                            </span>
                          ))
                        )}
                       
                       {market.volume24h && (
                         <span className={`px-3 py-1 rounded-full font-light border ${
                           isNight ? 'bg-orange-500/10 text-orange-200 border-orange-500/20' : 'bg-orange-400/10 text-orange-800 border-orange-400/20'
                         }`}>
                           ⚡ ${(market.volume24h / 1000).toFixed(0)}K
                         </span>
                       )}
                     </div>

                    {market.description && (
                      <div className={`${textColor} opacity-60 text-sm`}>
                        {market.description.substring(0, 120)}...
                      </div>
                    )}

                    {/* Enhanced Market Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className={`${textColor} opacity-80`}>
                        <span className="opacity-60">Volume (24h):</span> ${(market.volume24h || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>

                      {/* Volume Trend Indicator */}
                      {market.volumeMetrics?.volumeTrendDirection && market.volumeMetrics.volumeTrend !== undefined && (
                        <div className={`${textColor} opacity-80`}>
                          <span className="opacity-60">Volume Trend:</span>
                          <span className={`ml-1 ${
                            market.volumeMetrics.volumeTrendDirection === 'increasing' ? 'text-green-400' :
                            market.volumeMetrics.volumeTrendDirection === 'decreasing' ? 'text-red-400' :
                            'text-gray-400'
                          }`}>
                            {market.volumeMetrics.volumeTrend > 10 ? '↗️' :
                             market.volumeMetrics.volumeTrend < -10 ? '↘️' : '➡️'}
                            {Math.abs(market.volumeMetrics.volumeTrend).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* Enhanced Odds Display */}
                      {market.oddsAnalysis?.bestBid !== undefined && market.oddsAnalysis?.bestBid !== null && market.oddsAnalysis?.bestAsk !== undefined && market.oddsAnalysis?.bestAsk !== null ? (
                       <>
                          <div className={`${textColor} opacity-80`}>
                            <span className="opacity-60">Best Bid:</span> {(market.oddsAnalysis.bestBid * 100).toFixed(1)}%
                          </div>
                          <div className={`${textColor} opacity-80`}>
                            <span className="opacity-60">Best Ask:</span> {(market.oddsAnalysis.bestAsk * 100).toFixed(1)}%
                          </div>
                          {market.oddsAnalysis.spreadPercent > 0 && (
                            <div className={`${textColor} opacity-80`}>
                              <span className="opacity-60">Spread:</span>
                              <span className={`ml-1 ${
                                (market.oddsAnalysis.spreadPercent || 0) > 2 ? 'text-orange-400' : 'text-green-400'
                              }`}>
                                {market.oddsAnalysis.spreadPercent?.toFixed(1) || '0.0'}%
                              </span>
                            </div>
                          )}
                        </>
                       ) : market.currentOdds ? (
                        <>
                          <div className={`${textColor} opacity-80`}>
                            <span className="opacity-60">Yes:</span> {(market.currentOdds.yes * 100).toFixed(1)}%
                          </div>
                          <div className={`${textColor} opacity-80`}>
                            <span className="opacity-60">No:</span> {(market.currentOdds.no * 100).toFixed(1)}%
                          </div>
                        </>
                      ) : (
                        <>
                          {market.bid !== undefined && (
                            <div className={`${textColor} opacity-80`}>
                              <span className="opacity-60">Bid:</span> {(market.bid * 100).toFixed(1)}%
                            </div>
                          )}
                          {market.ask !== undefined && (
                            <div className={`${textColor} opacity-80`}>
                              <span className="opacity-60">Ask:</span> {(market.ask * 100).toFixed(1)}%
                            </div>
                          )}
                        </>
                      )}

                      {/* Market Depth Indicator */}
                      {market.oddsAnalysis?.marketDepth?.marketDepth && (
                        <div className={`${textColor} opacity-80`}>
                          <span className="opacity-60">Market Depth:</span>
                          <span className={`ml-1 ${
                            market.oddsAnalysis.marketDepth.marketDepth === 'deep' ? 'text-green-400' :
                            market.oddsAnalysis.marketDepth.marketDepth === 'moderate' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {market.oddsAnalysis.marketDepth.marketDepth}
                          </span>
                        </div>
                      )}

                      {market.liquidity && (
                        <div className={`${textColor} opacity-80`}>
                          <span className="opacity-60">Liquidity:</span> ${(market.liquidity / 1000).toFixed(0)}K
                        </div>
                      )}

                      {/* Enrichment source indicator */}
                      {market.enrichmentSource && (
                        <div className={`${textColor} opacity-60 text-xs`}>
                          <span className="capitalize">{market.enrichmentSource.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Edge Score Display */}
                    {market.edgeScore !== undefined && market.confidence && (
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded-full text-xs font-light border ${
                            market.confidence === 'HIGH' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            market.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                            'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {getConfidenceIcon(market.confidence)} Weather Edge: {market.confidence}
                          </div>

                          <div className={`text-xs ${textColor} opacity-60`}>
                            Score: {market.edgeScore.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Analyze Button or Back Button */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <button
                        onClick={() => setExpandedMarketId(null)}
                        className={`px-6 py-3 rounded-2xl font-light text-sm transition-all duration-300 border ${
                          isNight
                            ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                            : 'bg-black/10 hover:bg-black/20 text-black border-black/20'
                        }`}
                      >
                        ← Back
                      </button>
                    ) : (
                      <button
                        onClick={() => analyzeMarket(market)}
                        disabled={isAnalyzing}
                        className={`px-6 py-3 rounded-2xl font-light text-sm transition-all duration-300 disabled:opacity-40 hover:scale-105 border ${
                          isNight
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-blue-200 border-blue-400/30'
                            : 'bg-gradient-to-r from-blue-400/20 to-purple-400/20 hover:from-blue-400/30 hover:to-purple-400/30 text-blue-800 border-blue-500/30'
                        }`}
                      >
                        {isAnalyzing && selectedMarket?.id === market.id ? (
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 border ${
                              isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'
                            } rounded-full animate-spin`}></div>
                            <span>Analyzing...</span>
                          </div>
                        ) : (
                          'Analyze Edge'
                        )}
                      </button>
                    )}
                    </div>
                    </div>

                    {/* Expanded Analysis View */}
                    {isExpanded && (
                    <div className="mt-8 pt-8 border-t border-white/10">
                    <div className="mb-8">
                      <h2 className={`text-2xl font-light ${textColor} mb-2`}>Weather Edge Analysis</h2>
                      <p className={`${textColor} opacity-60 text-sm`}>AI-powered market analysis</p>
                    </div>

                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className={`w-12 h-12 border-2 ${
                          isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'
                        } rounded-full animate-spin mb-4`}></div>
                        <span className={`${textColor} opacity-70`}>Running AI analysis on weather impact...</span>
                      </div>
                    ) : analysis ? (
                      <div className="space-y-6">
                        {/* Assessment Summary */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl mb-2">{getConfidenceIcon(analysis.assessment?.confidence)}</div>
                            <div className={`text-sm ${textColor} opacity-70 mb-1`}>Confidence</div>
                            <div className={`text-sm font-light ${getConfidenceColor(analysis.assessment?.confidence)}`}>
                              {analysis.assessment?.confidence || 'UNKNOWN'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">
                              {analysis.assessment?.weather_impact === 'HIGH' ? '⚠️' : 
                               analysis.assessment?.weather_impact === 'MEDIUM' ? '⚡' : '✅'}
                            </div>
                            <div className={`text-sm ${textColor} opacity-70 mb-1`}>Weather Impact</div>
                            <div className={`text-sm font-light ${textColor}`}>
                              {analysis.assessment?.weather_impact || 'UNKNOWN'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">
                              {analysis.assessment?.odds_efficiency === 'INEFFICIENT' ? '🎯' : '⚖️'}
                            </div>
                            <div className={`text-sm ${textColor} opacity-70 mb-1`}>Market Efficiency</div>
                            <div className={`text-sm font-light ${
                              analysis.assessment?.odds_efficiency === 'INEFFICIENT' ? 'text-orange-400' : 'text-green-400'
                            }`}>
                              {analysis.assessment?.odds_efficiency || 'UNKNOWN'}
                            </div>
                          </div>
                        </div>

                        {/* Analysis Reasoning */}
                        <div className={`backdrop-blur-sm border rounded-xl p-4 ${
                          isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
                        }`}>
                          <h4 className={`text-sm font-light ${textColor} opacity-90 mb-3`}>AI Analysis</h4>
                          <p className={`text-sm ${textColor} opacity-80 leading-relaxed`}>
                            {analysis.reasoning || 'Analysis details not available'}
                          </p>
                        </div>

                        {/* Key Factors */}
                        {analysis.key_factors && analysis.key_factors.length > 0 && (
                          <div>
                            <h4 className={`text-sm font-light ${textColor} opacity-90 mb-3`}>Key Factors</h4>
                            <ul className="space-y-2">
                              {analysis.key_factors.map((factor, idx) => (
                                <li key={idx} className={`text-sm ${textColor} opacity-70 flex items-start`}>
                                  <span className="mr-3 mt-2 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span>
                                  {factor}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendation */}
                        {analysis.recommended_action && (
                          <div className={`backdrop-blur-sm border rounded-xl p-4 ${
                            isNight ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-400/10 border-blue-400/20'
                          }`}>
                            <h4 className={`text-sm font-light ${textColor} opacity-90 mb-2`}>Recommendation</h4>
                            <p className={`text-sm ${textColor} opacity-80`}>
                              {analysis.recommended_action}
                            </p>
                          </div>
                        )}

                        {/* Trade Button */}
                        <div className="flex justify-center pt-4">
                          <button
                            onClick={() => {
                              console.log('Trade button clicked for market:', market.id);
                              alert('Trading functionality coming soon!');
                            }}
                            className={`px-8 py-3 rounded-xl font-light transition-all duration-300 hover:scale-105 ${
                              isNight
                                ? 'bg-gradient-to-r from-green-500/40 to-blue-500/40 hover:from-green-500/60 hover:to-blue-500/60 text-white border border-white/20'
                                : 'bg-gradient-to-r from-green-400/40 to-blue-400/40 hover:from-green-400/60 hover:to-blue-400/60 text-black border border-black/20'
                            }`}
                          >
                            Trade This Edge →
                          </button>
                        </div>

                        {/* Cache Info */}
                        {analysis.cached && (
                          <div className={`text-xs ${textColor} opacity-50 text-center`}>
                            Results cached from {analysis.source} • Analysis time saved
                          </div>
                        )}

                        {/* Disclaimer */}
                        <div className={`text-xs ${textColor} opacity-40 text-center pt-4 border-t ${
                          isNight ? 'border-white/10' : 'border-black/10'
                        }`}>
                          AI analysis for informational purposes only. Always do your own research.
                        </div>
                      </div>
                    ) : (
                      <div className={`text-center py-12 ${textColor} opacity-60`}>
                        Analysis failed. Please try again.
                      </div>
                    )}
                    </div>
                    )}
                    </div>
                    );
                    })}
                    </div>
                    )}

        {/* No Results */}
        {!isLoading && !error && markets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className={`backdrop-blur-md border rounded-2xl p-8 max-w-md text-center ${
              isNight ? 'bg-white/10 border-white/20' : 'bg-white/20 border-white/30'
            }`}>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className={`${textColor} text-lg font-light mb-2`}>No Markets Found</h3>
              <p className={`${textColor} opacity-60 text-sm mb-4`}>
                Try adjusting your filters or search for different locations
              </p>
              <button
                onClick={() => {
                  setFilters({ category: 'all', minVolume: '10000', search: '' });
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                  isNight
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-black/20 hover:bg-black/30 text-black'
                }`}
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
        </div>
        </div>

        {/* Analysis Modal */}
      {showAnalysisModal && selectedMarket && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAnalysisModal(false)}
        >
          <div
            className={`${
              isNight ? 'bg-black/40' : 'bg-white/20'
            } backdrop-blur-md rounded-3xl border ${
              isNight ? 'border-white/20' : 'border-white/30'
            } p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className={`${textColor} font-light text-xl`}>Weather Edge Analysis</h3>
                <p className={`${textColor} opacity-60 text-sm mt-1 leading-relaxed`}>
                  {selectedMarket.title}
                </p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                className={`${textColor} opacity-60 hover:opacity-100 transition-opacity`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Analysis Content */}
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-12">
                <div className={`w-8 h-8 border-2 ${
                  isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'
                } rounded-full animate-spin`}></div>
                <span className={`ml-4 ${textColor} opacity-70`}>
                  Running AI analysis on weather impact...
                </span>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {/* Assessment Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">{getConfidenceIcon(analysis.assessment?.confidence)}</div>
                    <div className={`text-sm ${textColor} opacity-70 mb-1`}>Confidence</div>
                    <div className={`text-sm font-light ${getConfidenceColor(analysis.assessment?.confidence)}`}>
                      {analysis.assessment?.confidence || 'UNKNOWN'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {analysis.assessment?.weather_impact === 'HIGH' ? '⚠️' : 
                       analysis.assessment?.weather_impact === 'MEDIUM' ? '⚡' : '✅'}
                    </div>
                    <div className={`text-sm ${textColor} opacity-70 mb-1`}>Weather Impact</div>
                    <div className={`text-sm font-light ${textColor}`}>
                      {analysis.assessment?.weather_impact || 'UNKNOWN'}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {analysis.assessment?.odds_efficiency === 'INEFFICIENT' ? '🎯' : '⚖️'}
                    </div>
                    <div className={`text-sm ${textColor} opacity-70 mb-1`}>Market Efficiency</div>
                    <div className={`text-sm font-light ${
                      analysis.assessment?.odds_efficiency === 'INEFFICIENT' ? 'text-orange-400' : 'text-green-400'
                    }`}>
                      {analysis.assessment?.odds_efficiency || 'UNKNOWN'}
                    </div>
                  </div>
                </div>

                {/* Analysis Reasoning */}
                <div className={`backdrop-blur-sm border rounded-xl p-4 ${
                  isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
                }`}>
                  <h4 className={`text-sm font-light ${textColor} opacity-90 mb-3`}>AI Analysis</h4>
                  <p className={`text-sm ${textColor} opacity-80 leading-relaxed`}>
                    {analysis.reasoning || 'Analysis details not available'}
                  </p>
                </div>

                {/* Key Factors */}
                {analysis.key_factors && analysis.key_factors.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-light ${textColor} opacity-90 mb-3`}>Key Factors</h4>
                    <ul className="space-y-2">
                      {analysis.key_factors.map((factor, index) => (
                        <li key={index} className={`text-sm ${textColor} opacity-70 flex items-start`}>
                          <span className="mr-3 mt-2 w-1.5 h-1.5 bg-current rounded-full flex-shrink-0"></span>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                {analysis.recommended_action && (
                  <div className={`backdrop-blur-sm border rounded-xl p-4 ${
                    isNight ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-400/10 border-blue-400/20'
                  }`}>
                    <h4 className={`text-sm font-light ${textColor} opacity-90 mb-2`}>Recommendation</h4>
                    <p className={`text-sm ${textColor} opacity-80`}>
                      {analysis.recommended_action}
                    </p>
                  </div>
                )}

                {/* Trade Button */}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => {
                      // Integration point: Connect to your existing trade flow
                      console.log('Trade button clicked for market:', selectedMarket.id);
                      alert('Trading functionality coming soon!');
                    }}
                    className={`px-8 py-3 rounded-xl font-light transition-all duration-300 hover:scale-105 ${
                      isNight
                        ? 'bg-gradient-to-r from-green-500/40 to-blue-500/40 hover:from-green-500/60 hover:to-blue-500/60 text-white border border-white/20'
                        : 'bg-gradient-to-r from-green-400/40 to-blue-400/40 hover:from-green-400/60 hover:to-blue-400/60 text-black border border-black/20'
                    }`}
                  >
                    Trade This Edge →
                  </button>
                </div>

                {/* Cache Info */}
                {analysis.cached && (
                  <div className={`text-xs ${textColor} opacity-50 text-center`}>
                    Results cached from {analysis.source} • Analysis time saved
                  </div>
                )}

                {/* Disclaimer */}
                <div className={`text-xs ${textColor} opacity-40 text-center pt-4 border-t ${
                  isNight ? 'border-white/10' : 'border-black/10'
                }`}>
                  AI analysis for informational purposes only. Always do your own research.
                </div>
              </div>
            ) : (
              <div className={`text-center py-12 ${textColor} opacity-60`}>
                Analysis failed. Please try again.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryPage;
