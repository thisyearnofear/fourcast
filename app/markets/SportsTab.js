'use client';

import React from "react";
import EmptyMarketState from "@/components/EmptyMarketState";
import { StaggeredMarketCard } from "./MarketCardShared";

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
  onSignalCountFetched,
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
            className={`flex-1 px-3 py-2 text-sm rounded-lg border bg-white/10 border-white/20 text-white`}
          >
            <option value="Soccer">Soccer</option>
            <option value="NFL">NFL</option>
            <option value="F1">Formula 1</option>
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
            value={String(minVolume)}
            onChange={(e) => setMinVolume(parseInt(e.target.value))}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border bg-white/10 border-white/20 text-white`}
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
            className={`flex-1 px-3 py-2 text-sm rounded-lg border bg-white/10 border-white/20 text-white`}
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
              ? "bg-green-500/40 border-green-400/40"
              : "bg-white/10 border-white/20"
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
      {isLoading || !markets ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`glass-subtle rounded-3xl p-5 border-white/10`}>
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
          category={filters.eventType}
          message={error}
          onSwitchCategory={(cat) => {
            setFilters(prev => ({ ...prev, eventType: cat }));
          }}
        />
      ) : markets.length === 0 ? (
        <EmptyMarketState
          category={filters.eventType}
          message="No markets match the current filters."
          onSwitchCategory={(cat) => {
            setFilters(prev => ({ ...prev, eventType: cat }));
          }}
        />
      ) : (
        <div className="space-y-4">
          {markets.map((market, index) => (
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
      )}
    </div>
  );
}

// Chain Recommendation Badge - Shows recommended action inline
