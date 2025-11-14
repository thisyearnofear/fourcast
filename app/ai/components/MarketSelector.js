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
  const bgColor = isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20';
  const hoverBgColor = isNight ? 'hover:bg-white/20' : 'hover:bg-black/20';
  const activeBgColor = isNight ? 'bg-blue-500/40 border-blue-400/50' : 'bg-blue-400/30 border-blue-500/50';
  const buttonBgColor = isNight ? 'bg-blue-500/30 hover:bg-blue-500/50' : 'bg-blue-400/30 hover:bg-blue-400/50';
  const buttonTextColor = isNight ? 'text-blue-300' : 'text-blue-700';

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-lg font-light ${textColor} opacity-90`}>
          Weather-Sensitive Markets
        </h3>
        <p className={`text-sm ${textColor} opacity-60 mt-1`}>
          {markets.length} market{markets.length !== 1 ? 's' : ''} available
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
        {markets.map((market, index) => (
          <button
            key={market.marketID || index}
            onClick={() => onSelectMarket(market)}
            className={`p-4 rounded-lg border transition-all text-left ${
              selectedMarket?.marketID === market.marketID
                ? activeBgColor
                : `${bgColor} ${hoverBgColor}`
            }`}
          >
            {/* Title */}
            <div className={`${textColor} font-light line-clamp-2 text-sm mb-3`}>
              {market.title || 'Unnamed Market'}
            </div>

            {/* Tags */}
            {market.tags && market.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {market.tags.slice(0, 2).map((tag, idx) => (
                  <span key={idx} className={`text-xs px-2 py-1 rounded ${
                    isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-400/20 text-purple-700'
                  }`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats Grid */}
            <div className={`${textColor} opacity-70 text-xs grid grid-cols-2 gap-2`}>
              <div>
                <span className="opacity-60">Volume:</span> ${(market.volume24h / 1000 || 0).toFixed(0)}K
              </div>
              <div>
                <span className="opacity-60">Bid:</span> {(market.currentOdds?.yes * 100 || 0).toFixed(1)}%
              </div>
              <div>
                <span className="opacity-60">Ask:</span> {(market.currentOdds?.no * 100 || 0).toFixed(1)}%
              </div>
              {market.liquidity > 0 && (
                <div>
                  <span className="opacity-60">Liquidity:</span> ${(market.liquidity / 1000 || 0).toFixed(0)}K
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedMarket && (
        <button
          onClick={() => onAnalyze(selectedMarket)}
          className={`w-full py-2 rounded-lg font-light text-sm transition-all duration-200 ${buttonBgColor} ${buttonTextColor}`}
        >
          Analyze This Market
        </button>
      )}
    </div>
  );
}
