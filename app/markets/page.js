"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMarketsData } from "./useMarketsData";
import { useSignalPublisher } from "@/hooks/useSignalPublisher";
import { useChainConnections } from "@/hooks/useChainConnections";
import useFilterStore from "@/hooks/useFilterStore";
import { useWeather } from "@/hooks/useWeather";
import { useStaggeredAnimation } from "@/app/hooks/useStaggeredAnimation";
import { useGlobalToast } from "@/components/ToastProvider";
import { BRAND } from "@/constants/brand";
import { ARC_EXPLORER_TX } from "@/constants/appConstants";
import AnalysisOptions, { useAnalysisOptions } from "@/components/AnalysisOptions";
import FirstRunBanner from "@/components/FirstRunBanner";
import { AppShell, SecondaryNav } from "@/app/components/PageNav";
import Link from "next/link";
import { useCountUp } from "@/hooks/useCountUp";

// Streaming analysis transport + markets/analysis data pipeline live in
// sibling modules so this page shell stays focused on orchestration.
//   app/markets/useAnalysisStream.js → STAGE_INDEX, requestStreamingAnalysis
//   app/markets/useMarketsData.js    → fetchMarkets, analyzeMarket,
//                                       openAnalyzeConfig,
//                                       analyzeMarketWithConfig

function PanelSkeleton({ className = "h-28" }) {
 return (
 <div
 className={`animate-pulse border border-[var(--color-rule)] bg-white/[0.04] ${className}`}
 aria-hidden
 />
 );
}

const MarketEdgeScanner = dynamic(
 () =>
 import("@/components/MarketEdgeScanner").then((m) => ({
 default: m.MarketEdgeScanner,
 })),
 { loading: () => <PanelSkeleton className="h-36" />, ssr: false }
);

const SportsTabContent = dynamic(
 () =>
 import("./SportsTab").then((m) => ({ default: m.SportsTabContent })),
 { loading: () => <PanelSkeleton className="h-64" /> }
);

const DiscoveryTabContent = dynamic(
 () =>
 import("./DiscoveryTab").then((m) => ({ default: m.DiscoveryTabContent })),
 { loading: () => <PanelSkeleton className="h-64" /> }
);

const AnalysisConfigModal = dynamic(
 () => import("@/components/AnalysisConfigModal"),
 { ssr: false }
);

const PricingOverlay = dynamic(
 () => import("@/components/PricingOverlay"),
 { ssr: false }
);

const PublishConfirmModal = dynamic(
 () => import("@/components/PublishConfirmModal"),
 { ssr: false }
);

const OrderSigningPanel = dynamic(
 () =>
 import("@/components/OrderSigningPanel").then((m) => ({
 default: m.OrderSigningPanel,
 })),
 { ssr: false }
);

const KalshiOrderPanel = dynamic(
 () => import("@/components/KalshiOrderPanel"),
 { ssr: false }
);

const ArbitrageExecutionPanel = dynamic(
 () =>
 import("@/components/ArbitrageExecutionPanel").then((m) => ({
 default: m.ArbitrageExecutionPanel,
 })),
 { ssr: false }
);

