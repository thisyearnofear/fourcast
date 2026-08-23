import GlowList from '@/components/ui/GlowList';
import { tierInfoFor, shortAddress } from '@/utils/signalTier';

export default function LeaderboardTab({ leaderboard, textColor, cardBgColor, onProfileClick }) {
 if (!leaderboard || leaderboard.length === 0) {
 return (
 <div className="platform-open-section py-12 text-center">
 <div className="text-6xl mb-4">🏆</div>
 <h3 className={`text-xl font-light ${textColor} mb-2`}>No Ranked Analysts Yet</h3>
 <p className={`${textColor} opacity-60 text-sm`}>
 Be the first to publish high-quality signals and climb the ranks.
 </p>
 </div>
 );
 }

 const top3 = leaderboard.slice(0, 3);
 const rest = leaderboard.slice(3);

 return (
 <div>
 {/* Header — table header strip */}
 <div className="evidence-strip grid grid-cols-4 gap-4 px-1 py-3 text-xs text-center sm:px-3">
 <div className={`${textColor} opacity-60`}>Rank</div>
 <div className={`${textColor} opacity-60 text-left`}>Analyst</div>
 <div className={`${textColor} opacity-60 text-left`}>Stats</div>
 <div className={`${textColor} opacity-60`}>Earnings</div>
 </div>

 {/* Top 3 — always visible */}
 {top3.length > 0 && (
   <div className="border-b border-[var(--color-rule)]">
     {top3.map((user, index) => {
       const tier = tierInfoFor(user.win_rate || 0);
       const earnings = user.total_earnings || 0;
       const rankColor = index === 0 ? 'text-[var(--color-accent)]' : index === 1 ? 'text-sealed' : 'text-[var(--color-sealed)]';
       const tierBadge = index === 0 ? 'bg-accent/15 text-accent' : index === 1 ? 'bg-sealed/15 text-sealed' : 'bg-[var(--color-sealed)]/15 text-[var(--color-sealed)]';

       return (
         <div
           key={user.user_address}
           onClick={() => onProfileClick(user.user_address)}
           className="position-record grid grid-cols-1 gap-4 border-b border-[var(--color-rule)] px-1 py-5 transition-colors hover:bg-white/[0.03] cursor-pointer sm:grid-cols-4 sm:items-center sm:px-3"
         >
           {/* Rank */}
           <div className="flex items-center gap-3">
             <div className={`text-2xl font-thin ${rankColor}`}>
               #{index + 1}
             </div>
             <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tierBadge}`}>
               {tier.emoji} {tier.name}
             </span>
           </div>

           {/* Analyst Info */}
           <div>
             <div className={`text-sm font-light ${textColor}`}>
               {shortAddress(user.user_address)}
             </div>
           </div>

           {/* Stats */}
           <div className="space-y-1">
             <span className={`text-xs px-2 py-0.5 border block w-fit bg-[var(--color-paper-soft)] border-[var(--color-rule-strong)] opacity-70`}>
               {user.total_predictions} Signals
             </span>
             <span className={`text-xs px-2 py-0.5 border block w-fit bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/30`}>
               {(user.win_rate * 100).toFixed(1)}% Win
             </span>
           </div>

           {/* Earnings */}
           <div className="text-right">
             <div className={`text-xl font-light text-[var(--color-accent)]`}>
               {earnings > 0 ? `${earnings} APT` : '—'}
             </div>
           </div>
         </div>
       );
     })}
   </div>
 )}

 {/* Rest — collapsible via GlowList */}
 {rest.length > 0 && (
   <GlowList
     count={rest.length}
     label="analyst"
     defaultOpen={false}
     renderSummary={() => (
       <span className="text-[11px] text-ink-faint">click to expand</span>
     )}
     emptyLabel="No more analysts"
   >
     <div className="mt-2">
       {rest.map((user, index) => {
         const tier = tierInfoFor(user.win_rate || 0);
         const earnings = user.total_earnings || 0;
         const globalIndex = index + 3;

         return (
           <div
             key={user.user_address}
             onClick={() => onProfileClick(user.user_address)}
             className="position-record grid grid-cols-1 gap-4 border-b border-[var(--color-rule)] px-1 py-4 transition-colors hover:bg-white/[0.03] cursor-pointer sm:grid-cols-4 sm:items-center sm:px-3"
           >
             {/* Rank */}
             <div className="flex items-center gap-3">
               <div className={`text-xl font-thin ${textColor} opacity-40`}>
                 #{globalIndex + 1}
               </div>
             </div>

             {/* Analyst Info */}
             <div>
               <div className="flex items-center gap-2 mb-1">
                 <span className="text-base">{tier.emoji}</span>
                 <span className={`text-sm font-light ${textColor}`}>
                   {tier.name}
                 </span>
               </div>
               <div className={`text-xs font-mono ${textColor} opacity-60`}>
                 {shortAddress(user.user_address)}
               </div>
             </div>

             {/* Stats */}
             <div className="space-y-1">
               <span className={`text-xs px-2 py-0.5 border block w-fit bg-[var(--color-paper-soft)] border-[var(--color-rule-strong)] opacity-70`}>
                 {user.total_predictions} Signals
               </span>
               <span className={`text-xs px-2 py-0.5 border block w-fit bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/30`}>
                 {(user.win_rate * 100).toFixed(1)}% Win
               </span>
             </div>

             {/* Earnings */}
             <div className="text-right">
               <div className={`text-lg font-light text-[var(--color-accent)]`}>
                 {earnings > 0 ? `${earnings} APT` : '—'}
               </div>
             </div>
           </div>
         );
       })}
     </div>
   </GlowList>
 )}
 </div>
 );
}