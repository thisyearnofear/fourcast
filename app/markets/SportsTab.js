'use client';

import React, { useState, useMemo } from "react";
import EmptyMarketState from "@/components/EmptyMarketState";
import { StaggeredMarketCard } from "./MarketCardShared";
import { Skeleton } from "@/components/Skeleton";
import Reveal from "@/components/motion/Reveal";
import GlassPanel from "@/components/ui/GlassPanel";
import ExpandPanel from "@/components/ui/ExpandPanel";
import GlowList from "./GlowList";

export function SportsTabContent({
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
 analysisStage,
 selectedMarket,
 onPublishSignal,
 analysisMode,
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
 onSignalCountFetched,
}) {
 const dateRangeLabels = {
 today: "Today",
 tomorrow: "Tomorrow",
 "this-week": "This Week",
 later: "Later",
 };

 return (
  <div className="space-y-8">
  {/* TxLINE Coverage Status */}
  <div className="flex items-center gap-2 px-3 py-2 border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 text-xs">
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
    <span className="text-[var(--color-ink-muted)]">
      <span className="font-medium text-[var(--color-ink)]">TxLINE</span>
      {" · "}
      <span className="text-emerald-500">MLS Live</span>
      {" · "}
      <span className="text-amber-500">PL Aug 21</span>
      {" · "}
      <span className="text-emerald-500">NFL Live</span>
      <span className="hidden sm:inline text-[var(--color-ink-faint)]"> — professional consensus odds powering agent intelligence</span>
    </span>
  </div>

  {/* Compact Filter Bar — open section */}
  <GlassPanel>
    <ExpandPanel title="Filters" subtitle="event type · date · volume" defaultOpen>
      <div className="space-y-2">
        {/* Event Type */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <label className={`${textColor} text-xs opacity-60 min-w-max`}>Event Type</label>
          <select
            value={filters.eventType}
            onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value }))}
            className={"mc-input flex-1 px-3 py-2 text-sm"}
          >
            <option value="Soccer">Soccer</option>
            <option value="MLS">MLS</option>
            <option value="NFL">NFL</option>
            <option value="F1">Formula 1</option>
            <option value="all">All Sports</option>
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
            value={String(minVolume)}
            onChange={(e) => setMinVolume(parseInt(e.target.value))}
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
            value={String(filters.confidence)}
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
      </div>
    </ExpandPanel>
  </GlassPanel>

  {dateRange === "later" && (
    <GlassPanel className="p-3 mt-2">
      <p className={`text-xs ${textColor} opacity-80`}>
        Weather-based analysis becomes less reliable beyond ~14 days.
      </p>
    </GlassPanel>
  )}

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
      category={filters.eventType}
      message={error}
      onSwitchCategory={(cat) => { setFilters(prev => ({ ...prev, eventType: cat })); }}
    />
  ) : markets.length === 0 ? (
    <EmptyMarketState
      category={filters.eventType}
      message="No markets match the current filters."
      onSwitchCategory={(cat) => { setFilters(prev => ({ ...prev, eventType: cat })); }}
    />
  ) : (
    <>
      <GlowList
        count={Math.min(displayLimit, markets.length)}
        defaultOpen={false}
        renderSummary={() => (
          <>
            <span className="inline-flex rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
              {filters.eventType === 'all' ? 'All Sports' : filters.eventType}
            </span>
            {filters.confidence !== 'all' && (
              <span className="inline-flex rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
                {filters.confidence}
              </span>
            )}
          </>
        )}
      >
        <div className="space-y-4 pt-1">
          {markets.slice(0, displayLimit).map((market, index) => (
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
        {markets.length > displayLimit && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onLoadMore}
              className="inline-flex items-center gap-1.5 rounded-chip bg-field px-2.5 py-1 text-[11.5px] font-medium text-ink-2 shadow-hairline transition-colors duration-100 hover:bg-hover hover:text-ink"
            >
              +{markets.length - displayLimit} more
            </button>
          </div>
        )}
      </GlowList>
    </>
  )}
  </div>
 );
}
