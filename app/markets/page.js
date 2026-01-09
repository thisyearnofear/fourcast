"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import WalletConnect from "@/app/components/WalletConnect";
import { useAptosSignalPublisher } from "@/hooks/useAptosSignalPublisher";
import { useChainConnections } from "@/hooks/useChainConnections";
import { weatherService } from "@/services/weatherService";
import { arbitrageService } from "@/services/arbitrageService";
import PageNav from "@/app/components/PageNav";
import Scene3D from "@/components/Scene3D";
import { useToast, ToastContainer } from "@/components/Toast";
import { OrderSigningPanel } from "@/components/OrderSigningPanel";
import KalshiOrderPanel from "@/components/KalshiOrderPanel";
import { CHAINS } from "@/constants/appConstants";
import { getChainActionGuidance, getRecommendationExplanation } from "@/utils/chainUtils";

export default function MarketsPage() {
  // Unified chain connection state - single source of truth
  const chainConnections = useChainConnections();
  console.log('[Markets Page] chainConnections:', chainConnections);
  
  const { chains, canPerform, canPublish } = chainConnections || {};
  console.log('[Markets Page] chains:', chains, 'canPerform:', canPerform, 'canPublish:', canPublish);
  
  // Safety check: ensure all required values exist
  if (!chains || typeof canPublish === 'undefined') {
    console.error('[Markets Page] ChainConnections initialization failed:', {
      chains: !!chains,
      canPerform: !!canPerform,
      canPublish: typeof canPublish,
      chainConnections
    });
    return <div>Error loading wallet connections. Please refresh the page.</div>;
  }
  console.log('[Markets Page] ChainConnections initialized successfully');

  const {
    publishToAptos,
    getMySignalCount,
    isPublishing,
    publishError,
    connected: aptosConnected,
    walletAddress,
  } = useAptosSignalPublisher();
  const { toasts, addToast, removeToast } = useToast();

  // Tab state: 'sports' or 'discovery'
  const [activeTab, setActiveTab] = useState("sports");

  // Weather state (for UI theming and discovery mode)
  const [weatherData, setWeatherData] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Market state (shared across tabs)
  const [markets, setMarkets] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);

  // Analysis state (shared across tabs)
  const [analysis, setAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("basic");

  // Sports-specific filters (date-first)
  const [sportsFilters, setSportsFilters] = useState({
    eventType: "Soccer",
    confidence: "all",
    includeFutures: false,
    bestEdgesOnly: true,
  });
  const [selectedDateRange, setSelectedDateRange] = useState("this-week");
  const [sportsMinVolume, setSportsMinVolume] = useState(10000);

  // Discovery-specific filters (date-first)
  const [discoveryFilters, setDiscoveryFilters] = useState({
    category: "all",
    minVolume: "50000",
    confidence: "all",
    includeFutures: false,
    platform: "all", // 'all', 'polymarket', 'kalshi'
  });
  const [discoveryDateRange, setDiscoveryDateRange] = useState("this-week");
  const [showArbitrage, setShowArbitrage] = useState(false); // Arbitrage detection toggle

  // UI state
  const [error, setError] = useState(null);
  const [expandedMarketId, setExpandedMarketId] = useState(null);
  const [isNight, setIsNight] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 19 || hour <= 6;
  });
  const [mySignalCount, setMySignalCount] = useState(null);

  // Order signing state
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [selectedMarketForOrder, setSelectedMarketForOrder] = useState(null);
  const [selectedKalshiMarket, setSelectedKalshiMarket] = useState(null);

  // Load weather on mount
  useEffect(() => {
    loadWeather();
  }, []);

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

  const loadWeather = async () => {
    setIsLoadingWeather(true);
    try {
      const location = await weatherService.getCurrentLocation();
      const data = await weatherService.getCurrentWeather(location);
      setWeatherData(data);

      // Update theme
      if (data?.location?.localtime) {
        const currentHour = new Date(data.location.localtime).getHours();
        setIsNight(currentHour >= 19 || currentHour <= 6);
      }
      setError(null);
    } catch (err) {
      try {
        const data = await weatherService.getCurrentWeather("Nairobi");
        setWeatherData(data);
        setError(null);
      } catch (fallbackErr) {
        console.warn("Unable to load weather:", fallbackErr.message);
        setError(null);
      }
    } finally {
      setIsLoadingWeather(false);
    }
  };

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
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data);
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze market");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handlePublishSignal = useCallback(async () => {
    if (!selectedMarket || !analysis) return;

    // Check if can publish to any chain (Aptos or Movement)
    if (!canPublish) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      addToast(
        "Connect your Aptos or Movement wallet to publish your signal on-chain",
        "warning",
        5000
      );
      return;
    }

    try {
      // 1. Save to SQLite first (fast feedback)
      // Use Movement address if available, otherwise Aptos
      const publishChain = chains.movement.connected ? 'movement' : 'aptos';
      const authorAddress = chains[publishChain].address;

      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selectedMarket,
          analysis,
          weather: weatherData,
          authorAddress,
          publishChain,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        addToast(`Failed to save signal: ${result.error}`, "error", 5000);
        return;
      }

      // 2. Publish to Aptos
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

      const txHash = await publishToAptos(signalData);

      if (txHash) {
        // Update SQLite with tx_hash
        await fetch("/api/signals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: result.id,
            tx_hash: txHash,
          }),
        });
        try {
          const c = await getMySignalCount();
          setMySignalCount(c);
        } catch { }

        addToast(
          `Signal published on-chain · TX: ${txHash.slice(0, 10)}...`,
          "success",
          5000,
          "/signals",
          "View Signals"
        );
      } else {
        addToast(
          `Signal saved locally but Aptos publish failed: ${publishError || "Unknown error"}`,
          "warning",
          5000
        );
      }
    } catch (err) {
      console.error("Failed to publish signal:", err);
      addToast("Failed to publish signal", "error", 5000);
    }
  }, [selectedMarket, analysis, canPublish, chains, weatherData, addToast, publishToAptos]);

  const textColor = isNight ? "text-white" : "text-black";
  const bgColor = "bg-black";
  const cardBgColor = isNight
    ? "bg-slate-900/60 border-white/20"
    : "bg-white/60 border-black/20";

  if (isLoadingWeather) {
    return (
      <div
        className={`w-screen h-screen flex items-center justify-center ${bgColor}`}
      >
        <div className="flex flex-col items-center">
          <div
            className={`w-12 h-12 border-4 border-current/30 border-t-current rounded-full animate-spin ${textColor} mb-4`}
          ></div>
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} isNight={isNight} />

      {/* Scrollable Content */}
      <div className="relative z-20 flex flex-col min-h-screen overflow-y-auto">
        {/* Header */}
        <header
          className={`sticky top-0 z-50 border-b ${cardBgColor} backdrop-blur-md`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex justify-between items-center">
            <div>
              <h1 className={`text-3xl font-thin ${textColor} tracking-wide`}>
                Markets
              </h1>
              <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
                {activeTab === "sports"
                  ? "Event weather analysis for sports markets"
                  : "Discover high-volume prediction markets globally"}
              </p>
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
            <div
              className={`inline-flex rounded-2xl p-1 border ${cardBgColor} backdrop-blur-xl`}
            >
              <button
                onClick={() => setActiveTab("sports")}
                className={`px-6 py-2.5 rounded-xl text-sm font-light transition-all ${activeTab === "sports"
                  ? isNight
                    ? "bg-blue-500/30 text-white border border-blue-400/40"
                    : "bg-blue-400/30 text-black border border-blue-500/40"
                  : `${textColor} opacity-60 hover:opacity-100`
                  }`}
              >
                ⚽ Sports (Event Weather)
              </button>
              <button
                onClick={() => setActiveTab("discovery")}
                className={`px-6 py-2.5 rounded-xl text-sm font-light transition-all ${activeTab === "discovery"
                  ? isNight
                    ? "bg-purple-500/30 text-white border border-purple-400/40"
                    : "bg-purple-400/30 text-black border border-purple-500/40"
                  : `${textColor} opacity-60 hover:opacity-100`
                  }`}
              >
                🔍 All Markets (Discovery)
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex-1">
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
              onAnalyze={analyzeMarket}
              isNight={isNight}
              textColor={textColor}
              cardBgColor={cardBgColor}
              expandedMarketId={expandedMarketId}
              setExpandedMarketId={setExpandedMarketId}
              analysis={analysis}
              isAnalyzing={isLoadingAnalysis}
              selectedMarket={selectedMarket}
              onPublishSignal={handlePublishSignal}
              analysisMode={analysisMode}
              fetchMarkets={fetchMarkets}
              chains={chains}
              setShowOrderPanel={setShowOrderPanel}
              setSelectedMarketForOrder={setSelectedMarketForOrder}
              setSelectedKalshiMarket={setSelectedKalshiMarket}
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
              onAnalyze={analyzeMarket}
              isNight={isNight}
              textColor={textColor}
              cardBgColor={cardBgColor}
              expandedMarketId={expandedMarketId}
              setExpandedMarketId={setExpandedMarketId}
              analysis={analysis}
              isAnalyzing={isLoadingAnalysis}
              selectedMarket={selectedMarket}
              onPublishSignal={handlePublishSignal}
              fetchMarkets={fetchMarkets}
              chains={chains}
              setShowOrderPanel={setShowOrderPanel}
              setSelectedMarketForOrder={setSelectedMarketForOrder}
              setSelectedKalshiMarket={setSelectedKalshiMarket}
            />
          )}
        </main>
      </div>

      {/* Modal Layers */}
      {
        showOrderPanel && selectedMarketForOrder && (
          <OrderSigningPanel
            market={selectedMarketForOrder}
            isNight={isNight}
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

      {
        selectedKalshiMarket && (
          <KalshiOrderPanel
            market={selectedKalshiMarket}
            isNight={isNight}
            onClose={() => setSelectedKalshiMarket(null)}
          />
        )
      }
    </div >
  );
}

