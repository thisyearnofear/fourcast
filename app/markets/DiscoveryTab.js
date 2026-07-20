'use client';

import React, { useState } from "react";
import { Zap } from "lucide-react";
import { arbitrageService } from "@/services/arbitrageService";
import EmptyMarketState from "@/components/EmptyMarketState";
import { StaggeredMarketCard } from "./MarketCardShared";

export function DiscoveryTabContent({
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
 analysisStage,
 selectedMarket,
 onPublishSignal,
 fetchMarkets,
 chains,
 canPublish,
 setShowOrderPanel,
 setSelectedMarketForOrder,
 setSelectedKalshiMarket,
 setOrderSide,
 setSelectedArbitrage,
 agentBrierScore,
 calibrationScore,
 visibleMarketCount,
}) {
 const [showArbitrage, setShowArbitrage] = useState(false);

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
 className={`${cardBgColor} border p-3 space-y-2`}
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
 className={`flex-1 px-3 py-2 text-sm border bg-white/10 border-white/20 text-white`}
 >
 <option value="all">All Categories</option>
 <option value="Sports">Sports</option>
 <option value="Politics">Politics</option>
 <option value="Economics">Economics</option>
 <option value="Weather">Weather</option>
 <option value="Entertainment">Entertainment</option>
 <option value="Crypto">Crypto</option>
 <option value="Path">Path Analysis</option>
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
 className={`flex-1 px-3 py-2 text-sm border bg-white/10 border-white/20 text-white`}
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
 className={`px-3 py-1.5 text-xs border transition-all font-light ${dateRange === key
 ? "bg-emerald-500/30 text-white border-emerald-400/40"
 : "bg-white/10 hover:bg-white/20 text-white/70 border-white/20"
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
 className={`flex-1 px-3 py-2 text-sm border bg-white/10 border-white/20 text-white`}
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
 className={`flex-1 px-3 py-2 text-sm border bg-white/10 border-white/20 text-white`}
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
 className={`inline-flex items-center w-12 h-6 border transition-all ${filters.includeFutures
 ? "bg-green-500/40 border-green-400/40"
 : "bg-white/10 border-white/20"
 }`}
 >
 <span
 className={`inline-block w-5 h-5 bg-white/80 transform transition-transform ${filters.includeFutures ? "translate-x-6" : "translate-x-1"
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
 className={`${cardBgColor} border p-4`}
 >
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Zap className="h-5 w-5 text-amber-300" />
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
 className={`px-3 py-1.5 text-xs border transition-all ${showArbitrage
 ? "bg-emerald-500/30 text-white border-emerald-400/40"
 : "bg-white/10 hover:bg-white/20 text-white/70 border-white/20"
 }`}
 >
 {showArbitrage ? "Hide" : "Show"} Details
 </button>
 </div>
 {showArbitrage && (
 <div className="space-y-2 mt-3 pt-3 border-t border-white/10">
 {(opportunities?.opportunities || []).slice(0, 5).map((opp, idx) => (
 <div
 key={idx}
 className={`p-3 border bg-white/5 border-white/10`}
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
 className={`px-2 py-0.5 bg-blue-900/40 text-blue-300`}
 >
 Polymarket: {opp.arbitrage.market1Odds}%
 </span>
 <span
 className={`px-2 py-0.5 bg-emerald-900/40 text-emerald-300`}
 >
 Kalshi: {opp.arbitrage.market2Odds}%
 </span>
 </div>
 </div>
 <div className="text-right">
 <div
 className={`text-lg font-bold text-yellow-300`}
 >
 {opp.arbitrage.priceDiff}%
 </div>
 <div className={`text-xs ${textColor} opacity-60`}>
 spread
 </div>
 <button
 onClick={() => setSelectedArbitrage(opp)}
 className={`mt-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30`}
 >
 Capture Spread
 </button>
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
 {isLoading || !markets ? (
 <div className="space-y-3">
 {[1, 2, 3].map((i) => (
 <div key={i} className={`mc-panel p-5 border-white/10`}>
 <div className="space-y-3">
 <div className='skeleton' style={{ height: '1.25rem', width: '60%', borderRadius: '0.5rem' }} />
 <div className='skeleton' style={{ height: '1rem', width: '40%', borderRadius: '0.5rem' }} />
 <div className="flex gap-2">
 <div className='skeleton' style={{ height: '1.5rem', width: '4rem', borderRadius: '999px' }} />
 <div className='skeleton' style={{ height: '1.5rem', width: '5rem', borderRadius: '999px' }} />
 </div>
 </div>
 </div>
 ))}
 </div>
 ) : error ? (
 <EmptyMarketState
 category={filters.category}
 message={error}
 onSwitchCategory={(cat) => {
 setFilters(prev => ({ ...prev, category: cat }));
 }}
 />
 ) : markets.length === 0 ? (
 <div className={`${cardBgColor} border p-6 text-center`}>
 <p className={`${textColor} opacity-90`}>
 No markets match your filters. Try broadening your options.
 </p>
 </div>
 ) : (
 (() => {
 let filteredMarkets = markets;
 if (filters.platform !== 'all') {
 filteredMarkets = markets.filter((m) => (m.platform || 'polymarket') === filters.platform);
 }
 if (filters.category === 'Path') {
 filteredMarkets = filteredMarkets.filter((m) => m.isPathDependent);
 }

 if (filteredMarkets.length === 0) {
 return (
 <div className={`${cardBgColor} border p-6 text-center`}>
 <p className={`${textColor} opacity-90`}>
 No {filters.platform === 'kalshi' ? 'Kalshi' : 'Polymarket'} markets found. Try selecting "All Platforms" or adjusting other filters.
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {filteredMarkets.map((market, index) => (
 <StaggeredMarketCard
 key={market.marketID || market.id || index}
 market={market}
 index={index}
 onAnalyze={onAnalyze}
 isNight={isNight}
 textColor={textColor}
 cardBgColor={cardBgColor}
 isExpanded={expandedMarketId === (market.marketID || market.id || market.tokenID)}
 expandedMarketId={expandedMarketId}
 setExpandedMarketId={setExpandedMarketId}
 analysis={analysis}
 isAnalyzing={isAnalyzing}
 analysisStage={analysisStage}
 selectedMarket={selectedMarket}
 onPublishSignal={onPublishSignal}
 chains={chains}
 canPublish={canPublish}
 setShowOrderPanel={setShowOrderPanel}
 setSelectedMarketForOrder={setSelectedMarketForOrder}
 setSelectedKalshiMarket={setSelectedKalshiMarket}
 setOrderSide={setOrderSide}
 setSelectedArbitrage={setSelectedArbitrage}
 agentBrierScore={agentBrierScore}
 calibrationScore={calibrationScore}
 visibleCount={visibleMarketCount}
 />
 ))}
 </div>
 );
 })()
 )}
 </div>
 );
}
