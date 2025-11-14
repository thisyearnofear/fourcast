'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConnectKitButton } from 'connectkit';
import PageNav from '@/app/components/PageNav';
import { polymarketService } from '@/services/polymarketService';

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

  // Theme detection (matches your existing pattern)
  const [isNight, setIsNight] = useState(true);
  
  useEffect(() => {
    const hour = new Date().getHours();
    setIsNight(hour >= 19 || hour <= 6);
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
      let result;
      
      if (filters.search) {
        // Search for weather-sensitive markets by location
        result = await polymarketService.searchMarketsByLocation(filters.search);
      } else {
        // Get all active markets
        result = await polymarketService.getAllMarkets();
      }

      if (Array.isArray(result)) {
        // If getAllMarkets returns array directly
        setMarkets(result.slice(0, 50));
      } else if (result.markets) {
        // If searchMarketsByLocation returns object with markets
        let filtered = result.markets;
        
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
    setIsAnalyzing(true);
    setShowAnalysisModal(true);
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
    <div className={`min-h-screen ${bgClass} transition-all duration-500`}>
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-black/5" />
      
      <div className="relative z-10 p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className={`text-2xl sm:text-3xl font-thin tracking-wide ${textColor}`}>
              Weather Market Discovery
            </h1>
            <p className={`text-sm ${textColor} opacity-60 mt-1`}>
              Find prediction markets with weather-driven edge opportunities
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
        <div className={`backdrop-blur-md border rounded-2xl p-4 mb-6 ${
          isNight ? 'bg-white/10 border-white/20' : 'bg-white/20 border-white/30'
        }`}>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by location (e.g. Chicago, Miami)..."
                className={`w-full px-4 py-2 rounded-lg text-sm ${
                  isNight 
                    ? 'bg-white/10 border border-white/20 text-white placeholder-white/60' 
                    : 'bg-white/30 border border-white/40 text-black placeholder-black/60'
                } focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all`}
                disabled={isLoading}
              />
            </div>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className={`px-4 py-2 rounded-lg text-sm ${
                isNight 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-white/30 border border-white/40 text-black'
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
              className={`px-4 py-2 rounded-lg text-sm ${
                isNight 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-white/30 border border-white/40 text-black'
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
              className={`px-6 py-2 rounded-lg text-sm font-light transition-all disabled:opacity-40 ${
                isNight
                  ? 'bg-blue-500/30 hover:bg-blue-500/50 text-blue-300'
                  : 'bg-blue-400/30 hover:bg-blue-400/50 text-blue-700'
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
          <div className="grid gap-4 sm:gap-6">
            {markets.map((market, index) => (
              <div
                key={market.id || index}
                className={`backdrop-blur-md border rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02] ${
                  isNight 
                    ? 'bg-white/10 border-white/20 hover:bg-white/15' 
                    : 'bg-white/20 border-white/30 hover:bg-white/25'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Market Info */}
                  <div className="flex-1 space-y-2">
                    <h3 className={`text-lg font-light ${textColor} leading-relaxed`}>
                      {market.title || market.question}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {market.tags && market.tags.length > 0 && (
                        market.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className={`px-2 py-1 rounded-full ${
                            isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-400/20 text-purple-700'
                          }`}>
                            {tag}
                          </span>
                        ))
                      )}
                      
                      {market.volume24h && (
                        <span className={`px-2 py-1 rounded-full ${
                          isNight ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-400/20 text-orange-700'
                        }`}>
                          ⚡ ${(market.volume24h / 1000).toFixed(0)}K vol
                        </span>
                      )}
                    </div>

                    {market.description && (
                      <div className={`${textColor} opacity-60 text-sm`}>
                        {market.description.substring(0, 120)}...
                      </div>
                    )}

                    {/* Market Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className={`${textColor} opacity-80`}>
                        <span className="opacity-60">Volume (24h):</span> ${(market.volume24h || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </div>
                      
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
                      
                      {market.liquidity && (
                        <div className={`${textColor} opacity-80`}>
                          <span className="opacity-60">Liquidity:</span> ${(market.liquidity / 1000).toFixed(0)}K
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Analyze Button */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => analyzeMarket(market)}
                      disabled={isAnalyzing}
                      className={`px-6 py-3 rounded-xl font-light text-sm transition-all duration-300 disabled:opacity-40 hover:scale-105 ${
                        isNight
                          ? 'bg-gradient-to-r from-blue-500/40 to-purple-500/40 hover:from-blue-500/60 hover:to-purple-500/60 text-white border border-white/20'
                          : 'bg-gradient-to-r from-blue-400/40 to-purple-400/40 hover:from-blue-400/60 hover:to-purple-400/60 text-black border border-black/20'
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
                  </div>
                </div>
              </div>
            ))}
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