// Sports Tab Component - Date-First Design
function SportsTabContent({
  markets,
  isLoading,
  error,
  filters,
  setFilters,
  dateRange,
  setDateRange,
  minVolume,
  setMinVolume,
  onAnalyze,
  isNight,
  textColor,
  cardBgColor,
  expandedMarketId,
  setExpandedMarketId,
  analysis,
  isAnalyzing,
  selectedMarket,
  onPublishSignal,
  analysisMode,
  fetchMarkets,
  chains,
  setShowOrderPanel,
  setSelectedMarketForOrder,
  setSelectedKalshiMarket,
}) {
  const dateRangeLabels = {
    today: "Today",
    tomorrow: "Tomorrow",
    "this-week": "This Week",
    later: "Later",
  };

  return (
    <div className="space-y-6">
      {/* Compact Filter Bar */}
      <div
        className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-3 space-y-2`}
      >
        {/* Event Type */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Event Type
          </label>
          <select
            value={filters.eventType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, eventType: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="Soccer">⚽ Soccer</option>
            <option value="NFL">🏈 NFL</option>
            <option value="F1">🏎️ Formula 1</option>
            <option value="all">All Sports</option>
          </select>
        </div>

        {/* Date Range Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            When
          </label>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(dateRangeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all font-light ${dateRange === key
                  ? isNight
                    ? "bg-blue-500/30 text-white border-blue-400/40"
                    : "bg-blue-400/30 text-black border-blue-500/40"
                  : isNight
                    ? "bg-white/10 hover:bg-white/20 text-white/70 border-white/20"
                    : "bg-black/10 hover:bg-black/20 text-black/70 border-black/20"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Min Volume */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Min Volume
          </label>
          <select
            value={String(minVolume)}
            onChange={(e) => setMinVolume(parseInt(e.target.value))}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="10000">$10k+</option>
            <option value="50000">$50k+</option>
            <option value="100000">$100k+</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Confidence
          </label>
          <select
            value={String(filters.confidence)}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, confidence: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="all">All</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Include Futures
          </label>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                includeFutures: !prev.includeFutures,
              }))
            }
            className={`inline-flex items-center w-12 h-6 rounded-full border transition-all ${filters.includeFutures
              ? isNight
                ? "bg-green-500/40 border-green-400/40"
                : "bg-green-400/30 border-green-500/40"
              : isNight
                ? "bg-white/10 border-white/20"
                : "bg-black/10 border-black/20"
              }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white/80 transform transition-transform ${filters.includeFutures ? "translate-x-6" : "translate-x-1"
                }`}
            />
          </button>
        </div>
      </div>

      {dateRange === "later" && (
        <div
          className={`mt-2 ${cardBgColor} backdrop-blur-xl border rounded-3xl p-3`}
        >
          <p className={`text-xs ${textColor} opacity-80`}>
            Weather-based analysis becomes less reliable beyond ~14 days.
          </p>
        </div>
      )}

      {/* Markets List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div
            className={`w-6 h-6 border-2 ${isNight
              ? "border-white/30 border-t-white"
              : "border-black/30 border-t-black"
              } rounded-full animate-spin`}
          ></div>
          <span className={`ml-3 ${textColor} opacity-70`}>
            Loading markets...
          </span>
        </div>
      )}

      {error && (
        <div
          className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 text-center`}
        >
          <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setDateRange("this-week");
                setMinVolume(10000);
                setFilters((prev) => ({
                  ...prev,
                  confidence: "all",
                  includeFutures: true,
                }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-light ${isNight
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-black/20 hover:bg-black/30 text-black"
                }`}
            >
              Broaden Filters
            </button>
            <button
              onClick={fetchMarkets}
              className={`px-4 py-2 rounded-lg text-sm font-light ${isNight
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-black/20 hover:bg-black/30 text-black"
                }`}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && markets && markets.length > 0 && (
        <div className="space-y-4">
          {markets.map((market, index) => (
            <MarketCard
               key={market.marketID || market.id || index}
               market={market}
               onAnalyze={onAnalyze}
               isNight={isNight}
               textColor={textColor}
               cardBgColor={cardBgColor}
               isExpanded={
                 expandedMarketId ===
                 (market.marketID || market.id || market.tokenID)
               }
               expandedMarketId={expandedMarketId}
               setExpandedMarketId={setExpandedMarketId}
               analysis={analysis}
               isAnalyzing={isAnalyzing}
               selectedMarket={selectedMarket}
               onPublishSignal={onPublishSignal}
               chains={chains}
               canPublish={canPublish}
               setShowOrderPanel={setShowOrderPanel}
               setSelectedMarketForOrder={setSelectedMarketForOrder}
               setSelectedKalshiMarket={setSelectedKalshiMarket}
              />
          ))}
        </div>
      )}
    </div>
  );
}

// Chain Recommendation Badge - Shows recommended action inline
function ChainRecommendationBadge({ recommendation, isNight }) {
  const config = {
    PUBLISH: {
      icon: "📡",
      text: "Publish Signal",
      color: isNight ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-purple-400/20 text-purple-800 border-purple-400/30"
    },
    TRADE: {
      icon: "📊",
      text: "Place Order",
      color: isNight ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-blue-400/20 text-blue-800 border-blue-400/30"
    },
    BOTH: {
      icon: "⚡",
      text: "Publish & Trade",
      color: isNight ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-400/20 text-amber-800 border-amber-400/30"
    }
  };
  
  const rec = config[recommendation];
  if (!rec) return null;
  
  return (
    <span className={`px-3 py-1 rounded-full font-light border ${rec.color}`}>
      {rec.icon} {rec.text}
    </span>
  );
}

// Chain Action Widget - Guide user on next steps with wallet validation
function ChainActionWidget({
  analysis,
  market,
  isNight,
  textColor,
  cardBgColor,
  onPublishSignal,
  chains,
  setShowOrderPanel,
  setSelectedMarketForOrder,
}) {
  const { switchToEvmNetwork } = useChainConnections();

  if (!analysis?.chain_recommendation) return null;

  const rec = analysis.chain_recommendation;
  const shouldPublish = rec === "PUBLISH" || rec === "BOTH";
  const shouldTrade = rec === "TRADE" || rec === "BOTH";

  const publishButtonText = shouldTrade ? "Also Publish Signal" : "Publish Signal";
  const tradeButtonText = shouldPublish ? "Also Trade" : "Place Order";

  // Get explanation for why this action is recommended
  const explanation = getRecommendationExplanation(
    rec,
    analysis.assessment?.confidence,
    analysis.assessment?.odds_efficiency
  );

  // Helper to render chain action with smart wallet validation and network switching
  const renderChainAction = (chainDef, chainState, isPrimary, buttonText, actionFn, contextMsg, needsNetworkSwitch = false, onSwitchNetwork = null) => {
    const isDisabled = !chainState.connected || needsNetworkSwitch;
    const buttonLabel = !chainState.connected 
      ? `Connect ${chainDef.name}`
      : needsNetworkSwitch
      ? `Switch to ${chainState.currentNetwork?.display || 'correct network'}`
      : buttonText;

    return (
      <div className={`flex items-start gap-3 pb-3 border-b border-white/10 last:pb-0 last:border-0 ${
        isPrimary ? (isNight ? "bg-gradient-to-r from-purple-500/5 to-transparent" : "bg-gradient-to-r from-purple-400/5 to-transparent") : ""
      } rounded px-3 py-2`}>
        <span className="text-xl flex-shrink-0">{chainDef.icon}</span>
        <div className="flex-1">
          <h5 className={`text-sm font-medium ${textColor} mb-1`}>
            {chainDef.display}
            {isPrimary && <span className={`ml-2 text-xs opacity-60 ${isNight ? "text-amber-300" : "text-amber-700"}`}>← Recommended</span>}
          </h5>
          <p className={`text-xs ${textColor} opacity-60 mb-3 leading-relaxed`}>
            {contextMsg}
          </p>
          {needsNetworkSwitch && chainState.currentNetwork && (
            <p className={`text-xs mb-2 ${isNight ? "text-amber-300/70" : "text-amber-700/70"}`}>
              Currently on: {chainState.currentNetwork.display}
            </p>
          )}
          <button
            onClick={() => {
              if (needsNetworkSwitch && onSwitchNetwork) {
                onSwitchNetwork();
              } else if (chainState.connected) {
                actionFn();
              }
            }}
            disabled={isDisabled}
            className={`px-4 py-2 rounded-lg text-xs font-light transition-all ${
              !isDisabled
                ? isNight
                  ? `${chainDef.id === 'movement' 
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30' 
                      : chainDef.color === 'purple'
                      ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30'
                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'}`
                  : `${chainDef.id === 'movement' 
                      ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 border border-amber-400/30' 
                      : chainDef.color === 'purple'
                      ? 'bg-purple-400/20 hover:bg-purple-400/30 text-purple-800 border border-purple-400/30'
                      : 'bg-blue-400/20 hover:bg-blue-400/30 text-blue-800 border border-blue-400/30'}`
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-5`}>
      <h4 className={`text-xs font-light ${textColor} opacity-70 mb-4 uppercase tracking-wider`}>
        Recommended Actions
      </h4>
      <div className="space-y-1">
        {/* Explanation Header */}
        <div className={`mb-3 p-3 rounded-lg ${isNight ? "bg-white/5 border border-white/10" : "bg-black/5 border border-black/10"}`}>
          <p className={`text-xs ${textColor} font-medium mb-1`}>
            {explanation.title}
          </p>
          <p className={`text-xs ${textColor} opacity-60`}>
            {explanation.reason}
          </p>
        </div>

        {shouldPublish && (
          // Prefer Movement if available (better monetization), else Aptos
          chains.movement.connected ? renderChainAction(
            CHAINS.MOVEMENT,
            chains.movement,
            rec === "PUBLISH",
            publishButtonText,
            () => onPublishSignal(market, analysis),
            "Publish on Movement to build your track record and earn tips from the community"
          ) : renderChainAction(
            CHAINS.APTOS,
            chains.aptos,
            rec === "PUBLISH",
            publishButtonText,
            () => {
              if (chains.aptos.connected) onPublishSignal(market, analysis);
            },
            "Create a permanent on-chain record of your analysis to build your track record and establish credibility"
          )
        )}

        {shouldTrade && (
          renderChainAction(
            CHAINS.EVM,
            chains.evm,
            rec === "TRADE",
            tradeButtonText,
            () => {
              if (chains.evm.connected) {
                setSelectedMarketForOrder(market);
                setShowOrderPanel(true);
              }
            },
            analysis.assessment?.odds_efficiency === "UNDERPRICED"
              ? "Market odds are underpriced. Place a position to capture value."
              : "Participate in the market based on your analysis and risk tolerance.",
            !chains.evm.isCorrectNetwork, // needsNetworkSwitch
            !chains.evm.isCorrectNetwork ? () => switchToEvmNetwork('polygon') : null // onSwitchNetwork
          )
        )}

        {rec === "BOTH" && (
          <div className={`mt-4 p-3 rounded-lg ${isNight ? "bg-green-500/10 border border-green-500/20" : "bg-green-400/10 border border-green-400/20"}`}>
            <p className={`text-xs ${textColor} leading-relaxed`}>
              <span className="font-medium">💡 Pro Tip:</span> {explanation.benefit}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Discovery Tab Component - Date-First Design
function DiscoveryTabContent({
  markets,
  isLoading,
  error,
  filters,
  setFilters,
  dateRange,
  setDateRange,
  onAnalyze,
  isNight,
  textColor,
  cardBgColor,
  expandedMarketId,
  setExpandedMarketId,
  analysis,
  isAnalyzing,
  selectedMarket,
  onPublishSignal,
  fetchMarkets,
  chains,
  setShowOrderPanel,
  setSelectedMarketForOrder,
  setSelectedKalshiMarket,
}) {
  const dateRangeLabels = {
    today: "Today",
    tomorrow: "Tomorrow",
    "this-week": "This Week",
    later: "Later",
  };

  return (
    <div className="space-y-6">
      {/* Compact Filter Bar */}
      <div
        className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-3 space-y-2`}
      >
        {/* Category */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="all">All Categories</option>
            <option value="Sports">⚽ Sports</option>
            <option value="Politics">🏛️ Politics</option>
            <option value="Economics">📊 Economics</option>
            <option value="Weather">🌤️ Weather</option>
            <option value="Entertainment">🎬 Entertainment</option>
            <option value="Crypto">₿ Crypto</option>
          </select>
        </div>

        {/* Platform */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Platform
          </label>
          <select
            value={filters.platform}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, platform: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="all">All Platforms</option>
            <option value="polymarket">Polymarket</option>
            <option value="kalshi">Kalshi</option>
          </select>
        </div>

        {/* Date Range Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            When
          </label>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(dateRangeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all font-light ${dateRange === key
                  ? isNight
                    ? "bg-blue-500/30 text-white border-blue-400/40"
                    : "bg-blue-400/30 text-black border-blue-500/40"
                  : isNight
                    ? "bg-white/10 hover:bg-white/20 text-white/70 border-white/20"
                    : "bg-black/10 hover:bg-black/20 text-black/70 border-black/20"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Min Volume */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Min Volume
          </label>
          <select
            value={filters.minVolume}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, minVolume: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="10000">$10k+</option>
            <option value="50000">$50k+</option>
            <option value="100000">$100k+</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Confidence
          </label>
          <select
            value={filters.confidence}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, confidence: e.target.value }))
            }
            className={`flex-1 px-3 py-2 text-sm rounded-lg border ${isNight
              ? "bg-white/10 border-white/20 text-white"
              : "bg-black/10 border-black/20 text-black"
              }`}
          >
            <option value="all">All</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>
            Include Futures
          </label>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                includeFutures: !prev.includeFutures,
              }))
            }
            className={`inline-flex items-center w-12 h-6 rounded-full border transition-all ${filters.includeFutures
              ? isNight
                ? "bg-green-500/40 border-green-400/40"
                : "bg-green-400/30 border-green-500/40"
              : isNight
                ? "bg-white/10 border-white/20"
                : "bg-black/10 border-black/20"
              }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white/80 transform transition-transform ${filters.includeFutures ? "translate-x-6" : "translate-x-1"
                }`}
            />
          </button>
        </div>
      </div>

      {/* Arbitrage Opportunities Banner */}
      {!isLoading &&
        markets &&
        markets.length > 0 &&
        (() => {
          const opportunities = arbitrageService.detectOpportunities(markets);

          if (opportunities.count > 0) {
            return (
              <div
                className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <h3 className={`text-sm font-medium ${textColor}`}>
                        {opportunities.count} Arbitrage Opportunit
                        {opportunities.count === 1 ? "y" : "ies"} Detected
                      </h3>
                      <p className={`text-xs ${textColor} opacity-60`}>
                        Price discrepancies between Polymarket and Kalshi
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowArbitrage(!showArbitrage)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${showArbitrage
                      ? isNight
                        ? "bg-blue-500/30 text-white border-blue-400/40"
                        : "bg-blue-400/30 text-black border-blue-500/40"
                      : isNight
                        ? "bg-white/10 hover:bg-white/20 text-white/70 border-white/20"
                        : "bg-black/10 hover:bg-black/20 text-black/70 border-black/20"
                      }`}
                  >
                    {showArbitrage ? "Hide" : "Show"} Details
                  </button>
                </div>

                {showArbitrage && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-white/10">
                    {opportunities.opportunities.slice(0, 5).map((opp, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${isNight
                          ? "bg-white/5 border-white/10"
                          : "bg-black/5 border-black/10"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p
                              className={`text-xs ${textColor} font-medium mb-1`}
                            >
                              {opp.polymarket.title.substring(0, 60)}...
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span
                                className={`px-2 py-0.5 rounded ${isNight
                                  ? "bg-blue-900/40 text-blue-300"
                                  : "bg-blue-100 text-blue-700"
                                  }`}
                              >
                                Polymarket: {opp.arbitrage.market1Odds}%
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded ${isNight
                                  ? "bg-emerald-900/40 text-emerald-300"
                                  : "bg-emerald-100 text-emerald-700"
                                  }`}
                              >
                                Kalshi: {opp.arbitrage.market2Odds}%
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-lg font-bold ${isNight ? "text-yellow-300" : "text-yellow-600"
                                }`}
                            >
                              {opp.arbitrage.priceDiff}%
                            </div>
                            <div className={`text-xs ${textColor} opacity-60`}>
                              spread
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return null;
        })()}

      {/* Markets List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div
            className={`w-6 h-6 border-2 ${isNight
              ? "border-white/30 border-t-white"
              : "border-black/30 border-t-black"
              } rounded-full animate-spin`}
          ></div>
          <span className={`ml-3 ${textColor} opacity-70`}>
            Loading markets...
          </span>
        </div>
      )}

      {error && (
        <div
          className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 text-center`}
        >
          <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setDateRange("this-week");
                setFilters((prev) => ({
                  ...prev,
                  minVolume: "10000",
                  category: "all",
                  confidence: "all",
                  includeFutures: true,
                }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-light ${isNight
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-black/20 hover:bg-black/30 text-black"
                }`}
            >
              Broaden Filters
            </button>
            <button
              onClick={fetchMarkets}
              className={`px-4 py-2 rounded-lg text-sm font-light ${isNight
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-black/20 hover:bg-black/30 text-black"
                }`}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {!isLoading &&
        !error &&
        markets &&
        markets.length > 0 &&
        (() => {
          // Apply client-side platform filter
          const filteredMarkets =
            filters.platform === "all"
              ? markets
              : markets.filter(
                (m) => (m.platform || "polymarket") === filters.platform
              );

          return filteredMarkets.length > 0 ? (
            <div className="space-y-4">
              {filteredMarkets.map((market, index) => (
                <MarketCard
                   key={market.marketID || market.id || index}
                   market={market}
                   onAnalyze={onAnalyze}
                   isNight={isNight}
                   textColor={textColor}
                   cardBgColor={cardBgColor}
                   isExpanded={
                     expandedMarketId ===
                     (market.marketID || market.id || market.tokenID)
                   }
                   expandedMarketId={expandedMarketId}
                   setExpandedMarketId={setExpandedMarketId}
                   analysis={analysis}
                   isAnalyzing={isAnalyzing}
                   selectedMarket={selectedMarket}
                   onPublishSignal={onPublishSignal}
                   chains={chains}
                   canPublish={canPublish}
                   setShowOrderPanel={setShowOrderPanel}
                   setSelectedMarketForOrder={setSelectedMarketForOrder}
                   setSelectedKalshiMarket={setSelectedKalshiMarket}
                 />
              ))}
            </div>
          ) : (
            <div
              className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 text-center`}
            >
              <p className={`${textColor} opacity-90`}>
                No {filters.platform === "kalshi" ? "Kalshi" : "Polymarket"}{" "}
                markets found. Try selecting "All Platforms" or adjusting other
                filters.
              </p>
            </div>
          );
        })()}
    </div>
  );
}

