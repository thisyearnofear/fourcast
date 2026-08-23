'use client';

import React, { useState } from 'react';
import GlowList from '@/components/ui/GlowList';
import KalshiOrderPanel from '@/components/KalshiOrderPanel';
import ArbitrageExecutor from '@/components/ArbitrageExecutor';
import { useArbitrageOpportunities } from '@/hooks/useArbitrageOpportunities';

function SpreadTierBadge({ tier, count, active }) {
 const colors = {
   high: active ? 'bg-accent/20 text-accent border-accent/40' : 'bg-accent/10 text-accent border-accent/20',
   medium: active ? 'bg-sealed/20 text-sealed border-sealed/40' : 'bg-sealed/10 text-sealed border-sealed/20',
   low: active ? 'bg-field/20 text-ink-2 border-line/40' : 'bg-field/10 text-ink-faint border-line/20',
 };

 return (
   <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${colors[tier]}`}>
     {tier === 'high' ? '🟢' : tier === 'medium' ? '🟡' : '🔵'} {count} {tier}
   </span>
 );
}

export default function DeFiArbitrageTab({
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

 // Group by spread tier
 const tiers = React.useMemo(() => {
   const high = [];
   const medium = [];
   const low = [];
   opportunities.forEach(opp => {
     const spread = opp.arbitrage?.spread_percent || 0;
     if (spread > 2) high.push(opp);
     else if (spread > 1) medium.push(opp);
     else low.push(opp);
   });
   return { high, medium, low };
 }, [opportunities]);

 // Filter by minSpread
 const filteredBySpread = React.useMemo(() => {
   return opportunities.filter(o => (o.arbitrage?.spread_percent || 0) >= filters.minSpread);
 }, [opportunities, filters.minSpread]);

 // Re-group after filter
 const tieredFiltered = React.useMemo(() => {
   const h = [], m = [], l = [];
   filteredBySpread.forEach(opp => {
     const spread = opp.arbitrage?.spread_percent || 0;
     if (spread > 2) h.push(opp);
     else if (spread > 1) m.push(opp);
     else l.push(opp);
   });
   return { high: h, medium: m, low: l };
 }, [filteredBySpread]);

 const renderTierChips = () => {
   const chips = [];
   if (tieredFiltered.high.length > 0) {
     chips.push(<span key="h" className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/30">🟢 {tieredFiltered.high.length} high</span>);
   }
   if (tieredFiltered.medium.length > 0) {
     chips.push(<span key="m" className="inline-flex items-center rounded-full bg-sealed/15 px-2 py-0.5 text-[10px] font-medium text-sealed border border-sealed/30">🟡 {tieredFiltered.medium.length} medium</span>);
   }
   if (tieredFiltered.low.length > 0) {
     chips.push(<span key="l" className="inline-flex items-center rounded-full bg-field px-2 py-0.5 text-[10px] font-medium text-ink-faint shadow-hairline">🔵 {tieredFiltered.low.length} low</span>);
   }
   return chips;
 };

 return (
 <div className="w-full">
 {/* Filter Controls — open section */}
 <div className="platform-open-section mb-6">
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
         : `bg-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/50 text-[var(--color-ink)]`
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
       className={`px-4 py-2 text-sm font-light bg-white/20 hover:bg-white/30 text-[var(--color-ink)]`}
     >
       Try Again
     </button>
   </div>
 )}

 {/* Empty State */}
 {!isLoading && !error && filteredBySpread.length === 0 && (
   <div className="platform-open-section py-12 text-center">
     <div className="text-6xl mb-4">💱</div>
     <h3 className={`text-xl font-light ${textColor} mb-2`}>No Opportunities Found</h3>
     <p className={`${textColor} opacity-60 text-sm`}>
       Try lowering the minimum spread threshold to see more opportunities
     </p>
   </div>
 )}

 {/* Tiered opportunities — GlowList per tier */}
 {!isLoading && !error && filteredBySpread.length > 0 && (
   <div className="space-y-2">
     {/* Summary header */}
     <div className="px-1.5 py-1 flex items-center gap-2 text-xs text-ink-faint">
       <span>{filteredBySpread.length} opportunity{filteredBySpread.length !== 1 ? 'ies' : ''}</span>
       {renderTierChips()}
     </div>

     {/* High spread tier — always start expanded if exists */}
     {tieredFiltered.high.length > 0 && (
       <GlowList
         count={tieredFiltered.high.length}
         label="opportunity"
         defaultOpen={true}
         emptyLabel="No high-spread opportunities"
       >
         <div className="mt-2 border-t border-[var(--color-rule)]">
           {tieredFiltered.high.map((opp, idx) => (
             <div
               key={opp.signal_id || idx}
               className="border-b border-[var(--color-rule)] transition-colors"
             >
               {/* Header / Always Visible */}
               <div
                 className="px-1 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors sm:px-3"
                 onClick={() => setExpandedOppId(expandedOppId === opp.signal_id ? null : opp.signal_id)}
               >
                 <div className="flex items-start justify-between mb-3">
                   <div className="flex-1 min-w-0">
                     <h3 className={`text-base font-light ${textColor} line-clamp-1`}>
                       {opp.market_title}
                     </h3>
                     {opp.venue && (
                       <p className={`text-xs ${textColor} opacity-60 mt-1`}>
                         📍 {opp.venue}
                       </p>
                     )}
                   </div>
                   <span className={`text-lg font-light px-3 py-1 shrink-0 ${opp.arbitrage.spread_percent > 5
                     ? 'bg-[var(--color-accent)]/25 text-[var(--color-accent)]'
                     : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                   }`}>
                     {opp.arbitrage.spread_percent.toFixed(1)}%
                   </span>
                 </div>

                 {/* Quick Preview */}
                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
                     <span className={`${textColor} opacity-60`}>Buy on</span>
                     <div className={`${textColor} font-light capitalize`}>
                       {opp.arbitrage.buy_platform}
                     </div>
                     <div className={`${textColor} text-xs opacity-70`}>
                       @ {(opp.arbitrage.buy_odds * 100).toFixed(1)}%
                     </div>
                   </div>
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
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
                 <div className={`bg-[var(--color-paper-raised)] border-t border-[var(--color-rule)] p-4 space-y-4`}>
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
                         <div className={`font-light text-sm ${opp.defi_metrics.flash_loan_suitable ? 'text-[var(--color-accent)]' : 'text-[var(--color-sealed)]'}`}>
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
                       <div className={`bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 p-3`}>
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
                       <div className={`bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 p-3`}>
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
                       bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] text-[var(--color-ink)] hover:opacity-90`}
                     >
                       ⚡ Execute Arbitrage
                     </button>
                     <a
                       href={`https://polymarket.com/market/${opp.polymarket.id}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`flex-1 px-3 py-2 text-xs font-light text-center transition-all bg-[var(--color-accent)]/15 hover:bg-[var(--color-accent)]/25 text-[var(--color-accent)]`}
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
                       className={`flex-1 px-3 py-2 text-xs font-light text-center transition-all bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30 text-[var(--color-accent)]`}
                     >
                       Trade on Kalshi 📊
                     </button>
                   </div>
                 </div>
               )}
             </div>
           ))}
         </div>
       </GlowList>
     )}

     {/* Medium spread tier */}
     {tieredFiltered.medium.length > 0 && (
       <GlowList
         count={tieredFiltered.medium.length}
         label="opportunity"
         defaultOpen={false}
         emptyLabel="No medium-spread opportunities"
       >
         <div className="mt-2 border-t border-[var(--color-rule)]">
           {tieredFiltered.medium.map((opp, idx) => (
             <div
               key={opp.signal_id || idx}
               className="border-b border-[var(--color-rule)] transition-colors"
             >
               <div
                 className="px-1 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors sm:px-3"
                 onClick={() => setExpandedOppId(expandedOppId === opp.signal_id ? null : opp.signal_id)}
               >
                 <div className="flex items-start justify-between mb-3">
                   <div className="flex-1 min-w-0">
                     <h3 className={`text-base font-light ${textColor} line-clamp-1`}>
                       {opp.market_title}
                     </h3>
                     {opp.venue && (
                       <p className={`text-xs ${textColor} opacity-60 mt-1`}>
                         📍 {opp.venue}
                       </p>
                     )}
                   </div>
                   <span className={`text-lg font-light px-3 py-1 shrink-0 bg-sealed/15 text-sealed`}>
                     {opp.arbitrage.spread_percent.toFixed(1)}%
                   </span>
                 </div>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
                     <span className={`${textColor} opacity-60`}>Buy on</span>
                     <div className={`${textColor} font-light capitalize`}>{opp.arbitrage.buy_platform}</div>
                     <div className={`${textColor} text-xs opacity-70`}>@ {(opp.arbitrage.buy_odds * 100).toFixed(1)}%</div>
                   </div>
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
                     <span className={`${textColor} opacity-60`}>Sell on</span>
                     <div className={`${textColor} font-light capitalize`}>{opp.arbitrage.sell_platform}</div>
                     <div className={`${textColor} text-xs opacity-70`}>@ {(opp.arbitrage.sell_odds * 100).toFixed(1)}%</div>
                   </div>
                 </div>
               </div>

               {expandedOppId === opp.signal_id && (
                 <div className={`bg-[var(--color-paper-raised)] border-t border-[var(--color-rule)] p-4 space-y-4`}>
                   <div>
                     <h4 className={`text-sm font-light ${textColor} mb-3 opacity-80`}>💰 DeFi Metrics</h4>
                     <div className="grid grid-cols-2 gap-3 text-xs">
                       <div>
                         <span className={`${textColor} opacity-60`}>Profit per $1k</span>
                         <div className={`${textColor} font-light text-sm`}>${parseFloat(opp.defi_metrics.estimated_profit_per_1k).toFixed(2)}</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Capital Efficiency</span>
                         <div className={`${textColor} font-light text-sm`}>{opp.defi_metrics.capital_efficiency.toFixed(2)}%</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Liquidity Score</span>
                         <div className={`${textColor} font-light text-sm`}>{opp.defi_metrics.liquidity_score}/100</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Flash Loan Ready</span>
                         <div className={`font-light text-sm ${opp.defi_metrics.flash_loan_suitable ? 'text-[var(--color-accent)]' : 'text-[var(--color-sealed)]'}`}>
                           {opp.defi_metrics.flash_loan_suitable ? '✅ Yes' : '⚠️ Limited'}
                         </div>
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-2 pt-2">
                     <button
                       onClick={() => setSelectedArbitrageOpp(opp)}
                       className={`flex-1 px-3 py-2 text-xs font-semibold text-center bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] text-[var(--color-ink)] hover:opacity-90`}
                     >⚡ Execute Arbitrage</button>
                     <a
                       href={`https://polymarket.com/market/${opp.polymarket.id}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`flex-1 px-3 py-2 text-xs font-light text-center bg-[var(--color-accent)]/15 hover:bg-[var(--color-accent)]/25 text-[var(--color-accent)]`}
                     >View on Polymarket ↗</a>
                   </div>
                 </div>
               )}
             </div>
           ))}
         </div>
       </GlowList>
     )}

     {/* Low spread tier */}
     {tieredFiltered.low.length > 0 && (
       <GlowList
         count={tieredFiltered.low.length}
         label="opportunity"
         defaultOpen={false}
         emptyLabel="No low-spread opportunities"
       >
         <div className="mt-2 border-t border-[var(--color-rule)]">
           {tieredFiltered.low.map((opp, idx) => (
             <div
               key={opp.signal_id || idx}
               className="border-b border-[var(--color-rule)] transition-colors"
             >
               <div
                 className="px-1 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors sm:px-3"
                 onClick={() => setExpandedOppId(expandedOppId === opp.signal_id ? null : opp.signal_id)}
               >
                 <div className="flex items-start justify-between mb-3">
                   <div className="flex-1 min-w-0">
                     <h3 className={`text-base font-light ${textColor} line-clamp-1`}>
                       {opp.market_title}
                     </h3>
                     {opp.venue && (
                       <p className={`text-xs ${textColor} opacity-60 mt-1`}>📍 {opp.venue}</p>
                     )}
                   </div>
                   <span className={`text-lg font-light px-3 py-1 shrink-0 bg-field text-ink-faint shadow-hairline`}>
                     {opp.arbitrage.spread_percent.toFixed(1)}%
                   </span>
                 </div>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
                     <span className={`${textColor} opacity-60`}>Buy on</span>
                     <div className={`${textColor} font-light capitalize`}>{opp.arbitrage.buy_platform}</div>
                     <div className={`${textColor} text-xs opacity-70`}>@ {(opp.arbitrage.buy_odds * 100).toFixed(1)}%</div>
                   </div>
                   <div className={`bg-[var(--color-paper-raised)] p-2`}>
                     <span className={`${textColor} opacity-60`}>Sell on</span>
                     <div className={`${textColor} font-light capitalize`}>{opp.arbitrage.sell_platform}</div>
                     <div className={`${textColor} text-xs opacity-70`}>@ {(opp.arbitrage.sell_odds * 100).toFixed(1)}%</div>
                   </div>
                 </div>
               </div>

               {expandedOppId === opp.signal_id && (
                 <div className={`bg-[var(--color-paper-raised)] border-t border-[var(--color-rule)] p-4 space-y-4`}>
                   <div>
                     <h4 className={`text-sm font-light ${textColor} mb-3 opacity-80`}>💰 DeFi Metrics</h4>
                     <div className="grid grid-cols-2 gap-3 text-xs">
                       <div>
                         <span className={`${textColor} opacity-60`}>Profit per $1k</span>
                         <div className={`${textColor} font-light text-sm`}>${parseFloat(opp.defi_metrics.estimated_profit_per_1k).toFixed(2)}</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Capital Efficiency</span>
                         <div className={`${textColor} font-light text-sm`}>{opp.defi_metrics.capital_efficiency.toFixed(2)}%</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Liquidity Score</span>
                         <div className={`${textColor} font-light text-sm`}>{opp.defi_metrics.liquidity_score}/100</div>
                       </div>
                       <div>
                         <span className={`${textColor} opacity-60`}>Flash Loan Ready</span>
                         <div className={`font-light text-sm ${opp.defi_metrics.flash_loan_suitable ? 'text-[var(--color-accent)]' : 'text-[var(--color-sealed)]'}`}>
                           {opp.defi_metrics.flash_loan_suitable ? '✅ Yes' : '⚠️ Limited'}
                         </div>
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-2 pt-2">
                     <button
                       onClick={() => setSelectedArbitrageOpp(opp)}
                       className={`flex-1 px-3 py-2 text-xs font-semibold text-center bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)] text-[var(--color-ink)] hover:opacity-90`}
                     >⚡ Execute Arbitrage</button>
                     <a
                       href={`https://polymarket.com/market/${opp.polymarket.id}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className={`flex-1 px-3 py-2 text-xs font-light text-center bg-[var(--color-accent)]/15 hover:bg-[var(--color-accent)]/25 text-[var(--color-accent)]`}
                     >View on Polymarket ↗</a>
                   </div>
                 </div>
               )}
             </div>
           ))}
         </div>
       </GlowList>
     )}
   </div>
 )}

 {/* Kalshi Order Panel */}
 {selectedKalshiMarket && (
   <KalshiOrderPanel
     market={selectedKalshiMarket}
     isNight={false}
     onClose={() => setSelectedKalshiMarket(null)}
   />
 )}
 {/* Arbitrage Executor */}
 {selectedArbitrageOpp && (
   <ArbitrageExecutor
     opportunity={selectedArbitrageOpp}
     onClose={() => setSelectedArbitrageOpp(null)}
     isNight={false}
   />
 )}
 </div>
 );
}