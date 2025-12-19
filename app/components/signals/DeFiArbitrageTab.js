'use client';

import React, { useState, useEffect } from 'react';

export default function DeFiArbitrageTab({
  isNight,
  textColor,
  cardBgColor
}) {
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    minSpread: 5,
    limit: 20
  });
  const [expandedOppId, setExpandedOppId] = useState(null);

  useEffect(() => {
    fetchArbitrage();
  }, [filters]);

  const fetchArbitrage = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        minSpread: filters.minSpread,
        limit: filters.limit
      });

      const response = await fetch(`/api/defi/arbitrage?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setOpportunities(data.data.opportunities || []);
      } else {
        setError(data.error?.message || 'Failed to fetch arbitrage opportunities');
      }
    } catch (err) {
      console.error('Failed to fetch arbitrage:', err);
      setError('Unable to connect to arbitrage service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMinSpreadChange = (spread) => {
    setFilters(prev => ({ ...prev, minSpread: spread }));
  };

  return (
    <div className="w-full">
      {/* Filter Controls */}
      <div className={`${cardBgColor} backdrop-blur-xl border rounded-2xl p-4 mb-6`}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className={`block text-sm ${textColor} opacity-70 mb-2`}>
              Minimum Spread
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="30"
                value={filters.minSpread}
                onChange={(e) => handleMinSpreadChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className={`text-lg font-light ${textColor} min-w-12`}>
                {filters.minSpread.toFixed(1)}%
              </span>
            </div>
            <p className={`text-xs ${textColor} opacity-50 mt-1`}>
              Show only opportunities with spreads above this threshold
            </p>
          </div>
          <button
            onClick={fetchArbitrage}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg text-sm font-light transition-all ${
              isLoading
                ? `${textColor} opacity-50 cursor-not-allowed`
                : `${isNight ? 'bg-blue-500/30 hover:bg-blue-500/50 text-white' : 'bg-blue-400/30 hover:bg-blue-400/50 text-black'}`
            }`}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className={`w-6 h-6 border-2 ${isNight ? 'border-white/30 border-t-white' : 'border-black/30 border-t-black'} rounded-full animate-spin`}></div>
          <span className={`ml-3 ${textColor} opacity-70`}>Loading arbitrage opportunities...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-6 text-center`}>
          <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
          <button
            onClick={fetchArbitrage}
            className={`px-4 py-2 rounded-lg text-sm font-light ${isNight ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/20 hover:bg-black/30 text-black'}`}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && opportunities.length === 0 && (
        <div className={`${cardBgColor} backdrop-blur-xl border rounded-3xl p-12 text-center`}>
          <div className="text-6xl mb-4">💱</div>
          <h3 className={`text-xl font-light ${textColor} mb-2`}>No Opportunities Found</h3>
          <p className={`${textColor} opacity-60 text-sm`}>
            Try lowering the minimum spread threshold to see more opportunities
          </p>
        </div>
      )}

      {/* Opportunities Grid */}
      {!isLoading && !error && opportunities.length > 0 && (
        <div className="space-y-4">
          <div className={`text-sm ${textColor} opacity-70`}>
            📊 Found {opportunities.length} opportunities
          </div>

          {opportunities.map((opp, idx) => (
            <div
              key={opp.signal_id || idx}
              className={`${cardBgColor} backdrop-blur-xl border rounded-2xl overflow-hidden transition-all`}
            >
              {/* Header / Always Visible */}
              <div
                className="p-4 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setExpandedOppId(expandedOppId === opp.signal_id ? null : opp.signal_id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className={`text-lg font-light ${textColor} line-clamp-2`}>
                      {opp.market_title}
                    </h3>
                    {opp.venue && (
                      <p className={`text-xs ${textColor} opacity-60 mt-1`}>
                        📍 {opp.venue}
                      </p>
                    )}
                  </div>
                  <span className={`text-xl font-light px-3 py-1 rounded-lg ${
                    opp.arbitrage.spread_percent > 15
                      ? isNight ? 'bg-green-500/20 text-green-300' : 'bg-green-400/20 text-green-700'
                      : isNight ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-400/20 text-blue-700'
                  }`}>
                    {opp.arbitrage.spread_percent.toFixed(1)}%
                  </span>
                </div>

                {/* Quick Preview */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded p-2`}>
                    <span className={`${textColor} opacity-60`}>Buy on</span>
                    <div className={`${textColor} font-light capitalize`}>
                      {opp.arbitrage.buy_platform}
                    </div>
                    <div className={`${textColor} text-xs opacity-70`}>
                      @ {(opp.arbitrage.buy_odds * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded p-2`}>
                    <span className={`${textColor} opacity-60`}>Sell on</span>
                    <div className={`${textColor} font-light capitalize`}>
                      {opp.arbitrage.sell_platform}
                    </div>
                    <div className={`${textColor} text-xs opacity-70`}>
                      @ {(opp.arbitrage.sell_odds * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Details */}
              {expandedOppId === opp.signal_id && (
                <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} border-t ${isNight ? 'border-white/10' : 'border-black/10'} p-4 space-y-4`}>
                  {/* DeFi Metrics */}
                  <div>
                    <h4 className={`text-sm font-light ${textColor} mb-3 opacity-80`}>
                      💰 DeFi Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className={`${textColor} opacity-60`}>Profit per $1k</span>
                        <div className={`${textColor} font-light text-sm`}>
                          ${parseFloat(opp.defi_metrics.estimated_profit_per_1k).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className={`${textColor} opacity-60`}>Capital Efficiency</span>
                        <div className={`${textColor} font-light text-sm`}>
                          {opp.defi_metrics.capital_efficiency.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className={`${textColor} opacity-60`}>Liquidity Score</span>
                        <div className={`${textColor} font-light text-sm`}>
                          {opp.defi_metrics.liquidity_score}/100
                        </div>
                      </div>
                      <div>
                        <span className={`${textColor} opacity-60`}>Flash Loan Ready</span>
                        <div className={`font-light text-sm ${opp.defi_metrics.flash_loan_suitable ? 'text-green-400' : 'text-orange-400'}`}>
                          {opp.defi_metrics.flash_loan_suitable ? '✅ Yes' : '⚠️ Limited'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Platform Details */}
                  <div>
                    <h4 className={`text-sm font-light ${textColor} mb-3 opacity-80`}>
                      📊 Platform Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`${isNight ? 'bg-blue-500/10' : 'bg-blue-400/10'} border ${isNight ? 'border-blue-500/20' : 'border-blue-400/20'} rounded p-3`}>
                        <h5 className={`text-xs font-light ${textColor} mb-2 uppercase opacity-70`}>
                          Polymarket
                        </h5>
                        <div className={`text-2xl font-light ${textColor}`}>
                          {(opp.polymarket.odds_yes * 100).toFixed(1)}%
                        </div>
                        <div className={`text-xs ${textColor} opacity-60 mt-1`}>
                          Vol: ${(opp.polymarket.volume_24h / 1000).toFixed(1)}k
                        </div>
                      </div>
                      <div className={`${isNight ? 'bg-emerald-500/10' : 'bg-emerald-400/10'} border ${isNight ? 'border-emerald-500/20' : 'border-emerald-400/20'} rounded p-3`}>
                        <h5 className={`text-xs font-light ${textColor} mb-2 uppercase opacity-70`}>
                          Kalshi
                        </h5>
                        <div className={`text-2xl font-light ${textColor}`}>
                          {(opp.kalshi.odds_yes * 100).toFixed(1)}%
                        </div>
                        <div className={`text-xs ${textColor} opacity-60 mt-1`}>
                          Vol: ${(opp.kalshi.volume_24h / 1000).toFixed(1)}k
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Digest */}
                  <div>
                    <h4 className={`text-sm font-light ${textColor} mb-2 opacity-80`}>
                      💡 Analysis
                    </h4>
                    <p className={`text-xs leading-relaxed ${textColor} opacity-70`}>
                      {opp.ai_digest}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <a
                      href={`https://polymarket.com/market/${opp.polymarket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-light text-center transition-all ${
                        isNight
                          ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                          : 'bg-blue-400/20 hover:bg-blue-400/30 text-blue-700'
                      }`}
                    >
                      View on Polymarket ↗
                    </a>
                    <a
                      href={`https://kalshi.com/markets/${opp.kalshi.id.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-light text-center transition-all ${
                        isNight
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                          : 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-700'
                      }`}
                    >
                      View on Kalshi ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
