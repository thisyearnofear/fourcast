'use client';

import React, { useState } from 'react';

export default function MarketSelector({
  markets,
  selectedMarket,
  onSelectMarket,
  isNight,
  isLoading,
  onAnalyze,
  onQuickTrade
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4; // 3-4 markets per screen on mobile
  
  if (isLoading || !markets || markets.length === 0) {
    return null;
  }

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-slate-800/80 border-white/30' : 'bg-slate-100/90 border-black/30';
  const hoverBgColor = isNight ? 'hover:bg-slate-700/80' : 'hover:bg-slate-200/80';
  const activeBgColor = isNight ? 'bg-blue-700/50 border-blue-400/60' : 'bg-blue-200/70 border-blue-500/60';
  const quickTradeButtonColor = isNight 
    ? 'bg-green-600/40 hover:bg-green-600/60 text-green-100 border-green-400/40' 
    : 'bg-green-200/60 hover:bg-green-300/70 text-green-900 border-green-400/50';

  // Pagination
  const totalPages = Math.ceil(markets.length / itemsPerPage);
  const paginatedMarkets = markets.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className={`text-lg sm:text-2xl font-thin ${textColor} tracking-wide`}>
          Weather-Sensitive Edges
        </h3>
        <p className={`text-xs sm:text-sm ${textColor} opacity-60 mt-2 font-light`}>
          {markets.length} opportunit{markets.length !== 1 ? 'ies' : 'y'} found
        </p>
      </div>

      {/* Markets - Paginated */}
      <div className="space-y-3">
        {paginatedMarkets.map((market, index) => (
          <div
            key={market.marketID || index}
            className={`p-4 rounded-2xl border backdrop-blur-sm transition-all ${
              selectedMarket?.marketID === market.marketID
                ? activeBgColor
                : `${bgColor} ${hoverBgColor}`
            }`}
          >
            {/* Title & Quick Trade Button (Top Row) */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <button
                onClick={() => onSelectMarket(market)}
                className="flex-1 text-left"
              >
                <div className={`${textColor} font-light text-sm line-clamp-2 tracking-wide`}>
                  {market.title || 'Unnamed Market'}
                </div>
                {/* Resolution Badge */}
                {(() => {
                  const res = market.resolutionDate || market.endDate || market.expiresAt;
                  if (!res) return null;
                  const d = new Date(res);
                  if (isNaN(d.getTime())) return null;
                  const days = Math.max(0, Math.round((d - new Date()) / (1000 * 60 * 60 * 24)));
                  let cls;
                  if (days <= 3) {
                    cls = isNight ? 'bg-green-600/30 border-green-400/40 text-green-200' : 'bg-green-200/60 border-green-400/50 text-green-900';
                  } else if (days <= 7) {
                    cls = isNight ? 'bg-yellow-600/30 border-yellow-400/40 text-yellow-200' : 'bg-yellow-200/60 border-yellow-400/50 text-yellow-900';
                  } else if (days <= 14) {
                    cls = isNight ? 'bg-orange-600/30 border-orange-400/40 text-orange-200' : 'bg-orange-200/60 border-orange-400/50 text-orange-900';
                  } else {
                    cls = isNight ? 'bg-slate-700/40 border-white/20 text-white' : 'bg-slate-200/60 border-black/20 text-black';
                  }
                  return (
                    <div className="mt-1">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>
                        Resolves in {days}d
                      </span>
                    </div>
                  );
                })()}
              </button>
              
              {/* Quick Trade Button - Right Side */}
              {onQuickTrade && market.confidence && market.confidence !== 'LOW' && (
                <button
                  onClick={() => onQuickTrade(market)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-light whitespace-nowrap border transition-all ${quickTradeButtonColor}`}
                >
                  Trade
                </button>
              )}
            </div>

            {/* Tags */}
            {market.tags && market.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {market.tags.slice(0, 2).map((tag, idx) => {
                  const tagLabel = typeof tag === 'string' ? tag : (tag.label || '');
                  return (
                    <span key={idx} className={`text-xs px-2 py-1 rounded-full font-light ${
                      isNight ? 'bg-purple-600/40 text-purple-100 border border-purple-400/50' : 'bg-purple-200/60 text-purple-900 border border-purple-400/60'
                    }`}>
                      {tagLabel}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Metrics Grid */}
            <div className={`${textColor} opacity-70 text-xs space-y-2 font-light`}>
              {/* Row 1: Volume & Bid/Ask */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <span className="opacity-50 text-xs block">Volume</span>
                  <div className="font-light">${(market.volume24h / 1000 || 0).toFixed(0)}K</div>
                </div>
                {market.oddsAnalysis?.bestBid !== undefined && market.oddsAnalysis?.bestBid !== null ? (
                  <div className="text-center">
                    <span className="opacity-50 text-xs block">Bid/Ask</span>
                    <div className="font-light">
                      {(market.oddsAnalysis.bestBid * 100).toFixed(1)}%/{(market.oddsAnalysis.bestAsk * 100).toFixed(1)}%
                    </div>
                  </div>
                ) : market.currentOdds?.yes ? (
                  <div className="text-center">
                    <span className="opacity-50 text-xs block">Mid Price</span>
                    <div className="font-light">{(market.currentOdds.yes * 100).toFixed(1)}%</div>
                  </div>
                ) : null}
              </div>

              {/* Row 2: Edge Score & Confidence */}
              {market.edgeScore !== undefined && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <span className="opacity-50 text-xs block">Edge Score</span>
                    <div className={`font-light ${
                      market.confidence === 'HIGH' ? 'text-green-400' :
                      market.confidence === 'MEDIUM' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {market.edgeScore.toFixed(1)}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="opacity-50 text-xs block">Confidence</span>
                    <div className={`font-light ${
                      market.confidence === 'HIGH' ? 'text-green-400' :
                      market.confidence === 'MEDIUM' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {market.confidence || 'MEDIUM'}
                    </div>
                  </div>
                </div>
              )}

              {/* Weather Driver Badge */}
              {market.edgeFactors && (
                <div className="text-center pt-1">
                  <span className="opacity-50 text-xs block mb-1">Weather Driver</span>
                  <div className={`text-xs font-light px-2.5 py-1 rounded-full inline-block ${
                    isNight ? 'bg-blue-600/30 text-blue-200' : 'bg-blue-200/50 text-blue-900'
                  }`}>
                    {(() => {
                      const factors = market.edgeFactors;
                      const driverMap = [
                        { name: 'Direct Weather', value: factors.weatherDirect },
                        { name: 'Outdoor Event', value: factors.weatherSensitiveEvent },
                        { name: 'Current Conditions', value: factors.contextualWeatherImpact },
                        { name: 'Inefficiency', value: factors.asymmetrySignal }
                      ];
                      const primary = driverMap.reduce((prev, current) => 
                        current.value > prev.value ? current : prev
                      );
                      return primary.name;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Analyze Button - Below metrics */}
            <button
              onClick={() => onAnalyze(market)}
              className={`w-full mt-3 py-2 text-xs font-light rounded-lg transition-all border ${
                selectedMarket?.marketID === market.marketID
                  ? `${textColor} border-current/50 bg-current/10`
                  : `${textColor} opacity-60 hover:opacity-100 border-current/20`
              }`}
            >
              Analyze This Market
            </button>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className={`px-3 py-2 text-xs font-light rounded transition-all ${
              currentPage === 0
                ? `${textColor} opacity-30 cursor-not-allowed`
                : `${textColor} opacity-70 hover:opacity-100`
            }`}
          >
            ← Previous
          </button>
          
          <div className={`text-xs ${textColor} opacity-60 font-light`}>
            {currentPage + 1} of {totalPages}
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className={`px-3 py-2 text-xs font-light rounded transition-all ${
              currentPage >= totalPages - 1
                ? `${textColor} opacity-30 cursor-not-allowed`
                : `${textColor} opacity-70 hover:opacity-100`
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
