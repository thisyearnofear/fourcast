'use client';

import React, { useState } from "react";
import { Zap } from "lucide-react";
import { arbitrageService } from "@/services/arbitrageService";
import EmptyMarketState from "@/components/EmptyMarketState";
import { StaggeredMarketCard } from "./MarketCardShared";
import { Skeleton } from "@/components/Skeleton";
import Reveal from "@/components/motion/Reveal";
import GlassPanel from "@/components/ui/GlassPanel";
import ExpandPanel from "@/components/ui/ExpandPanel";
import GlowList from "./GlowList";

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
 displayLimit = Infinity,
 onLoadMore,
}) {
 const [showArbitrage, setShowArbitrage] = useState(false);

 const dateRangeLabels = {
 today: "Today",
 tomorrow: "Tomorrow",
 "this-week": "This Week",
 later: "Later",
 };

 // Compute filtered markets for count display
 const filteredMarkets = React.useMemo(() => {
  if (!markets || markets.length === 0) return [];
  let filtered = markets;
  if (filters.platform !== 'all') {
    filtered = markets.filter((m) => (m.platform || 'polymarket') === filters.platform);
  }
  if (filters.category === 'Path') {
    filtered = filtered.filter((m) => m.isPathDependent);
  }
  return filtered;
 }, [markets, filters.platform, filters.category]);

 // Arbitrage check — only when data is loaded
 let arbitrageBanner = null;
 if (!isLoading && markets && markets.length > 0) {
  const opportunities = arbitrageService.detectOpportunities(markets);
  if (opportunities.count > 0) {
    arbitrageBanner = (
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[var(--color-sealed)]" />
            <div>
              <h3 className={`text-sm font-medium ${textColor}`}>
                {opportunities.count} Arbitrage Opportunit{opportunities.count === 1 ? "y" : "ies"} Detected
              </h3>
              <p className={`text-xs ${textColor} opacity-60`}>
                Price discrepancies between Polymarket and Kalshi
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowArbitrage(!showArbitrage)}
            className={`px-3 py-1.5 text-xs border transition-all ${showArbitrage
              ? "bg-[var(--color-accent)]/30 text-[var(--color-ink)] border-[var(--color-accent)]/40"
              : "bg-[var(--color-paper-soft)] hover:bg-white/20 text-[var(--color-ink-muted)] border-[var(--color-rule-strong)]"
              }`}
          >
            {showArbitrage ? "Hide" : "Show"} Details
          </button>
        </div>
        {showArbitrage && (
          <div className="space-y-2 mt-3 pt-3 border-t border-[var(--color-rule)]">
            {(opportunities?.opportunities || []).slice(0, 5).map((opp, idx) => (
              <div key={idx} className={`p-3 border bg-[var(--color-paper-raised)] border-[var(--color-rule)]`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`text-xs ${textColor} font-medium mb-1`}>
                      {opp.polymarket.title.substring(0, 60)}...
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className={`px-2 py-0.5 bg-[var(--color-evidence)]/20 text-[var(--color-evidence)]`}>
                        Polymarket: {opp.arbitrage.market1Odds}%
                      </span>
                      <span className={`px-2 py-0.5 bg-[var(--color-accent)]/20 text-[var(--color-accent)]`}>
                        Kalshi: {opp.arbitrage.market2Odds}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold text-[var(--color-sealed)]`}>
                      {opp.arbitrage.priceDiff}%
                    </div>
                    <div className={`text-xs ${textColor} opacity-60`}>spread</div>
                    <button
                      onClick={() => setSelectedArbitrage(opp)}
                      className={`mt-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30 text-[var(--color-accent)] border border-[var(--color-accent)]/30`}
                    >
                      Capture Spread
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    );
  }
 }

 return (
  <div className="space-y-8">
    {/* Compact Filter Bar — open section */}
    <GlassPanel>
      <ExpandPanel title="Filters" subtitle="category · platform · date" defaultOpen>
        {/* Category */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            className={"mc-input flex-1 px-3 py-2 text-sm"}
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
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Platform</label>
          <select
            value={filters.platform}
            onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}
            className={"mc-input flex-1 px-3 py-2 text-sm"}
          >
            <option value="all">All Platforms</option>
            <option value="polymarket">Polymarket</option>
            <option value="kalshi">Kalshi</option>
          </select>
        </div>

        {/* Date Range Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>When</label>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(dateRangeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                className={`px-3 py-1.5 text-xs border transition-all font-light ${dateRange === key
                  ? "bg-[var(--color-accent)]/30 text-[var(--color-ink)] border-[var(--color-accent)]/40"
                  : "bg-[var(--color-paper-soft)] hover:bg-white/20 text-[var(--color-ink-muted)] border-[var(--color-rule-strong)]"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Min Volume */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Min Volume</label>
          <select
            value={filters.minVolume}
            onChange={(e) => setFilters((prev) => ({ ...prev, minVolume: e.target.value }))}
            className={"mc-input flex-1 px-3 py-2 text-sm"}
          >
            <option value="10000">$10k+</option>
            <option value="50000">$50k+</option>
            <option value="100000">$100k+</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Confidence</label>
          <select
            value={filters.confidence}
            onChange={(e) => setFilters((prev) => ({ ...prev, confidence: e.target.value }))}
            className={"mc-input flex-1 px-3 py-2 text-sm"}
          >
            <option value="all">All</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Include Futures</label>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, includeFutures: !prev.includeFutures }))}
            className={`inline-flex items-center w-12 h-6 border transition-all ${filters.includeFutures
              ? "bg-[var(--color-accent)]/40 border-[var(--color-accent)]/40"
              : "bg-[var(--color-paper-soft)] border-[var(--color-rule-strong)]"
              }`}
          >
            <span
              className={`inline-block w-5 h-5 bg-[var(--color-paper-raised)]0 transform transition-transform ${filters.includeFutures ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
      </ExpandPanel>
    </GlassPanel>

    {/* Arbitrage Banner (always visible above list) */}
    {arbitrageBanner}

    {/* Markets List */}
    {isLoading || !markets ? (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 border border-[var(--color-rule)] bg-[var(--color-paper)]">
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : error ? (
      <EmptyMarketState
        category={filters.category}
        message={error}
        onSwitchCategory={(cat) => { setFilters(prev => ({ ...prev, category: cat })); }}
      />
    ) : filteredMarkets.length === 0 ? (
      <div className={`${cardBgColor} border p-6 text-center`}>
        <p className={`${textColor} opacity-90`}>
          {markets.length > 0
            ? `No ${filters.platform === 'kalshi' ? 'Kalshi' : 'Polymarket'} markets match your filters. Try selecting "All Platforms" or adjusting other options.`
            : 'No markets match your filters. Try broadening your options.'}
        </p>
      </div>
    ) : (
      <GlowList
        count={Math.min(displayLimit, filteredMarkets.length)}
        defaultOpen={false}
        renderSummary={() => (
          <>
            <span className="inline-flex rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
              {filters.category === 'all' ? 'All' : filters.category}
            </span>
            {filters.platform !== 'all' && (
              <span className="inline-flex rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
                {filters.platform}
              </span>
            )}
          </>
        )}
      >
        <div className="space-y-4 pt-1">
          {filteredMarkets.slice(0, displayLimit).map((market, index) => (
            <Reveal key={market.marketID || market.id || index} delay={Math.min((index % 10) * 40, 240)}>
              <StaggeredMarketCard
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
            </Reveal>
          ))}
        </div>
        {filteredMarkets.length > displayLimit && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onLoadMore}
              className="inline-flex items-center gap-1.5 rounded-chip bg-field px-2.5 py-1 text-[11.5px] font-medium text-ink-2 shadow-hairline transition-colors duration-100 hover:bg-hover hover:text-ink"
            >
              +{filteredMarkets.length - displayLimit} more
            </button>
          </div>
        )}
      </GlowList>
    )}
  </div>
 );
}