export default function MarketsPage() {
 // Unified chain connection state - single source of truth
 const chainConnections = useChainConnections();
 // console.log('[Markets Page] chainConnections:', chainConnections);

 // Provide default values to prevent undefined errors during initial render
 const { chains, canPerform, canPublish = false } = chainConnections || {};
 // console.log('[Markets Page] chains:', chains, 'canPerform:', canPerform, 'canPublish:', canPublish);

 // Read URL search params for pre-filtering from carousel landing
 const [urlParamsRead, setUrlParamsRead] = useState(false);
 const [landingQuery, setLandingQuery] = useState('');

 useEffect(() => {
 if (typeof window === 'undefined' || urlParamsRead) return;

 const params = new URLSearchParams(window.location.search);
 const category = params.get('category');
 const shareId = params.get('share_id');
 const searchQuery = params.get('q');

 if (searchQuery) {
 setLandingQuery(searchQuery);
 setDiscoveryFilters(prev => ({ ...prev, category: 'all', searchText: searchQuery, minVolume: '0' }));
 setDiscoveryDateRange('later');
 setActiveTab('discovery');
 } else if (category) {
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

 // NOTE: The chains-loading guard was previously an early return placed here,
 // BETWEEN hook calls. That violated React's Rules of Hooks (hook count changed
 // between renders when `chains` became available, crashing the page). The guard
 // has been moved to AFTER all hooks — see below, just before the main return.
 // console.log('[Markets Page] ChainConnections initialized successfully');

 const {
 publishSignal,
 publishChain,
 isPublishing,
 publishError,
 connected: publisherConnected,
 walletAddress,
 } = useSignalPublisher();
 const { addToast, removeToast } = useGlobalToast();

 // Tab state: 'sports' or 'discovery' (persisted). The chain-named 'canton'
 // tab was removed — private markets are a property, not a category. A
 // persisted 'canton' value falls back to 'discovery' so old sessions render.
 const filterStore = useFilterStore();
 const persistedTab = filterStore.marketsActiveTab;
 const activeTab = persistedTab === "sports" ? "sports" : "discovery";
 const setActiveTab = (tab) => filterStore.setMarketsActiveTab(tab);

 // Weather state (for UI theming and discovery mode)
 const { weatherData, isNight } = useWeather();

 // Market state (shared across tabs)
 const [markets, setMarkets] = useState(null);
 const [selectedMarket, setSelectedMarket] = useState(null);
 const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);

 // Staggered list reveal count (rendered item count across tabs)
 const [visibleMarketCount, setVisibleMarketCount] = useState(0);
 const { visibleCount: staggeredCount } = useStaggeredAnimation(
 Array.isArray(markets) ? markets.length : 0,
 45,
 setVisibleMarketCount
 );

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
 const [analysisStage, setAnalysisStage] = useState(0);
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

 // Progressive disclosure: show first 10 markets, then "Load more" batches of 10
 const [displayLimit, setDisplayLimit] = useState(10);
 // Count-up for "My signals" badge
 const [mySignalsRef, mySignalsDisplay] = useCountUp(mySignalCount ?? 0, { duration: 700 });
 // Reset display limit when markets change (tab switch, filter change)
 useEffect(() => { setDisplayLimit(10); }, [markets]);

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
 if (canPublish && walletAddress) {
 fetch(`/api/signals?author=${encodeURIComponent(walletAddress)}&countOnly=1`)
 .then((r) => r.json())
 .then((d) => setMySignalCount(d.count ?? null))
 .catch(() => { });
 } else {
 setMySignalCount(null);
 }
 }, [canPublish, walletAddress]);

 // Markets + analysis data pipeline (see ./useMarketsData.js for the three
 // callbacks + their state-read/write contract).
 const {
 fetchMarkets,
 analyzeMarket,
 analyzeMarketWithConfig,
 openAnalyzeConfig,
 } = useMarketsData({
 activeTab,
 sportsFilters,
 selectedDateRange,
 sportsMinVolume,
 discoveryFilters,
 discoveryDateRange,
 analysisOptions,
 analysisMode,
 pendingMarket,
 setMarkets,
 setSelectedMarket,
 setError,
 setIsLoadingMarkets,
 setIsLoadingAnalysis,
 setAnalysis,
 setAnalysisStage,
 setExpandedMarketId,
 setShowPricing,
 setShowConfigModal,
 setPendingMarket,
 setFreeAnalysesUsed,
 addToast,
 });

 const handlePublishSignal = useCallback(async (settlementLayer = 'arc') => {
 if (!selectedMarket || !analysis) return;

 // Canton path: private settlement via Console Wallet
 if (settlementLayer === 'canton') {
 try {
 // Save signal to DB with Canton origin
 const response = await fetch("/api/signals", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 market: selectedMarket,
 analysis,
 weather: weatherData,
 authorAddress: null, // Canton uses partyId, not EVM address
 publishChain: 'canton',
 chainOrigin: 'CANTON',
 }),
 });
 const result = await response.json();
 if (!result.success) {
 addToast(`Failed to save signal: ${result.error}`, "error", 5000);
 return;
 }

 // Submit Daml command via Console Wallet (client-side)
 const { publishPositionOnCanton } = await import('@/services/cantonPublisher');
 const operatorPartyId = process.env.NEXT_PUBLIC_CANTON_OPERATOR_PARTY_ID || '';
 if (!operatorPartyId) {
 addToast('Canton operator not configured. Set NEXT_PUBLIC_CANTON_OPERATOR_PARTY_ID.', 'error', 5000);
 return;
 }

 // Get Canton wallet from context — use the hook imported at top
 // The canton wallet context is accessed via the CantonWalletLayer provider
 // We need to use the window.__cantonWallet or a ref passed down.
 // For now, we dispatch a custom event that the CantonWalletLayer handles.
 const cantonEvent = new CustomEvent('canton:publishPosition', {
 detail: {
 signalData: {
 event_id: selectedMarket.marketID || selectedMarket.id,
 market_title: selectedMarket.title || selectedMarket.question,
 recommended_action: analysis.recommended_action || analysis.assessment?.direction,
 confidence: analysis.assessment?.confidence,
 stake: analysis.stake || analysis.position_size || '0',
 settlement_asset: 'CBTC',
 },
 signalId: result.id,
 operatorPartyId,
 },
 });
 window.dispatchEvent(cantonEvent);

 addToast(
 'Canton position submitted — check Console Wallet to approve',
 'success',
 5000,
 '/signals',
 'View Track Record'
 );
 } catch (err) {
 console.error('Canton publish failed:', err);
 addToast(`Canton publish failed: ${err.message}`, 'error', 5000);
 }
 return;
 }

 // Arc path (default): public reputation receipt via EVM wallet
 // Check if can publish
 if (!canPublish) {
 window.scrollTo({ top: 0, behavior: "smooth" });
 addToast(
 "Connect a wallet — Arc testnet for USDC settlement",
 "warning",
 5000
 );
 return;
 }

 try {
 // 1. Save to SQLite first (fast feedback). Arc is the only publish chain.
 const targetChain = publishChain || 'arc';
 const rawAddress = chains.arc?.address || chains.evm?.address;
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
 const explorer =
 settledChain === 'arc'
 ? ARC_EXPLORER_TX(txHash)
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
 }, [selectedMarket, analysis, canPublish, chains, weatherData, addToast, publishSignal, publishChain, publishError]);

 const textColor = "text-[var(--color-ink)]";
 const cardBgColor = "bg-[var(--color-paper-raised)] border-[var(--color-rule)]";

 // Safety check: render a loading state if chain connections aren't ready yet.
 // This guard is intentionally placed AFTER all hooks (the last hook is the
 // useCallback above) so that the hook call order/count stays consistent across
 // every render, complying with React's Rules of Hooks.
 if (!chains) {
 console.error('[Markets Page] ChainConnections initialization failed:', {
 chains: !!chains,
 canPerform: !!canPerform,
 canPublish: typeof canPublish,
 chainConnections
 });
 return (
 <AppShell title="Markets" subtitle="Connecting wallet providers…">
 <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading wallet connections">
 {[0, 1, 2].map((i) => (
 <div key={i} className="h-16 animate-pulse border border-[var(--color-rule)] bg-[var(--color-paper-soft)]" />
 ))}
 <p className="text-xs text-[var(--color-ink-faint)]">Loading wallet connections…</p>
 </div>
 </AppShell>
 );
 }

 return (
 <AppShell
 title="Markets"
 subtitle={BRAND.pages.markets}
 actions={
 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
 <div className="flex items-center gap-2">
 <label className="text-xs text-[var(--color-ink-muted)] hidden sm:inline">Mode</label>
 <select
 value={analysisMode}
 onChange={(e) => setAnalysisMode(e.target.value)}
 className="border border-[var(--color-rule)] bg-[var(--color-paper-soft)] px-2 py-1.5 text-xs text-[var(--color-ink)]"
 aria-label="Analysis mode"
 >
 <option value="basic">Basic (Free)</option>
 <option value="deep">Deep (Research)</option>
 </select>
 </div>
 <div className="hidden items-center lg:flex">
 <AnalysisOptions
 marketType={selectedMarket?.eventType || activeTab === 'sports' ? 'sports' : 'crypto'}
 compact={true}
 />
 </div>
 {canPublish && (
 <span ref={mySignalsRef} className="border border-[var(--color-rule)] bg-[var(--color-paper-soft)] px-2 py-1 text-[10px] text-[var(--color-ink)] tabular-nums">
 My signals: {mySignalCount != null ? Math.round(mySignalsDisplay) : "—"}
 </span>
 )}
 </div>
 }
 subheader={
 <SecondaryNav
 items={[
 { id: "sports", label: "Sports", icon: "◆" },
 { id: "discovery", label: "Crypto & more", icon: "▲" },
 ]}
 activeItem={activeTab}
 onChange={setActiveTab}
 />
 }
 >
 {/* Analysis Config Modal */}
 <AnalysisConfigModal
 isOpen={showConfigModal}
 onClose={() => setShowConfigModal(false)}
 onConfirm={analyzeMarketWithConfig}
 market={pendingMarket}
 isLoading={isLoadingAnalysis}
 defaultOptions={analysisOptions}
 />

 <div>
 {landingQuery ? <FirstRunBanner searchQuery={landingQuery} /> : null}

 <div className="platform-open-section mb-6">
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
 analysisStage={analysisStage}
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
 visibleMarketCount={visibleMarketCount}
 displayLimit={displayLimit}
 onLoadMore={() => setDisplayLimit(prev => prev + 10)}
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
 analysisStage={analysisStage}
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
 visibleMarketCount={visibleMarketCount}
 displayLimit={displayLimit}
 onLoadMore={() => setDisplayLimit(prev => prev + 10)}
 />
 )}

 {/* Canton tab removed — private markets are a property, not a category. */}
 </div>

 {/* Modal Layers */}
 {
 showOrderPanel && selectedMarketForOrder && (
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
 onConfirm={(settlementLayer) => {
 setShowPublishConfirm(false);
 handlePublishSignal(settlementLayer);
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
 </AppShell>
 );
}