// Shared Market Card Component
function MarketCard({
  market,
  onAnalyze,
  isNight,
  textColor,
  cardBgColor,
  isExpanded,
  expandedMarketId,
  setExpandedMarketId,
  analysis,
  isAnalyzing,
  selectedMarket,
  onPublishSignal,
  chains,
  canPublish,
  setShowOrderPanel,
  setSelectedMarketForOrder,
  setSelectedKalshiMarket,
}) {
  const isHidden = expandedMarketId && !isExpanded;
  const isCurrentMarket =
    (selectedMarket?.marketID || selectedMarket?.id) ===
    (market.marketID || market.id);

  const platform = market.platform || "polymarket";
  const isKalshi = platform === "kalshi";

  return (
    <div
      className={`backdrop-blur-xl border rounded-3xl transition-all duration-500 ${isExpanded ? "fixed inset-4 p-8 z-40 overflow-y-auto" : "p-5 sm:p-6"
        } ${isHidden
          ? "opacity-0 pointer-events-none scale-95"
          : `opacity-100 hover:scale-[1.01] ${cardBgColor}`
        }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <h3
              className={`text-lg font-light ${textColor} leading-relaxed tracking-wide mr-4`}
            >
              {market.title || market.question}
            </h3>
            {/* Platform Badge */}
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border ${isKalshi
                ? isNight
                  ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/50"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200"
                : isNight
                  ? "bg-blue-900/40 text-blue-300 border-blue-700/50"
                  : "bg-blue-100 text-blue-700 border-blue-200"
                }`}
            >
              {isKalshi ? "Kalshi" : "Polymarket"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {market.volume24h !== undefined && (
              <span
                className={`px-3 py-1 rounded-full font-light border ${isNight
                  ? "bg-orange-500/10 text-orange-200 border-orange-500/20"
                  : "bg-orange-400/10 text-orange-800 border-orange-400/20"
                  }`}
              >
                ⚡{" "}
                {isKalshi
                  ? `${market.volume24h} Vol`
                  : `$${(market.volume24h / 1000).toFixed(0)}K`}
              </span>
            )}
            {market.confidence && (
              <span
                className={`px-3 py-1 rounded-full font-light border ${market.confidence === "HIGH"
                  ? isNight
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : "bg-green-400/20 text-green-800 border-green-400/30"
                  : market.confidence === "MEDIUM"
                    ? isNight
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      : "bg-yellow-400/20 text-yellow-800 border-yellow-400/30"
                    : isNight
                      ? "bg-red-500/20 text-red-300 border-red-500/30"
                      : "bg-red-400/20 text-red-800 border-red-400/30"
                  }`}
              >
                {market.confidence}
              </span>
            )}
            {/* Chain Recommendation Badge - Early visibility */}
            {isCurrentMarket && analysis?.chain_recommendation && (
              <ChainRecommendationBadge 
                recommendation={analysis.chain_recommendation}
                isNight={isNight}
              />
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {isExpanded ? (
            <button
              onClick={() => setExpandedMarketId(null)}
              className={`px-6 py-3 rounded-2xl font-light text-sm transition-all border ${isNight
                ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                : "bg-black/10 hover:bg-black/20 text-black border-black/20"
                }`}
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => onAnalyze(market, "basic")}
              disabled={isAnalyzing}
              className={`px-6 py-3 rounded-2xl font-light text-sm transition-all disabled:opacity-40 hover:scale-105 border ${isNight
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 text-blue-200 border-blue-400/30"
                : "bg-gradient-to-r from-blue-400/20 to-purple-400/20 hover:from-blue-400/30 hover:to-purple-400/30 text-blue-800 border-blue-500/30"
                }`}
            >
              {isAnalyzing && isCurrentMarket ? "Analyzing..." : "Analyze"}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Loading State in Expanded View */}
      {isExpanded && isAnalyzing && (
        <LoadingAnalysisState isNight={isNight} textColor={textColor} />
      )}

      {/* Expanded Analysis View */}
      {isExpanded && analysis && (
        <div className="mt-8 pt-8 border-t border-white/10">
          <h2 className={`text-2xl font-light ${textColor} mb-6`}>Analysis</h2>

          <div className="space-y-4">
            {/* Market Context & Odds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-4`}
              >
                <h4
                  className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
                >
                  Market Odds
                </h4>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className={`text-sm ${textColor} opacity-60`}>
                      YES
                    </span>
                    <span
                      className={`text-xl font-medium ${isNight ? "text-green-400" : "text-green-600"
                        }`}
                    >
                      {market.ask ? `${(market.ask * 100).toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className={`text-sm ${textColor} opacity-60`}>
                      NO
                    </span>
                    <span
                      className={`text-xl font-medium ${isNight ? "text-red-400" : "text-red-600"
                        }`}
                    >
                      {market.bid ? `${(market.bid * 100).toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-4`}
              >
                <h4
                  className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
                >
                  Weather @ {analysis.weather_conditions?.location || "Venue"}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">🌡️</span>
                    <span className={textColor}>
                      {analysis.weather_conditions?.temperature || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">☁️</span>
                    <span className={textColor}>
                      {analysis.weather_conditions?.condition || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">💨</span>
                    <span className={textColor}>
                      {analysis.weather_conditions?.wind || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="opacity-60">💧</span>
                    <span className={textColor}>
                      {analysis.weather_conditions?.precipitation || "0%"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chain Action Widget - Elevated for prominence */}
            <ChainActionWidget
              analysis={analysis}
              market={market}
              isNight={isNight}
              textColor={textColor}
              cardBgColor={cardBgColor}
              onPublishSignal={onPublishSignal}
              chains={chains}
              setShowOrderPanel={setShowOrderPanel}
              setSelectedMarketForOrder={setSelectedMarketForOrder}
            />

            {/* Analysis Text */}
            <div
              className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-5`}
            >
              <h4
                className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
              >
                AI Reasoning
              </h4>
              <p
                className={`text-base ${textColor} opacity-90 leading-relaxed font-light`}
              >
                {analysis.reasoning ||
                  analysis.analysis ||
                  "No analysis available"}
              </p>
            </div>

            {/* Recommendation */}
            {analysis.recommended_action && (
              <div
                className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-5`}
              >
                <h4
                  className={`text-xs font-light ${textColor} opacity-70 mb-2 uppercase tracking-wider`}
                >
                  Recommendation
                </h4>
                <p className={`text-base font-medium ${textColor}`}>
                  {analysis.recommended_action}
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <div
              className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-4 ${isNight ? "border-white/10" : "border-black/10"
                }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-1 h-1 rounded-full ${isNight ? "bg-white/40" : "bg-black/40"
                    }`}
                ></div>
                <div>
                  <p
                    className={`text-xs ${textColor} opacity-60 font-light leading-relaxed`}
                  >
                    <span className="opacity-80">
                      Informational purposes only.
                    </span>{" "}
                    This analysis is not financial advice. Weather-based
                    predictions are probabilistic and should be combined with
                    your own research. Trade responsibly.
                  </p>
                </div>
              </div>
            </div>

            {/* What are Signals? */}
            <div
              className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-5`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📡</span>
                <h4 className={`text-sm font-medium ${textColor}`}>
                  What are Signals?
                </h4>
              </div>
              <p
                className={`text-sm ${textColor} opacity-80 font-light leading-relaxed mb-3`}
              >
                Signals are on-chain records of your predictions. When you
                publish a signal, you're creating a permanent, timestamped
                record of your analysis on the blockchain.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-start gap-2">
                  <span className={`text-xs ${textColor} opacity-60`}>✓</span>
                  <p className={`text-xs ${textColor} opacity-70 font-light`}>
                    <strong className="font-medium">
                      Build your track record
                    </strong>{" "}
                    - Prove your prediction accuracy over time
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`text-xs ${textColor} opacity-60`}>✓</span>
                  <p className={`text-xs ${textColor} opacity-70 font-light`}>
                    <strong className="font-medium">
                      Transparent & verifiable
                    </strong>{" "}
                    - Anyone can verify your predictions on-chain
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className={`text-xs ${textColor} opacity-60`}>✓</span>
                  <p className={`text-xs ${textColor} opacity-70 font-light`}>
                    <strong className="font-medium">Own your insights</strong> -
                    Your signals are stored on Aptos blockchain
                  </p>
                </div>
              </div>
            </div>

            {/* Wallet Connection Prompt (if not connected) */}
            {!canPublish && (
              <div
                className={`${cardBgColor} backdrop-blur-sm border rounded-xl p-4 flex items-center gap-3 ${isNight ? "border-orange-400/30" : "border-orange-600/30"
                  }`}
              >
                <span className="text-2xl">👆</span>
                <div className="flex-1">
                  <p className={`text-sm ${textColor} font-medium mb-1`}>
                    Connect your Aptos or Movement wallet to publish
                  </p>
                  <p className={`text-xs ${textColor} opacity-70 font-light`}>
                    Click "Connect Aptos Wallet" in the header above to publish
                    your signal on-chain
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons: Trade + Publish */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  if (isKalshi) {
                    setSelectedKalshiMarket(market);
                  } else {
                    setSelectedMarketForOrder(market);
                    setShowOrderPanel(true);
                  }
                }}
                className={`flex-1 px-6 py-3 rounded-2xl font-light text-sm transition-all border text-center ${isKalshi
                  ? isNight
                    ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/30"
                    : "bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-800 border-emerald-500/30"
                  : isNight
                    ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30"
                    : "bg-blue-400/20 hover:bg-blue-400/30 text-blue-800 border-blue-500/30"
                  }`}
              >
                {isKalshi ? "Trade on Kalshi ↗" : "📈 Trade Here"}
              </button>

              <button
                onClick={onPublishSignal}
                className={`flex-1 px-6 py-3 rounded-2xl font-light text-sm transition-all border relative ${canPublish
                  ? isNight
                    ? "bg-green-500/20 hover:bg-green-500/30 text-green-200 border-green-400/30"
                    : "bg-green-400/20 hover:bg-green-400/30 text-green-800 border-green-500/30"
                  : isNight
                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-orange-400/30"
                    : "bg-orange-400/20 hover:bg-orange-400/30 text-orange-800 border-orange-500/30"
                  }`}
              >
                {canPublish
                  ? "📡 Publish Signal"
                  : "🔗 Connect & Publish Signal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Signing Panel - Overlay */}

    </div>
  );
}

// Dynamic Loading State Component
function LoadingAnalysisState({ isNight, textColor }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    {
      icon: "🔍",
      text: "Verifying event location",
      sub: "Cross-referencing official schedules via web search",
    },
    {
      icon: "🌤️",
      text: "Fetching live weather data",
      sub: "Retrieving real-time conditions and forecasts",
    },
    {
      icon: "📊",
      text: "Analyzing market efficiency",
      sub: "Comparing weather impact vs current odds",
    },
    {
      icon: "🤖",
      text: "Generating AI insights",
      sub: "Synthesizing comprehensive recommendation",
    },
  ];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 100);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="mt-8 pt-8 border-t border-white/10 flex flex-col items-center justify-center py-12">
      {/* Animated Icon */}
      <div className="relative mb-6">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-all duration-500 ${isNight
            ? "bg-white/10 backdrop-blur-sm"
            : "bg-black/5 backdrop-blur-sm"
            }`}
        >
          <span className="animate-bounce">{steps[step].icon}</span>
        </div>
        <div
          className={`absolute inset-0 rounded-full border-2 ${isNight ? "border-white/20" : "border-black/20"
            }`}
          style={{
            clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)`,
            borderColor: isNight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
          }}
        ></div>
      </div>

      {/* Step Text */}
      <p
        className={`${textColor} text-lg font-medium mb-2 transition-all duration-500`}
      >
        {steps[step].text}
      </p>
      <p
        className={`text-sm ${textColor} opacity-60 font-light transition-all duration-500 text-center max-w-xs`}
      >
        {steps[step].sub}
      </p>

      {/* Progress Bar */}
      <div
        className={`w-64 h-1 rounded-full mt-6 ${isNight ? "bg-white/10" : "bg-black/10"
          }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-100 ${isNight ? "bg-white/60" : "bg-black/60"
            }`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-2 mt-6">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${i === step ? "scale-110" : "scale-100 opacity-40"
              }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${i <= step
                ? isNight
                  ? "bg-white/20 text-white"
                  : "bg-black/20 text-black"
                : isNight
                  ? "bg-white/5 text-white/40"
                  : "bg-black/5 text-black/40"
                }`}
            >
              {s.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
