'use client';

import React from 'react';

export default function MarketSelector({
  markets,
  selectedMarket,
  onSelectMarket,
  isNight,
  isLoading,
  onAnalyze
}) {
  if (isLoading || !markets || markets.length === 0) {
    return null;
  }

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-slate-800/80 border-white/30' : 'bg-slate-100/90 border-black/30';
  const hoverBgColor = isNight ? 'hover:bg-slate-700/80' : 'hover:bg-slate-200/80';
  const activeBgColor = isNight ? 'bg-blue-700/50 border-blue-400/60' : 'bg-blue-200/70 border-blue-500/60';
  const buttonBgColor = isNight 
    ? 'bg-gradient-to-r from-blue-600/40 to-purple-600/40 hover:from-blue-600/60 hover:to-purple-600/60' 
    : 'bg-gradient-to-r from-blue-300/60 to-purple-300/60 hover:from-blue-400/70 hover:to-purple-400/70';
  const buttonTextColor = isNight ? 'text-blue-100' : 'text-blue-900';

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className={`text-2xl font-thin ${textColor} tracking-wide`}>
          Available Markets
        </h3>
        <p className={`text-sm ${textColor} opacity-60 mt-2 font-light`}>
          {markets.length} weather-sensitive opportunity{markets.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
         {markets.map((market, index) => (
           <button
             key={market.marketID || index}
             onClick={() => onSelectMarket(market)}
             className={`w-full p-4 rounded-2xl border backdrop-blur-sm transition-all text-center duration-200 ${
               selectedMarket?.marketID === market.marketID
                 ? activeBgColor
                 : `${bgColor} ${hoverBgColor}`
             }`}
           >
             {/* Title */}
             <div className={`${textColor} font-light line-clamp-2 text-sm mb-3 tracking-wide`}>
              {market.title || 'Unnamed Market'}
            </div>

            {/* Tags */}
            {market.tags && market.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {market.tags.slice(0, 2).map((tag, idx) => {
                  const tagLabel = typeof tag === 'string' ? tag : (tag.label || '');
                  return (
                    <span key={idx} className={`text-xs px-2.5 py-1 rounded-full font-light ${
                      isNight ? 'bg-purple-600/40 text-purple-100 border border-purple-400/50' : 'bg-purple-200/60 text-purple-900 border border-purple-400/60'
                    }`}>
                      {tagLabel}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Stats Grid - Enhanced with edge scores and proper bid/ask */}
            <div className={`${textColor} opacity-70 text-xs space-y-2 font-light`}>
              {/* Row 1: Volume & Bid/Ask or Edge Score */}
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
              
              {/* Row 2: Edge Score & Liquidity */}
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
                    <span className="opacity-50 text-xs block">Liquidity</span>
                    <div className="font-light">${((market.liquidity || market.orderBookMetrics?.totalDepth || 0) / 1000).toFixed(0)}K</div>
                  </div>
                </div>
              )}

              {/* Primary Weather Driver - Centered at bottom */}
              {market.edgeFactors ? (
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
              ) : (
                <div className="text-center pt-1">
                  <span className="opacity-50 text-xs block mb-1">Category</span>
                  <div className={`text-xs font-light px-2.5 py-1 rounded-full inline-block ${
                    isNight ? 'bg-slate-600/30 text-slate-200' : 'bg-slate-200/50 text-slate-900'
                  }`}>
                    {market.eventType || 'Other'}
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>


    </div>
  );
}
