'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { weatherService } from '@/services/weatherService';
import { aiService } from '@/services/aiService';
// Enhanced validation-aware components
import ValidationAwareMarketSelector from './components/ValidationAwareMarketSelector';
import EnhancedAnalysisDisplay from './components/EnhancedAnalysisDisplay';
import EnhancedOrderForm from './components/EnhancedOrderForm';
import ValidationStatusBar from './components/ValidationStatusBar';

// Performance optimized validation hooks
import { 
  useLocationValidation, 
  useWeatherValidation,
  usePerformantValidation 
} from './components/usePerformantValidation';

// Keep legacy components as fallback
import MarketSelector from './components/MarketSelector';
import AnalysisDisplay from './components/AnalysisDisplay';
import OrderForm from './components/OrderForm';
import PageNav from '@/app/components/PageNav';
import Scene3D from '@/components/Scene3D';

export default function AIPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Weather state
  const [weatherData, setWeatherData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState('');
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Market state
  const [markets, setMarkets] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [marketFilters, setMarketFilters] = useState({
    eventType: 'all',
    confidence: 'MEDIUM', // Default to HIGH+MEDIUM
    bestEdgesOnly: true // Toggle for best edges
  });
  const [includeFutures, setIncludeFutures] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [maxDaysToResolution, setMaxDaysToResolution] = useState(14);
  const [minVolume, setMinVolume] = useState(50000);
  const [showMethodology, setShowMethodology] = useState(false);

  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('basic');

  // UI state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [error, setError] = useState(null);
  const [orderResult, setOrderResult] = useState(null);
  const [isNight, setIsNight] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour <= 6;
  });

  // Enhanced validation integration
  const [useEnhancedComponents, setUseEnhancedComponents] = useState(true);

  // Performance-optimized validations
  const locationValidation = useLocationValidation(
    selectedMarket?.eventType || selectedMarket?.title || 'General',
    currentLocation,
    { additionalContext: { title: selectedMarket?.title } }
  );

  const weatherValidation = useWeatherValidation(weatherData, {
    dataType: 'current',
    analysisType: 'outdoor-sports'
  });

  // Market compatibility validation
  const marketValidators = React.useMemo(() => ({
    compatibility: async (data, context) => {
      if (!data.market || !data.location) {
        return { valid: true, errors: [], warnings: [] };
      }

      const response = await fetch('/api/validate/market-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: data.market,
          location: data.location,
          weatherData: data.weatherData,
          requestedAnalysis: 'weather'
        }),
        signal: context?.signal
      });

      if (!response.ok) {
        throw new Error('Market compatibility validation failed');
      }

      return await response.json();
    }
  }), []);

  const marketValidation = usePerformantValidation(
    { market: selectedMarket, location: currentLocation, weatherData },
    marketValidators,
    { dependencies: [selectedMarket?.id, currentLocation] }
  );

  // Trading readiness validation
  const tradingValidation = {
    aggregateValidation: {
      valid: isConnected && selectedMarket,
      errors: !isConnected ? ['Wallet not connected'] : 
              !selectedMarket ? ['No market selected'] : [],
      warnings: [],
      hasData: true
    }
  };
  const [timeOfDay, setTimeOfDay] = useState(() => {
    const hour = new Date().getHours();
    if (hour >= 19 || hour <= 6) return 'night';
    if (hour >= 6 && hour < 8) return 'dawn';
    if (hour >= 17 && hour < 19) return 'dusk';
    return 'day';
  });

  // Load weather on mount
  useEffect(() => {
    loadWeather();
  }, []);

  // Fetch markets when weather loads or filters change
  useEffect(() => {
    if (weatherData) {
      fetchMarkets();
    }
  }, [weatherData, marketFilters]);

  // Refetch on search text change
  useEffect(() => {
    if (weatherData) {
      fetchMarkets();
    }
  }, [searchText, includeFutures, maxDaysToResolution, minVolume]);

  // Auto-set default horizon based on event type
  useEffect(() => {
    const type = marketFilters.eventType;
    let defaultDays = 14;
    if (type === 'Tennis' || type === 'Golf' || type === 'Weather') defaultDays = 7;
    else if (type === 'Soccer') defaultDays = 10;
    else if (type === 'F1') defaultDays = 14;
    else if (type === 'NFL' || type === 'NBA' || type === 'MLB' || type === 'NHL') defaultDays = 14;
    else if (type === 'Politics') defaultDays = 30;
    setMaxDaysToResolution(defaultDays);
  }, [marketFilters.eventType]);



  const loadWeather = async () => {
    setIsLoadingWeather(true);
    try {
      const location = await weatherService.getCurrentLocation();
      const data = await weatherService.getCurrentWeather(location);
      setWeatherData(data);
      setCurrentLocation(`${data.location.name}, ${data.location.region}`);
      setError(null);
    } catch (err) {
      // Fallback to default location
      try {
        const data = await weatherService.getCurrentWeather('Nairobi');
        setWeatherData(data);
        setCurrentLocation(`${data.location.name}, ${data.location.region}`);
        setError(null);
      } catch (fallbackErr) {
        setError('Unable to load weather data');
      }
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const fetchMarkets = async () => {
    if (!weatherData) return;
    setIsLoadingMarkets(true);
    setError(null);

    try {
      // Call edge-ranked discovery with user filters
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weatherData,
          location: null,
          eventType: marketFilters.eventType,
          confidence: marketFilters.confidence,
          limitCount: 12, // Fetch more to show when filters reduce results
          excludeFutures: !includeFutures,
          searchText,
          maxDaysToResolution,
          minVolume,
          theme: marketFilters.eventType === 'Sports' ? 'sports' : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMarkets(result.markets);
        if (result.markets.length > 0) {
          setSelectedMarket(result.markets[0]);
        } else {
          setError('No weather-sensitive markets found. Try adjusting filters.');
        }
      } else {
        setError(result.error || 'Failed to fetch markets');
      }
    } catch (err) {
      console.error('Market fetch failed:', err);
      setError('Unable to fetch markets');
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  const analyzeMarket = async (market = null, modeOverride = null) => {
    const marketToAnalyze = market || selectedMarket;
    if (!marketToAnalyze || !weatherData) return;
    setIsLoadingAnalysis(true);
    setError(null);
    setAnalysis(null);

    const result = await aiService.analyzeMarket({ ...marketToAnalyze, mode: modeOverride || analysisMode }, weatherData);
    console.log('🎯 Full analysis result:', result);

    if (result.success) {
      // Always use the full result object structure for backward compatibility
      const analysisData = {
        assessment: result.assessment || {},
        analysis: result.reasoning || result.analysis || 'No analysis available',
        key_factors: result.key_factors || [],
        recommended_action: result.recommended_action || 'Monitor manually',
        cached: result.cached || false,
        source: result.source || 'unknown',
        citations: result.citations || [],
        limitations: result.limitations || null,
        web_search: result.web_search || false,
        timestamp: result.timestamp
      };

      console.log('✅ Analysis data structure:', {
        hasAssessment: !!analysisData.assessment,
        hasAnalysis: !!analysisData.analysis,
        hasKeyFactors: !!analysisData.key_factors,
        recommendedAction: analysisData.recommended_action,
        reasoningLength: analysisData.analysis?.length
      });

      setAnalysis(analysisData);
    } else {
      console.log('❌ Analysis failed:', result.error);
      setError(result.error);
    }
    setIsLoadingAnalysis(false);
  };

  const analyzeMarketStream = async (market = null) => {
    const marketToAnalyze = market || selectedMarket;
    if (!marketToAnalyze || !weatherData) return;
    setIsLoadingAnalysis(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: marketToAnalyze.title || 'Prediction Market',
          location: weatherData?.location?.name || 'Unknown Location',
          currentOdds: { yes: marketToAnalyze.currentOdds?.yes || 0.5, no: marketToAnalyze.currentOdds?.no || 0.5 },
          participants: marketToAnalyze.description || 'Market participants',
          weatherData,
          marketID: marketToAnalyze.marketID,
          eventDate: marketToAnalyze.resolutionDate || null,
          mode: 'deep'
        })
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let base = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'meta') {
              base = {
                assessment: msg.assessment,
                analysis: '',
                key_factors: [],
                recommended_action: '',
                cached: msg.cached,
                source: msg.source,
                citations: [],
                limitations: null,
                web_search: msg.web_search,
                timestamp: msg.timestamp
              }
              setAnalysis(base)
            } else if (msg.type === 'chunk') {
              if (!base) continue
              base = { ...base, analysis: (base.analysis || '') + (base.analysis ? ' ' : '') + msg.text }
              setAnalysis(base)
            } else if (msg.type === 'complete') {
              const final = {
                assessment: msg.assessment,
                analysis: msg.analysis,
                key_factors: msg.key_factors,
                recommended_action: msg.recommended_action,
                cached: msg.cached,
                source: msg.source,
                citations: msg.citations,
                limitations: msg.limitations,
                web_search: msg.web_search,
                timestamp: msg.timestamp
              }
              setAnalysis(final)
              setIsLoadingAnalysis(false)
            }
          } catch (e) {
          }
        }
      }
      if (isLoadingAnalysis) setIsLoadingAnalysis(false)
    } catch (err) {
      setError('Analysis failed')
      setIsLoadingAnalysis(false)
    }
  }

  const handleSelectMarket = (market) => {
    setSelectedMarket(market);
    setAnalysis(null);
  };

  const handleAnalyzeMarket = (market) => {
    console.log('🧠 Analyzing market:', market.title, market.marketID);
    setSelectedMarket(market);
    analyzeMarket(market);
  };

  const handleOrderSuccess = (result) => {
    setOrderResult(result);
    setShowOrderForm(false);
    setTimeout(() => setOrderResult(null), 5000);
  };

  const handleQuickTrade = (market) => {
    setSelectedMarket(market);
    setShowOrderForm(true);
  };

  const nightStatus = useMemo(() => {
    if (!weatherData?.location?.localtime) return true;
    const localTime = weatherData.location.localtime;
    const currentHour = new Date(localTime).getHours();
    return currentHour >= 19 || currentHour <= 6;
  }, [weatherData?.location?.localtime]);

  // Set timeOfDay based on hour
  useEffect(() => {
    if (weatherData?.location?.localtime) {
      const localTime = weatherData.location.localtime;
      const currentHour = new Date(localTime).getHours();
      
      if (currentHour >= 19 || currentHour <= 6) {
        setTimeOfDay('night');
      } else if (currentHour >= 6 && currentHour < 8) {
        setTimeOfDay('dawn');
      } else if (currentHour >= 17 && currentHour < 19) {
        setTimeOfDay('dusk');
      } else {
        setTimeOfDay('day');
      }
      setIsNight(currentHour >= 19 || currentHour <= 6);
    }
  }, [weatherData?.location?.localtime]);

  const textColor = nightStatus ? 'text-white' : 'text-black';
  const bgColor = 'bg-black';
  const cardBgColor = nightStatus ? 'bg-slate-900/60 border-white/20' : 'bg-white/60 border-black/20';

  if (isLoadingWeather) {
    return (
      <div className={`w-screen h-screen flex items-center justify-center ${bgColor}`}>
        <div className="flex flex-col items-center">
          <div className={`w-12 h-12 border-4 border-current/30 border-t-current rounded-full animate-spin ${textColor} mb-4`}></div>
          <p className={`${textColor} font-light`}>Loading weather data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* 3D Scene Background - Ambient Quality for Performance */}
      <div className="fixed inset-0 z-0">
        <Scene3D 
          weatherData={weatherData}
          isLoading={isLoadingWeather}
          quality="ambient"
        />
      </div>
      
      {/* Scrollable Content Container */}
      <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
        {/* Header */}
        <header className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                Weather Edge Analysis
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                {currentLocation}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="AI" isNight={nightStatus} />
              <div className="hidden sm:flex items-center ml-2">
                <label className={`${textColor} text-xs opacity-70 mr-2`}>Analysis Mode</label>
                <select
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'}`}
                >
                  <option value="basic">Basic (Free)</option>
                  <option value="deep">Deep (Research)</option>
                </select>
              </div>
              <ConnectKitButton mode={nightStatus ? "dark" : "light"} />
            </div>
          </div>
        </header>

        {/* Global Validation Status Bar */}
        <ValidationStatusBar
          locationValidation={locationValidation}
          weatherValidation={weatherValidation}
          marketValidation={marketValidation}
          tradingValidation={tradingValidation}
          useEnhancedComponents={useEnhancedComponents}
          onToggleEnhanced={() => setUseEnhancedComponents(!useEnhancedComponents)}
          isNight={nightStatus}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex-1">
        {/* Filter Controls - Simplified */}
        <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-6`}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-3 py-1 text-xs rounded-full border ${
                nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
              }`}>
                Short-Horizon: ≤ {maxDaysToResolution}d
              </span>
              <span className={`px-3 py-1 text-xs rounded-full border ${
                nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
              }`}>
                Confidence: {marketFilters.confidence === 'MEDIUM' ? 'High + Medium' : marketFilters.confidence}
              </span>
              <span className={`px-3 py-1 text-xs rounded-full border ${
                (minVolume >= 100000)
                  ? (nightStatus ? 'bg-green-600/30 border-green-400/40 text-green-200' : 'bg-green-200/60 border-green-400/50 text-green-900')
                  : (minVolume >= 50000)
                  ? (nightStatus ? 'bg-orange-600/30 border-orange-400/40 text-orange-200' : 'bg-orange-200/60 border-orange-400/50 text-orange-900')
                  : (nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black')
              }`}>
                Min Vol: ${(minVolume/1000).toFixed(0)}k+
              </span>
              <span className={`px-3 py-1 text-xs rounded-full border ${
                nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
              }`}>
                Futures: {includeFutures ? 'On' : 'Off'}
              </span>
              <span className={`px-3 py-1 text-xs rounded-full border ${
                nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
              }`}>
                Event: {marketFilters.eventType}
              </span>
            </div>
            {/* Best Edges Only Toggle */}
            <div className="flex items-center justify-between">
              <label className={`${textColor} text-sm font-light`}>Best Edges Only</label>
              <button
                onClick={() => setMarketFilters(prev => ({ ...prev, bestEdgesOnly: !prev.bestEdgesOnly }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  marketFilters.bestEdgesOnly
                    ? (nightStatus ? 'bg-blue-600' : 'bg-blue-500')
                    : (nightStatus ? 'bg-slate-600' : 'bg-slate-400')
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    marketFilters.bestEdgesOnly ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Include Futures Toggle */}
            <div className="flex items-center justify-between">
              <label className={`${textColor} text-sm font-light`}>Include Futures</label>
              <button
                onClick={() => setIncludeFutures(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  includeFutures
                    ? (nightStatus ? 'bg-blue-600' : 'bg-blue-500')
                    : (nightStatus ? 'bg-slate-600' : 'bg-slate-400')
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    includeFutures ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Event Type Filter */}
            <div>
              <label className={`${textColor} text-xs opacity-60 block mb-2`}>Event Type</label>
              <select
                value={marketFilters.eventType}
                onChange={(e) => setMarketFilters(prev => ({ ...prev, eventType: e.target.value }))}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border transition-all ${
                 nightStatus
                   ? 'bg-white/10 border-white/20 text-white focus:ring-2 focus:ring-blue-400' 
                   : 'bg-black/10 border-black/20 text-black focus:ring-2 focus:ring-blue-400'
                 } focus:outline-none`}
              >
                <option value="all">All Types</option>
                <option value="Sports">Sports (All)</option>
                <option value="NFL">NFL</option>
                <option value="NBA">NBA</option>
                <option value="MLB">MLB</option>
                <option value="NHL">NHL</option>
                <option value="Soccer">Soccer</option>
                <option value="Tennis">Tennis</option>
                <option value="Cricket">Cricket</option>
                <option value="F1">Formula 1</option>
                <option value="Golf">Golf</option>
                <option value="Weather">Weather</option>
                <option value="Politics">Politics</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className={`${textColor} text-xs opacity-60 block mb-2`}>Search Markets</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="e.g., Premier League, Wimbledon, Formula 1"
                className={`w-full px-4 py-2.5 text-sm rounded-xl border transition-all ${
                  nightStatus
                    ? 'bg-white/10 border-white/20 text-white placeholder-white/50 focus:ring-2 focus:ring-blue-400'
                    : 'bg-black/10 border-black/20 text-black placeholder-black/50 focus:ring-2 focus:ring-blue-400'
                } focus:outline-none`}
              />
            </div>

            {/* Min Volume Filter */}
            <div>
              <label className={`${textColor} text-xs opacity-60 block mb-2`}>Minimum 24h Volume</label>
              <select
                value={String(minVolume)}
                onChange={(e) => setMinVolume(parseInt(e.target.value))}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border transition-all ${
                  nightStatus
                    ? 'bg-white/10 border-white/20 text-white focus:ring-2 focus:ring-blue-400'
                    : 'bg-black/10 border-black/20 text-black focus:ring-2 focus:ring-blue-400'
                } focus:outline-none`}
              >
                <option value="10000">$10k+</option>
                <option value="50000">$50k+</option>
                <option value="100000">$100k+</option>
              </select>
            </div>

            {/* Confidence Filter */}
            <div>
              <label className={`${textColor} text-xs opacity-60 block mb-2`}>Confidence Level</label>
              <select
                value={marketFilters.confidence}
                onChange={(e) => setMarketFilters(prev => ({ ...prev, confidence: e.target.value }))}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border transition-all ${
                  nightStatus
                     ? 'bg-white/10 border-white/20 text-white focus:ring-2 focus:ring-blue-400' 
                     : 'bg-black/10 border-black/20 text-black focus:ring-2 focus:ring-blue-400'
                 } focus:outline-none`}
              >
                <option value="HIGH">High Confidence</option>
                <option value="MEDIUM">High + Medium</option>
                <option value="LOW">Low+</option>
              </select>
            </div>

            {/* Max Days to Resolution */}
            <div>
              <label className={`${textColor} text-xs opacity-60 block mb-2`}>Max Days to Resolution</label>
              <input
                type="range"
                min={3}
                max={60}
                step={1}
                value={maxDaysToResolution}
                onChange={(e) => setMaxDaysToResolution(parseInt(e.target.value))}
                className="w-full"
              />
              <div className={`${textColor} text-xs opacity-70 mt-1`}>{maxDaysToResolution} days</div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setMaxDaysToResolution(7)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
                  }`}
                >
                  7d
                </button>
                <button
                  onClick={() => setMaxDaysToResolution(14)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
                  }`}
                >
                  14d
                </button>
                <button
                  onClick={() => setMaxDaysToResolution(30)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    nightStatus ? 'bg-white/10 border-white/20 text-white' : 'bg-black/10 border-black/20 text-black'
                  }`}
                >
                  30d
                </button>
              </div>
            </div>

            {/* Methodology Link */}
            <button
              onClick={() => setShowMethodology(!showMethodology)}
              className={`w-full py-2 text-xs font-light rounded-lg transition-all opacity-70 hover:opacity-100 ${textColor}`}
            >
              {showMethodology ? '▼ Hide Methodology' : '▶ How We Score Edges'}
            </button>
          </div>
        </div>

        {/* Methodology - Expandable */}
        {showMethodology && (
          <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 mb-6`}>
            <h3 className={`${textColor} text-sm font-light mb-4`}>Edge Scoring Methodology</h3>
            <div className={`space-y-3 text-xs ${textColor} opacity-80 leading-relaxed`}>
              <div>
                <p className="font-light opacity-90 mb-1">Weather Impact Analysis</p>
                <p className="opacity-70">AI analyzes how weather conditions (precipitation, wind, temperature, humidity) affect event outcomes based on historical patterns and participant adaptation.</p>
              </div>
              <div>
                <p className="font-light opacity-90 mb-1">Odds Efficiency Detection</p>
                <p className="opacity-70">Compares AI-assessed probability vs. current market odds to identify mispricings where weather factors aren't fully reflected.</p>
              </div>
              <div>
                <p className="font-light opacity-90 mb-1">Confidence Scoring</p>
                <p className="opacity-70">HIGH = Strong weather influence + clear odds misprice. MEDIUM = Moderate impact or uncertainty. LOW = Limited data or marginal edge.</p>
              </div>
              <div className="border-t border-current/20 pt-3 mt-3">
                <p className="opacity-60">Data sources: WeatherAPI, Polymarket CLOB, Historical performance data. Updated every 5 minutes.</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={`backdrop-blur-xl border rounded-3xl p-4 mb-6 ${
            nightStatus
              ? 'bg-red-500/20 border-red-500/30'
              : 'bg-red-400/20 border-red-400/30'
          }`}>
            <p className={`${textColor} text-sm`}>{error}</p>
            <button
              onClick={loadWeather}
              className={`mt-3 px-3 py-1 text-xs rounded transition-colors ${
                nightStatus
                  ? 'bg-red-500/30 hover:bg-red-500/50'
                  : 'bg-red-400/30 hover:bg-red-400/50'
              }`}
            >
              Retry
            </button>
          </div>
        )}

        <div className="space-y-6">
           {/* Markets - Full Width */}
           <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 max-h-[350px] overflow-y-auto`}>
             {isLoadingMarkets ? (
               <div className="flex justify-center py-12">
                 <div className={`w-8 h-8 border-2 border-current/30 border-t-current rounded-full animate-spin ${textColor}`}></div>
                 <p className={`${textColor} opacity-70 mt-3 text-sm`}>Finding markets...</p>
               </div>
             ) : markets && markets.length > 0 ? (
               useEnhancedComponents ? (
                 <ValidationAwareMarketSelector
                   markets={markets}
                   selectedMarket={selectedMarket}
                   onSelectMarket={handleSelectMarket}
                   onAnalyze={handleAnalyzeMarket}
                   onQuickTrade={handleQuickTrade}
                   validation={marketValidation}
                   isNight={nightStatus}
                   isLoading={isLoadingMarkets}
                 />
               ) : (
                 <MarketSelector
                   markets={markets}
                   selectedMarket={selectedMarket}
                   onSelectMarket={handleSelectMarket}
                   onAnalyze={handleAnalyzeMarket}
                   onQuickTrade={handleQuickTrade}
                   isNight={nightStatus}
                   isLoading={isLoadingMarkets}
                 />
               )
             ) : (
               <div className="text-center py-16">
                 <div className="text-5xl mb-4">🌤️</div>
                 <h3 className={`text-lg font-light ${textColor} mb-2`}>No Weather Edges Today</h3>
                 <p className={`text-sm ${textColor} opacity-70 leading-relaxed max-w-md mx-auto`}>
                   Weather conditions must change significantly for new mispricings to emerge. Check back when weather forecasts update or new events are added to the market.
                 </p>
                 <button
                   onClick={loadWeather}
                   className={`mt-6 px-4 py-2 text-xs font-light rounded-lg border transition-all ${
                     nightStatus
                       ? 'bg-blue-600/40 hover:bg-blue-600/60 border-blue-400/40 text-blue-100'
                       : 'bg-blue-200/60 hover:bg-blue-300/70 border-blue-400/50 text-blue-900'
                   }`}
                 >
                   Refresh Weather Data
                 </button>
               </div>
             )}
           </div>

          {/* Analysis & Trading - Full Width Below */}
          <div className="space-y-6">
            {/* Analysis Display */}
            {isLoadingAnalysis ? (
              <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-8 flex justify-center`}>
                <div className={`w-6 h-6 border-2 border-current/30 border-t-current rounded-full animate-spin ${textColor}`}></div>
              </div>
            ) : analysis ? (
              <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 max-h-96 overflow-y-auto`}>
                {useEnhancedComponents ? (
                  <EnhancedAnalysisDisplay
                    analysis={analysis}
                    selectedMarket={selectedMarket}
                    weatherData={weatherData}
                    validation={weatherValidation}
                    isNight={nightStatus}
                    onTrade={() => setShowOrderForm(!showOrderForm)}
                  />
                ) : (
                  <AnalysisDisplay
                    analysis={analysis}
                    selectedMarket={selectedMarket}
                    isNight={nightStatus}
                    onTrade={() => setShowOrderForm(!showOrderForm)}
                  />
                )}
              </div>
            ) : selectedMarket ? (
              <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-8 text-center`}>
                <p className={`${textColor} opacity-60 text-sm mb-4`}>
                  Ready to analyze this market?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => analyzeMarket(selectedMarket, 'basic')}
                    disabled={isLoadingAnalysis}
                    className={`py-3 rounded-2xl font-medium text-sm transition-all duration-300 border-2 ${
                      nightStatus
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 border-blue-300 text-white shadow-lg shadow-blue-500/50'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                    } disabled:opacity-40 hover:scale-105`}
                  >
                    Analyze (Standard)
                  </button>
                  <button
                    onClick={() => analyzeMarketStream(selectedMarket)}
                    disabled={isLoadingAnalysis}
                    className={`py-3 rounded-2xl font-medium text-sm transition-all duration-300 border-2 ${
                      nightStatus
                        ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 border-green-300 text-white shadow-lg shadow-green-500/50'
                        : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 border-green-400 text-white shadow-lg shadow-green-500/30'
                    } disabled:opacity-40 hover:scale-105`}
                  >
                    Analyze (Enhanced)
                  </button>
                </div>
                <p className={`${textColor} opacity-40 text-xs`}>
                  Standard: fast summary • Enhanced: web research and citations
                </p>
              </div>
            ) : (
              <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-8 text-center`}>
                <p className={`${textColor} opacity-60 text-sm mb-2`}>
                  No market selected
                </p>
                <p className={`${textColor} opacity-40 text-xs`}>
                  Choose a market from the list to begin
                </p>
              </div>
            )}

          {/* Order Form */}
          {showOrderForm && selectedMarket && (
            <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 max-h-96 overflow-y-auto`}>
              <h3 className={`text-lg font-light ${textColor} mb-4`}>
                Place Order - {selectedMarket.title}
              </h3>
              {useEnhancedComponents ? (
                <EnhancedOrderForm
                  market={selectedMarket}
                  walletAddress={address}
                  isConnected={isConnected}
                  onSuccess={handleOrderSuccess}
                  isNight={nightStatus}
                  chainId={chainId}
                  weatherData={weatherData}
                  validation={tradingValidation}
                />
              ) : (
                <OrderForm
                  market={selectedMarket}
                  walletAddress={address}
                  isConnected={isConnected}
                  onSuccess={handleOrderSuccess}
                  isNight={nightStatus}
                  chainId={chainId}
                />
              )}
            </div>
          )}

            {/* Order Success */}
            {orderResult?.success && (
              <div className={`backdrop-blur-xl border rounded-3xl p-4 ${
                nightStatus 
                  ? 'bg-green-500/20 border-green-500/30' 
                  : 'bg-green-400/20 border-green-400/30'
              }`}>
                <p className={`text-sm ${textColor}`}>
                  Order submitted successfully!
                </p>
                {orderResult.orderID && String(orderResult.orderID).startsWith('0x') && (
                  <a
                    href={`https://bscscan.com/tx/${orderResult.orderID}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${textColor} opacity-70 text-xs underline`}
                  >
                    View on BSCScan
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
