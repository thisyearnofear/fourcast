import { ConfidenceBadge, EfficiencyBadge } from './SignalBadges';
import { ARC_EXPLORER_TX } from '@/constants/appConstants';
import { PersonalStatsDashboard } from '@/components/PersonalStatsDashboard';
import { MarketInsightsTimeline } from '@/components/MarketInsightsTimeline';
import { SignalTrace } from '@/components/ui/SignalTrace';
import EvidenceBlock from '@/components/EvidenceBlock';
import GlowList from '@/components/ui/GlowList';

export default function MySignalsTab({ signals, isLoading, textColor, cardBgColor, expandedSignalId, setExpandedSignalId, formatTimestamp, userAddress, calibrationScore, agentBrierScore }) {
 if (isLoading) {
 return (
 <div className="flex items-center justify-center py-12">
 <div className={`w-6 h-6 border-2 border-white/30 border-t-white animate-spin`}></div>
 <span className={`ml-3 ${textColor} opacity-70`}>Loading your signals...</span>
 </div>
 );
 }

 if (!signals || signals.length === 0) {
 return (
 <div className="platform-open-section py-12 text-center">
 <div className="text-6xl mb-4">🎯</div>
 <h3 className={`text-xl font-light ${textColor} mb-2`}>No Predictions Yet</h3>
 <p className={`${textColor} opacity-60 text-sm`}>
 Head to Markets, analyze an event, and make your first call — start building your verifiable track record
 </p>
 </div>
 );
 }

 const won = signals.filter(s => s.outcome === 'YES' || s.outcome === 'CORRECT').length;
 const lost = signals.filter(s => s.outcome === 'NO' || s.outcome === 'INCORRECT').length;
 const pending = signals.filter(s => s.outcome === 'PENDING' || !s.outcome).length;
 const winRate = (won + lost) > 0 ? ((won / (won + lost)) * 100).toFixed(1) : 'N/A';

 const renderChips = () => {
   const chips = [];
   if (winRate !== 'N/A') {
     chips.push(<span key="wr" className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent border border-accent/30">{winRate}% win</span>);
   }
   if (pending > 0) {
     chips.push(<span key="pnd" className="inline-flex items-center rounded-full bg-sealed/15 px-2 py-0.5 text-[10px] font-medium text-sealed border border-sealed/30">{pending} pending</span>);
   }
   return chips;
 };

 return (
 <div className="space-y-10">
 {/* Comprehensive Stats Dashboard */}
 {userAddress ? (
 <PersonalStatsDashboard
   userAddress={userAddress}
   isNight={false}
   compact={false}
 />
 ) : (
 <>
 {/* Fallback: Basic stats — evidence strip */}
 <div className="evidence-strip grid grid-cols-2 gap-px bg-[var(--color-paper-soft)] sm:grid-cols-4">
 <div className="bg-[var(--color-paper)] p-4">
   <div className={`text-3xl font-light ${textColor} mb-1`}>{signals.length}</div>
   <div className={`text-xs ${textColor} opacity-60`}>Total Published</div>
 </div>
 <div className="bg-[var(--color-paper)] p-4">
   <div className={`text-3xl font-light text-[var(--color-accent)] mb-1`}>{won}</div>
   <div className={`text-xs ${textColor} opacity-60`}>Won</div>
 </div>
 <div className="bg-[var(--color-paper)] p-4">
   <div className={`text-3xl font-light text-[var(--color-breach)] mb-1`}>{lost}</div>
   <div className={`text-xs ${textColor} opacity-60`}>Lost</div>
 </div>
 <div className="bg-[var(--color-paper)] p-4">
   <div className={`text-3xl font-light ${textColor} mb-1`}>{pending}</div>
   <div className={`text-xs ${textColor} opacity-60`}>Pending</div>
 </div>
 </div>

 {/* Win Rate — open section */}
 {winRate !== 'N/A' && (
   <div className="platform-open-section">
     <div className="flex items-end gap-4">
       <div>
         <div className={`text-xs ${textColor} opacity-60 mb-2 uppercase tracking-wider`}>Win Rate</div>
         <div className={`text-4xl font-light text-[var(--color-accent)]`}>
           {winRate}%
         </div>
       </div>
       <div className={`flex-1 h-2 bg-[var(--color-paper-soft)]`}>
         <div
           className={`h-full bg-[var(--color-accent)]`}
           style={{ width: `${parseFloat(winRate)}%` }}
         ></div>
       </div>
     </div>
   </div>
 )}
 </>
 )}
 {/* Market Insights Timeline */}
 {userAddress && (
   <div className="space-y-4">
     <h3 className={`text-lg font-light ${textColor}`}>Prediction History</h3>
     <MarketInsightsTimeline
       userAddress={userAddress}
       isNight={false}
     />
   </div>
 )}

 {/* Signals List — GlowList with trace */}
 <GlowList
   count={signals.length}
   label="signal"
   defaultOpen={false}
   renderSummary={renderChips}
   emptyLabel="No signals match your filters"
 >
   <div className="mt-2 border-t border-[var(--color-rule)]">
     {signals.map((signal) => {
       const isExpanded = expandedSignalId === signal.id;
       const statusColor = signal.outcome === 'YES' || signal.outcome === 'CORRECT'
         ? 'text-[var(--color-accent)]'
         : signal.outcome === 'NO' || signal.outcome === 'INCORRECT'
         ? 'text-[var(--color-breach)]'
         : 'text-[var(--color-sealed)]';

       return (
         <div
           key={signal.id}
           className={`position-record border-b border-[var(--color-rule)] px-1 py-4 cursor-pointer transition-colors hover:bg-white/[0.03] sm:px-3 ${isExpanded ? 'bg-white/[0.02]' : ''}`}
           onClick={() => setExpandedSignalId(isExpanded ? null : signal.id)}
         >
           <div className="flex items-start justify-between mb-2">
             <div className="flex-1 min-w-0">
               <h3 className={`text-base font-light ${textColor} mb-1 truncate`}>
                 {signal.market_title || signal.event_id}
               </h3>
               {signal.venue && (
                 <p className={`text-xs ${textColor} opacity-60`}>📍 {signal.venue}</p>
               )}
             </div>
             <div className="text-right flex-shrink-0 ml-3">
               <div className={`text-xl font-light ${statusColor}`}>
                 {signal.outcome === 'PENDING' || !signal.outcome ? '⏳' : signal.outcome === 'YES' || signal.outcome === 'CORRECT' ? '✓' : '✗'}
               </div>
             </div>
           </div>

           <div className="flex flex-wrap items-center gap-2 mb-2">
             <ConfidenceBadge confidence={signal.confidence} isNight={false} />
             {signal.odds_efficiency && (
               <EfficiencyBadge efficiency={signal.odds_efficiency} isNight={false} />
             )}
             <span className={`text-xs ${textColor} opacity-50`}>
               {formatTimestamp(signal.timestamp)}
             </span>
           </div>

           {/* SignalTrace — verdict + reasoning */}
           <SignalTrace signal={signal} />
         </div>
       );
     })}
   </div>
 </GlowList>
 </div>
 );
}