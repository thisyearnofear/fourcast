"use client";

import React, { useState, useEffect, useCallback } from "react";
import WalletConnect from "@/app/components/WalletConnect";
import { useSignalPublisher } from "@/hooks/useSignalPublisher";
import { useChainConnections } from "@/hooks/useChainConnections";
import useHUDStore from "@/hooks/useHUDStore";
import useFilterStore from "@/hooks/useFilterStore";
import { useWeather } from "@/hooks/useWeather";
import Scene3D from "@/components/Scene3D";
import { useGlobalToast } from "@/components/ToastProvider";
import PublishConfirmModal from "@/components/PublishConfirmModal";
import { OrderSigningPanel } from "@/components/OrderSigningPanel";
import KalshiOrderPanel from "@/components/KalshiOrderPanel";
import { MarketEdgeScanner } from "@/components/MarketEdgeScanner";
import { BRAND } from "@/constants/brand";
import { ArbitrageExecutionPanel } from "@/components/ArbitrageExecutionPanel";
import AnalysisOptions, { useAnalysisOptions } from "@/components/AnalysisOptions";
import AnalysisConfigModal from "@/components/AnalysisConfigModal";
import PricingOverlay from "@/components/PricingOverlay";
import NarrativeSteps from "@/components/NarrativeSteps";
import { SportsTabContent, DiscoveryTabContent } from "./components";

