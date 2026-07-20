'use client';

import React, { useState } from 'react';
import KalshiOrderPanel from '@/components/KalshiOrderPanel';
import ArbitrageExecutor from '@/components/ArbitrageExecutor';
import { useArbitrageOpportunities } from '@/hooks/useArbitrageOpportunities';

export default function DeFiArbitrageTab({
 isNight,
 textColor,
 cardBgColor
}) {
 const {
 opportunities,
 isLoading,
 error,
 filters,
 setMinSpread,
 refresh
 } = useArbitrageOpportunities();

 const [expandedOppId, setExpandedOppId] = useState(null);
 const [selectedKalshiMarket, setSelectedKalshiMarket] = useState(null);
 const [selectedArbitrageOpp, setSelectedArbitrageOpp] = useState(null);

 return (
 <div className="w-full">
 {/* Filter Controls — open section */}
 <div className="platform-open-section mb-10">
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
 onChange={(e) => setMinSpread(parseFloat(e.target.value))}
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
 onClick={refresh}
 disabled={isLoading}
 className={`px-6 py-2 text-sm font-light transition-colors ${isLoading
 ? `${textColor} opacity-50 cursor-not-allowed`
 : `bg-emerald-500/30 hover:bg-emerald-500/50 text-white`
 }`}
 >
 {isLoading ? 'Refreshing...' : 'Refresh'}
 </button>
 </div>
 </div>
 {/* Loading State */}
 {isLoading && (
 <div className="flex items-center justify-center py-12">
 <div className={`w-6 h-6 border-2 border-white/30 border-t-white animate-spin`}></div>
 <span className={`ml-3 ${textColor} opacity-70`}>Loading arbitrage opportunities...</span>
 </div>
 )}
 {/* Error State */}
 {error && !isLoading && (
 <div className="platform-open-section py-6 text-center">
 <p className={`${textColor} opacity-90 mb-4`}>{error}</p>
 <button
 onClick={refresh}
 className={`px-4 py-2 text-sm font-light bg-white/20 hover:bg-white/30 text-white`}
 >
 Try Again
 </button>
 </div>
 )}
 {/* Empty State */}
 {!isLoading && !error && opportunities.length === 0 && (
 <div className="platform-open-section py-12 text-center">
 <div className="text-6xl mb-4">💱</div>
 <h3 className={`text-xl font-light ${textColor} mb-2`}>No Opportunities Found</h3>
 <p className={`${textColor} opacity-60 text-sm`}>
 Try lowering the minimum spread threshold to see more opportunities
 </p>
 </div>
 )}
 {/* Opportunities — inspectable rows */}
 {!isLoading && !error && opportunities.length > 0 && (
 <div>
 <div className={`text-sm ${textColor} opacity-70 mb-4`}>
 📊 Found {opportunities.length} opportunities
 </div>

 <div className="border-t border-white/15">
 {opportunities.map((opp, idx) => (
 <div
 key={opp.signal_id || idx}
 className="position-record border-b border-white/10 transition-colors"
 >
 {/* Header / Always Visible */}
 <div
 className="px-1 py-5 cursor-pointer hover:bg-white/[0.03] transition-colors sm:px-3"
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
 <span className={`text-xl font-light px-3 py-1 ${opp.arbitrage.spread_percent > 15
 ? 'bg-emerald-500/20 text-emerald-300'
 : 'bg-emerald-500/15 text-emerald-200'
 }`}>
 {opp.arbitrage.spread_percent.toFixed(1)}%
 </span>
 </div>

 {/* Quick Preview */}
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className={`bg-white/5 p-2`}>
 <span className={`${textColor} opacity-60`}>Buy on</span>
 <div className={`${textColor} font-light capitalize`}>
 {opp.arbitrage.buy_platform}
 </div>
 <div className={`${textColor} text-xs opacity-70`}>
 @ {(opp.arbitrage.buy_odds * 100).toFixed(1)}%
 </div>
 </div>
 <div className={`bg-white/5 p-2`}>
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
 <div className={`bg-white/5 border-t border-white/10 p-4 space-y-4`}>
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
 <div className={`font-light text-sm ${opp.defi_metrics.flash_loan_suitable ? 'text-emerald-400' : 'text-amber-400'}`}>
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
 <div className={`bg-emerald-500/10 border border-emerald-500/20 p-3`}>
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
 <div className={`bg-emerald-500/10 border border-emerald-500/20 p-3`}>
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
 <button
 onClick={() => setSelectedArbitrageOpp(opp)}
 className={`flex-1 px-3 py-2 text-xs font-semibold text-center transition-all shadow-sm
 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90`}
 >
 ⚡ Execute Arbitrage
 </button>
 <a
 href={`https://polymarket.com/market/${opp.polymarket.id}`}
 target="_blank"
 rel="noopener noreferrer"
 className={`flex-1 px-3 py-2 text-xs font-light text-center transition-all bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200`}
 >
 View on Polymarket ↗
 </a>
 <button
 onClick={() => setSelectedKalshiMarket({
 marketID: opp.kalshi.id,
 title: opp.market_title,
 currentOdds: {
 yes: opp.kalshi.odds_yes,
 no: 1 - opp.kalshi.odds_yes
 },
 odds_yes: opp.kalshi.odds_yes,
 odds_no: 1 - opp.kalshi.odds_yes
 })}
 className={`flex-1 px-3 py-2 text-xs font-light text-center transition-all bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300`}
 >
 Trade on Kalshi 📊
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 {/* Kalshi Order Panel */}
 {selectedKalshiMarket && (
 <KalshiOrderPanel
 market={selectedKalshiMarket}
 isNight={isNight}
 onClose={() => setSelectedKalshiMarket(null)}
 />
 )}
 {/* Arbitrage Executor */}
 {selectedArbitrageOpp && (
 <ArbitrageExecutor
 opportunity={selectedArbitrageOpp}
 onClose={() => setSelectedArbitrageOpp(null)}
 isNight={isNight}
 />
 )}
 </div>
 );
}