export default function MarketsPage() {
  // Unified chain connection state - single source of truth
  const chainConnections = useChainConnections();
  // console.log('[Markets Page] chainConnections:', chainConnections);

  // Provide default values to prevent undefined errors during initial render
  const { chains, canPerform, canPublish = false } = chainConnections || {};
  // console.log('[Markets Page] chains:', chains, 'canPerform:', canPerform, 'canPublish:', canPublish);

  // Read URL search params for pre-filtering from carousel landing
  const [urlParamsRead, setUrlParamsRead] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || urlParamsRead) return;

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const shareId = params.get('share_id');
    const searchQuery = params.get('q');

    if (category) {
      const categoryMap = {
        crypto: 'Crypto',
        sports: 'Sports',
        politics: 'Politics',
      };
      const mapped = categoryMap[category.toLowerCase()] || category;
      setDiscoveryFilters(prev => ({ ...prev, category: mapped }));
      setActiveTab('discovery');
    }

    // Handle shared analysis
    if (shareId) {
      window.__fourcast_autoAnalyzeId = shareId;
    }
    
    // Also read from localStorage if carousel landing stored interests
    if (!category && !shareId) {
      try {
        const interests = localStorage.getItem('fourcast_interests');
        if (interests) {
          const parsed = JSON.parse(interests);
          if (parsed.length === 1) {
            const categoryMap = {
              crypto: 'Crypto',
              sports: 'Sports',
              politics: 'Politics',
            };
            const mapped = categoryMap[parsed[0].toLowerCase()];
            if (mapped) {
              setDiscoveryFilters(prev => ({ ...prev, category: mapped }));
              setActiveTab('discovery');
            }
          }
        }
      } catch { /* ignore */ }
    }

    setUrlParamsRead(true);
  }, [urlParamsRead]);

  // Safety check: ensure all required values exist
  if (!chains) {
    console.error('[Markets Page] ChainConnections initialization failed:', {
      chains: !!chains,
      canPerform: !!canPerform,
      canPublish: typeof canPublish,
      chainConnections
    });
    return <div>Loading wallet connections...</div>;
  }
  // console.log('[Markets Page] ChainConnections initialized successfully');

  const {
    publishSignal,
    publishChain,
    getMySignalCount,
    isPublishing,
    publishError,
    connected: aptosConnected,
    walletAddress,
  } = useSignalPublisher();
  const { addToast, removeToast } = useGlobalToast();

  // Tab state: 'sports' or 'discovery' (persisted)
  const filterStore = useFilterStore();
  const activeTab = filterStore.marketsActiveTab;
  const setActiveTab = (tab) => filterStore.setMarketsActiveTab(tab);

  // Weather state (for UI theming and discovery mode)
  const { weatherData, isLoading: isLoadingWeather, currentLocationName, isNight } = useWeather();
  const { isHUDVisible } = useHUDStore();

  // Market state (shared across tabs)
  const [markets, setMarkets] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);

  // Shared analysis deep-link: auto-analyze specific market by share_id
  useEffect(() => {
    const shareId = window.__fourcast_autoAnalyzeId;
    if (!shareId || !markets || markets.length === 0) return;
    if (shareId === 'auto') return; // No longer supported — user must click Analyze

    const target = markets.find(m =>
      (m.marketID === shareId) || (m.id === shareId) || (m.tokenID === shareId)
    );
    if (target) {
      window.__fourcast_autoAnalyzeId = null;
      setTimeout(() => analyzeMarket(target), 300);
    }
  }, [markets]);

  // Analysis state (shared across tabs)
  const [analysis, setAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("basic");
  
  // Analysis config modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingMarket, setPendingMarket] = useState(null);
  
  // Analysis options (user toggles for weather, ML, futures, web search)
  const analysisOptions = useAnalysisOptions(selectedMarket?.eventType || 'unknown');

  // Sports-specific filters (persisted)
  const sportsFilters = filterStore.sportsFilters;
  const setSportsFilters = (f) => filterStore.setSportsFilters(f);
  const selectedDateRange = filterStore.selectedDateRange;
  const setSelectedDateRange = (r) => filterStore.setSelectedDateRange(r);
  const sportsMinVolume = filterStore.sportsMinVolume;
  const setSportsMinVolume = (v) => filterStore.setSportsMinVolume(v);

  // Discovery-specific filters (persisted)
  const discoveryFilters = filterStore.discoveryFilters;
  const setDiscoveryFilters = (f) => filterStore.setDiscoveryFilters(f);
  const discoveryDateRange = filterStore.discoveryDateRange;
  const setDiscoveryDateRange = (r) => filterStore.setDiscoveryDateRange(r);

  // Track record state (Brier scores, calibration)
  const [agentTrackStats, setAgentTrackStats] = useState(null);

  // Fetch agent track record on mount
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

  // Compute calibration score from Brier: Brier 0 = perfect → 100% Calibration
  const calibrationScore = agentTrackStats?.avg_brier_score != null
    ? Math.max(0, Math.round((1 - agentTrackStats.avg_brier_score) * 100))
    : null;
  const agentBrierScore = agentTrackStats?.avg_brier_score ?? null;

  // UI state
  const [error, setError] = useState(null);
  const [expandedMarketId, setExpandedMarketId] = useState(null);
  const [mySignalCount, setMySignalCount] = useState(null);

  // Order signing state
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [selectedMarketForOrder, setSelectedMarketForOrder] = useState(null);
  const [selectedKalshiMarket, setSelectedKalshiMarket] = useState(null);
  const [selectedArbitrage, setSelectedArbitrage] = useState(null);
  const [orderSide, setOrderSide] = useState("YES");
  const [showPricing, setShowPricing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [freeAnalysesUsed, setFreeAnalysesUsed] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('fourcast_free_analyses') || '0', 10);
  });

  // Fetch markets when tab or filters change (independent of user weather)
  useEffect(() => {
    fetchMarkets();
  }, [
    activeTab,
    sportsFilters,
    selectedDateRange,
    sportsMinVolume,
    discoveryFilters,
    discoveryDateRange,
  ]);

  useEffect(() => {
    if (canPublish) {
      getMySignalCount()
        .then(setMySignalCount)
        .catch(() => { });
    } else {
      setMySignalCount(null);
    }
  }, [canPublish, getMySignalCount]);

  const fetchMarkets = async () => {
    setIsLoadingMarkets(true);
    setError(null);

    try {
      const isSportsMode = activeTab === "sports";

      // Calculate max days based on selected date range
      let maxDaysToResolution = 7;
      let dateRange = selectedDateRange;

      if (isSportsMode) {
        if (dateRange === "today") maxDaysToResolution = 1;
        else if (dateRange === "tomorrow") maxDaysToResolution = 2;
        else if (dateRange === "this-week") maxDaysToResolution = 7;
        else if (dateRange === "later") maxDaysToResolution = 60;
      } else {
        dateRange = discoveryDateRange;
        if (dateRange === "today") maxDaysToResolution = 1;
        else if (dateRange === "tomorrow") maxDaysToResolution = 2;
        else if (dateRange === "this-week") maxDaysToResolution = 7;
        else if (dateRange === "later") maxDaysToResolution = 60;
      }

      const requestBody = isSportsMode
        ? {
          weatherData: null,
          location: null,
          eventType: sportsFilters.eventType,
          confidence: sportsFilters.confidence,
          limitCount: 50,
          maxDaysToResolution: maxDaysToResolution,
          minVolume: sportsMinVolume,
          analysisType: "event-weather",
          theme: sportsFilters.eventType === "Sports" ? "sports" : undefined,
          dateRange: selectedDateRange,
          excludeFutures: !sportsFilters.includeFutures,
        }
        : {
          location: null,
          eventType:
            discoveryFilters.category === "all"
              ? "all"
              : discoveryFilters.category,
          confidence: discoveryFilters.confidence,
          limitCount: 50,
          maxDaysToResolution: maxDaysToResolution,
          theme: "all",
          minVolume: parseInt(discoveryFilters.minVolume),
          analysisType: "discovery",
          weatherData: null,
          dateRange: discoveryDateRange,
          excludeFutures: !discoveryFilters.includeFutures,
        };

      console.log("[Markets Page] Fetching markets with request:", requestBody);

      const response = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log("[Markets Page] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Markets Page] API error response:", errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("[Markets Page] Result:", result);

      if (result.success) {
        if (Array.isArray(result.markets) && result.markets.length > 0) {
          console.log(
            "[Markets Page] Success! Got",
            result.markets.length,
            "markets"
          );
          setMarkets(result.markets);
          setSelectedMarket(result.markets[0]);
        } else {
          console.log("[Markets Page] Empty markets array");
          setMarkets([]);
          setError(
            result.message || "No markets found. Try adjusting filters."
          );
        }
      } else {
        console.error(
          "[Markets Page] API returned success=false:",
          result.error
        );
        setError(result.error || "Failed to fetch markets");
      }
    } catch (err) {
      console.error("[Markets Page] Market fetch failed:", err);
      setError("Unable to fetch markets: " + err.message);
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  const analyzeMarket = async (market, mode = analysisMode) => {
    if (!market) return;
    setIsLoadingAnalysis(true);
    setError(null);
    setAnalysis(null);
    setSelectedMarket(market);
    setExpandedMarketId(market.marketID || market.id || market.tokenID);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: market.eventType || market.title || "Market",
          title: market.title || market.question,
          location: market.location || market.eventLocation || "",
          weatherData: null,
          currentOdds:
            market.currentOdds ||
            (market.bid !== undefined && market.ask !== undefined
              ? { yes: Number(market.ask), no: Number(market.bid) }
              : null),
          participants: market.teams || [],
          marketID: market.marketID || market.id || market.tokenID,
          eventDate: market.resolutionDate || market.expiresAt || null,
          mode,
          // Analysis factor toggles from user preferences
          includeWeather: analysisOptions.includeWeather,
          includeSynthData: analysisOptions.includeSynthData,
          includeFutures: analysisOptions.includeFutures,
          webSearchEnabled: analysisOptions.webSearchEnabled,
          analysisTypes: analysisOptions.analysisTypes || [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data);
        // Track free analysis usage
        const used = parseInt(localStorage.getItem('fourcast_free_analyses') || '0', 10) + 1;
        localStorage.setItem('fourcast_free_analyses', String(used));
        setFreeAnalysesUsed(used);

        // Show upsell toast after 2 free analyses
        if (used === 2) {
          addToast(
            "Free analysis used 2/3. One more left — then upgrade for unlimited access.",
            'info',
            6000
          );
        }
        if (used === 3) {
          addToast(
            "You've used all free analyses. Upgrade to Pro for unlimited AI analysis.",
            'info',
            8000
          );
        }
      } else {
        // Check if rate limited (429)
        if (response.status === 429) {
          setShowPricing(true);
          setError("You've used your free analyses. Upgrade to Pro for unlimited AI analysis.");
        } else {
          setError(data.error || "Analysis failed");
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze market");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Open analysis config modal instead of running directly
  const openAnalyzeConfig = (market) => {
    setPendingMarket(market);
    setShowConfigModal(true);
  };

  // Run analysis with config from modal
  const analyzeMarketWithConfig = async (config) => {
    if (!pendingMarket) return;
    
    const market = pendingMarket;
    setShowConfigModal(false);
    setIsLoadingAnalysis(true);
    setError(null);
    setAnalysis(null);
    setSelectedMarket(market);
    setExpandedMarketId(market.marketID || market.id || market.tokenID);

    try {
      const requestBody = {
        eventType: market.eventType || market.title || "Market",
        title: market.title || market.question,
        location: market.location || market.eventLocation || "",
        weatherData: null,
        currentOdds:
          market.currentOdds ||
          (market.bid !== undefined && market.ask !== undefined
            ? { yes: Number(market.ask), no: Number(market.bid) }
            : null),
        participants: market.teams || [],
        marketID: market.marketID || market.id || market.tokenID,
        eventDate: market.resolutionDate || market.expiresAt || null,
        // Map modal's 'quick/standard/deep' to API's 'basic/detailed/deep'
        mode: (config.depth === 'quick' ? 'basic' : config.depth === 'standard' ? 'detailed' : config.depth) || analysisMode,
        // Config from modal
        includeWeather: config.includeWeather,
        includeSynthData: config.includeSynthData,
        includeFutures: config.includeFutures,
        webSearchEnabled: config.includeWebSearch,
        analysisTypes: [
          ...(config.includeFundamental ? ['fundamental'] : []),
          ...(config.includeTechnical ? ['technical'] : []),
          ...(config.includeSentiment ? ['sentiment'] : []),
        ],
        // Provider preferences
        aiProvider: config.providers?.aiProvider,
        weatherProvider: config.providers?.weatherProvider,
        marketDataProvider: config.providers?.marketDataProvider,
      };

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data);
        const used = parseInt(localStorage.getItem('fourcast_free_analyses') || '0', 10) + 1;
        localStorage.setItem('fourcast_free_analyses', String(used));
        setFreeAnalysesUsed(used);
        if (used === 2) {
          addToast(
            "Free analysis used 2/3. One more left — then upgrade for unlimited access.",
            'info', 6000
          );
        }
        if (used === 3) {
          addToast(
            "You've used all free analyses. Upgrade to Pro for unlimited AI analysis.",
            'info', 8000
          );
        }
      } else {
        if (response.status === 429) {
          setShowPricing(true);
          setError("You've used your free analyses. Upgrade to Pro for unlimited AI analysis.");
        } else {
          setError(data.error || "Analysis failed");
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze market");
    } finally {
      setIsLoadingAnalysis(false);
      setPendingMarket(null);
    }
  };

  const handlePublishSignal = useCallback(async () => {
    if (!selectedMarket || !analysis) return;

    // Check if can publish to any chain (Aptos or Movement)
    if (!canPublish) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      addToast(
        "Connect a wallet — Arc testnet for USDC settlement, or Aptos/Movement for legacy testnet signals",
        "warning",
        5000
      );
      return;
    }

    try {
      // 1. Save to SQLite first (fast feedback)
      const targetChain = publishChain || (chains.movement.connected ? 'movement' : 'aptos');
      const rawAddress =
        targetChain === 'arc'
          ? chains.arc?.address || chains.evm?.address
          : chains[targetChain]?.address;
      const authorAddress = typeof rawAddress === 'string' ? rawAddress : String(rawAddress || '');

      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selectedMarket,
          analysis,
          weather: weatherData,
          authorAddress,
          publishChain: targetChain,
          chainOrigin: targetChain.toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        addToast(`Failed to save signal: ${result.error}`, "error", 5000);
        return;
      }

      const signalData = {
        event_id: selectedMarket.marketID || selectedMarket.id,
        market_title: selectedMarket.title || selectedMarket.question,
        venue: selectedMarket.location || selectedMarket.eventLocation || "",
        event_time: selectedMarket.resolutionDate
          ? Math.floor(new Date(selectedMarket.resolutionDate).getTime() / 1000)
          : 0,
        market_snapshot_hash: result.snapshotHash || result.id,
        weather_json: weatherData,
        ai_digest: analysis.reasoning || analysis.analysis || "",
        confidence: analysis.assessment?.confidence || "UNKNOWN",
        odds_efficiency: analysis.assessment?.odds_efficiency || "UNKNOWN",
        weather_hash: result.weatherHash || null,
        ai_digest_hash: result.aiDigestHash || null,
      };

      const { txHash, chain: settledChain } = await publishSignal(signalData, result.id);

      if (txHash) {
        await fetch("/api/signals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: result.id,
            tx_hash: txHash,
            chain_origin: settledChain?.toUpperCase(),
          }),
        });
        if (settledChain !== 'arc') {
          try {
            const c = await getMySignalCount();
            setMySignalCount(c);
          } catch { /* ignore */ }
        }

        const explorer =
          settledChain === 'arc'
            ? `https://arc-explorer.thecanteenapp.com/tx/${txHash}`
            : null;

        addToast(
          settledChain === 'arc'
            ? `Published on Arc · ${txHash.slice(0, 10)}…`
            : `Call recorded on-chain · ${txHash.slice(0, 10)}…`,
          "success",
          5000,
          explorer || "/signals",
          explorer ? "Arc Explorer" : "View Track Record"
        );
      } else {
        addToast(
          `Saved locally; on-chain publish failed: ${publishError || "Unknown error"}`,
          "warning",
          5000
        );
      }
    } catch (err) {
      console.error("Failed to publish signal:", err);
      addToast("Failed to record prediction", "error", 5000);
    }
  }, [selectedMarket, analysis, canPublish, chains, weatherData, addToast, publishSignal, publishChain, publishError, getMySignalCount]);

  const textColor = isNight ? "text-white" : "text-black";
  const cardBgColor = isNight
    ? "bg-slate-900/60 border-white/20"
    : "bg-white/60 border-black/20";

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

      {/* Analysis Config Modal */}
      <AnalysisConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfirm={analyzeMarketWithConfig}
        market={pendingMarket}
        isLoading={isLoadingAnalysis}
        defaultOptions={analysisOptions}
      />

      {/* Scrollable Content */}
      <div className={`relative z-20 flex flex-col min-h-screen overflow-y-auto transition-opacity duration-500 ${isHUDVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <header
          className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <div>
              <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                Markets
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                {activeTab === "sports"
                  ? "Sports predictions with weather-aware analysis"
                  : BRAND.pages.markets}
              </p>
              {/* Narrative step — step 2 & 3: Analyze → Publish/Trade */}
              <NarrativeSteps currentStep="analyze" isNight={isNight} className="mt-3" />
            </div>
            </div>
            <div className="flex items-center space-x-3">
              <PageNav currentPage="Markets" isNight={isNight} />
              <div className="hidden sm:flex items-center ml-2">
                <label className={`${textColor} text-xs opacity-70 mr-2`}>
                  Analysis Mode
                </label>
                <select
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${isNight
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-black/10 border-black/20 text-black"
                    }`}
                >
                  <option value="basic">Basic (Free)</option>
                  <option value="deep">Deep (Research)</option>
                </select>
              </div>
              {/* Analysis Factor Toggles - Compact inline mode */}
              <div className="hidden lg:flex items-center">
                <AnalysisOptions
                  marketType={selectedMarket?.eventType || activeTab === 'sports' ? 'sports' : 'crypto'}
                  compact={true}
                  className="ml-2"
                />
              </div>
              <div className="flex items-center space-x-2">
                <WalletConnect isNight={isNight} />
                {canPublish && (
                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] border ${isNight
                      ? "bg-white/10 border-white/20 text-white/80"
                      : "bg-black/10 border-black/20 text-black/70"
                      }`}
                  >
                    My signals: {mySignalCount ?? "—"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
            <SecondaryNav
              items={[
                { id: "sports", label: "Sports & Events", icon: "🏆" },
                { id: "discovery", label: "Crypto, Finance & More", icon: "📈" },
              ]}
              activeItem={activeTab}
              onChange={setActiveTab}
              isNight={isNight}
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex-1">
          {/* Active Chain Indicators */}
          <div className="mb-6 space-y-6">
            {/* Live Edge Scanner - Discovery Hook */}
            <MarketEdgeScanner 
              markets={markets} 
              onAnalyze={openAnalyzeConfig} 
              isNight={isNight} 
            />
          </div>

          {/* Sports Tab Content */}
          {activeTab === "sports" && (
            <SportsTabContent
              markets={markets}
              isLoading={isLoadingMarkets}
              error={error}
              filters={sportsFilters}
              setFilters={setSportsFilters}
              dateRange={selectedDateRange}
              setDateRange={setSelectedDateRange}
              minVolume={sportsMinVolume}
              setMinVolume={setSportsMinVolume}
              onAnalyze={openAnalyzeConfig}
              isNight={isNight}
              textColor={textColor}
              cardBgColor={cardBgColor}
              expandedMarketId={expandedMarketId}
              setExpandedMarketId={setExpandedMarketId}
              analysis={analysis}
              isAnalyzing={isLoadingAnalysis}
              selectedMarket={selectedMarket}
              onPublishSignal={() => setShowPublishConfirm(true)}
              analysisMode={analysisMode}
              fetchMarkets={fetchMarkets}
              chains={chains}
              canPublish={canPublish}
              setShowOrderPanel={setShowOrderPanel}
              setSelectedMarketForOrder={setSelectedMarketForOrder}
              setSelectedKalshiMarket={setSelectedKalshiMarket}
              setOrderSide={setOrderSide}
              setSelectedArbitrage={setSelectedArbitrage}
              agentBrierScore={agentBrierScore}
              calibrationScore={calibrationScore}
            />
          )}

          {/* Discovery Tab Content */}
          {activeTab === "discovery" && (
            <DiscoveryTabContent
              markets={markets}
              isLoading={isLoadingMarkets}
              error={error}
              filters={discoveryFilters}
              setFilters={setDiscoveryFilters}
              dateRange={discoveryDateRange}
              setDateRange={setDiscoveryDateRange}
              onAnalyze={openAnalyzeConfig}
              isNight={isNight}
              textColor={textColor}
              cardBgColor={cardBgColor}
              expandedMarketId={expandedMarketId}
              setExpandedMarketId={setExpandedMarketId}
              analysis={analysis}
              isAnalyzing={isLoadingAnalysis}
              selectedMarket={selectedMarket}
              onPublishSignal={() => setShowPublishConfirm(true)}
              fetchMarkets={fetchMarkets}
              chains={chains}
              canPublish={canPublish}
              setShowOrderPanel={setShowOrderPanel}
              setSelectedMarketForOrder={setSelectedMarketForOrder}
              setSelectedKalshiMarket={setSelectedKalshiMarket}
              setOrderSide={setOrderSide}
              setSelectedArbitrage={setSelectedArbitrage}
              agentBrierScore={agentBrierScore}
              calibrationScore={calibrationScore}
            />
          )}
        </main>
      </div>

      {/* Modal Layers */}
      {
        showOrderPanel &&        selectedMarketForOrder && (
          <OrderSigningPanel
            market={selectedMarketForOrder}
            analysis={analysis}
            isNight={isNight}
            initialSide={orderSide}
            onClose={() => {
              setShowOrderPanel(false);
              setSelectedMarketForOrder(null);
            }}
            onSuccess={(tx) => {
              addToast("Order submitted successfully!", "success");
              setShowOrderPanel(false);
            }}
          />
        )
      }

      {/* Pricing Overlay */}
      <PricingOverlay
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        isNight={isNight}
      />

      {/* Publish Confirmation Modal */}
      <PublishConfirmModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={() => {
          setShowPublishConfirm(false);
          handlePublishSignal();
        }}
        market={selectedMarket}
        analysis={analysis}
        isNight={isNight}
        isPublishing={isPublishing}
      />

      {
        selectedKalshiMarket && (
          <KalshiOrderPanel
            market={selectedKalshiMarket}
            isNight={isNight}
            onClose={() => setSelectedKalshiMarket(null)}
          />
        )
      }

      {
        selectedArbitrage && (
          <ArbitrageExecutionPanel
            opportunity={selectedArbitrage}
            isNight={isNight}
            onClose={() => setSelectedArbitrage(null)}
          />
        )
      }
    </div >
  );
}
