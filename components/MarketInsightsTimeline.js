'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

/**
 * Market Insights Timeline
 * 
 * Shows user's prediction history with market resolutions
 * "You said YES on Feb 1st, you were right! ✓"
 * "You said NO, market went YES, but excellent reasoning 👌"
 * 
 * Builds confidence through retroactive validation
 */
export function MarketInsightsTimeline({ userAddress, isNight = true }) {
 const { address: connectedAddress } = useAccount();
 const displayAddress = userAddress || connectedAddress;

 const [history, setHistory] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [filter, setFilter] = useState('all'); // 'all', 'wins', 'losses', 'pending'

 useEffect(() => {
 if (!displayAddress) {
 setLoading(false);
 return;
 }

 const fetchHistory = async () => {
 try {
 const response = await fetch(
 `/api/stats?address=${displayAddress}&includeHistory=true`
 );
 const result = await response.json();

 if (result.success && result.stats.predictionHistory) {
 setHistory(result.stats.predictionHistory);
 setError(null);
 } else {
 setError('No prediction history found');
 }
 } catch (err) {
 console.error('Failed to fetch history:', err);
 setError('Unable to load prediction history');
 } finally {
 setLoading(false);
 }
 };

 fetchHistory();
 }, [displayAddress]);

 const bgColor = 'bg-[var(--color-paper-raised)]';
 const borderColor = 'border-[var(--color-rule)]';
 const textColor = 'text-[var(--color-ink)]';

 const filteredHistory = history.filter(pred => {
 if (filter === 'wins') return pred.outcome === 'WIN';
 if (filter === 'losses') return pred.outcome === 'LOSS';
 if (filter === 'pending') return pred.outcome === 'PENDING';
 return true;
 });

 if (loading) {
 return <TimelineSkeleton isNight={isNight} />;
 }

 if (error || history.length === 0) {
 return (
 <div className={`${bgColor} border ${borderColor} p-8 text-center`}>
 <p className={`text-lg ${textColor} opacity-60`}>📊 No predictions yet</p>
 <p className={`text-sm ${textColor} opacity-40 mt-2`}>
 Make your first prediction to see your forecast history here
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Filter Tabs */}
 <div className="flex gap-2 overflow-x-auto pb-2">
 {['all', 'wins', 'losses', 'pending'].map((f) => (
 <button
 key={f}
 onClick={() => setFilter(f)}
 className={`px-4 py-2 text-sm font-light whitespace-nowrap transition-all ${
 filter === f
 ? 'bg-[var(--color-evidence)]/30 border-[var(--color-evidence)] text-[var(--color-evidence)]'
 : 'mc-panel text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-soft)]'
 } border`}
 >
 {f === 'all' && `All (${history.length})`}
 {f === 'wins' && `✓ Wins (${history.filter(p => p.outcome === 'WIN').length})`}
 {f === 'losses' && `✗ Losses (${history.filter(p => p.outcome === 'LOSS').length})`}
 {f === 'pending' && `⏳ Pending (${history.filter(p => p.outcome === 'PENDING').length})`}
 </button>
 ))}
 </div>
 {/* Timeline */}
 <div className="space-y-4">
 {filteredHistory.map((prediction, idx) => (
 <PredictionCard
 key={prediction.id || idx}
 prediction={prediction}
 isNight={isNight}
 />
 ))}
 </div>
 </div>
 );
}

/**
 * Individual prediction card in timeline
 */
function PredictionCard({ prediction, isNight }) {
 const textColor = 'text-[var(--color-ink)]';
 const bgColor = 'bg-[var(--color-paper-raised)]';
 const borderColor = 'border-[var(--color-rule)]';

 const isWin = prediction.outcome === 'WIN';
 const isPending = prediction.outcome === 'PENDING';
 const isLoss = prediction.outcome === 'LOSS';

 const cardBg = isWin
 ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
 : isLoss
 ? 'bg-[var(--color-breach)]/10 border-[var(--color-breach)]/30'
 : 'bg-[var(--color-sealed)]/10 border-[var(--color-sealed)]/30';

 const statusEmoji = isWin ? '✓' : isLoss ? '✗' : '⏳';
 const statusText = isWin ? 'You were right!' : isLoss ? 'Incorrect, but data-driven' : 'Waiting for resolution';

 const predictionDate = new Date(prediction.timestamp * 1000);
 const resolutionDate = prediction.resolvedAt 
 ? new Date(prediction.resolvedAt * 1000)
 : null;
 const daysAgo = Math.floor((Date.now() - predictionDate.getTime()) / (1000 * 60 * 60 * 24));

 return (
 <div className={`${cardBg} border p-4 space-y-3 transition-all hover:border-opacity-100`}>
 {/* Header: Status + Time */}
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3 flex-1">
 <span className="text-2xl mt-0.5">{statusEmoji}</span>
 <div className="flex-1">
 <p className={`text-sm font-light ${textColor}`}>
 {prediction.marketTitle}
 </p>
 {prediction.venue && (
 <p className={`text-xs ${textColor} opacity-60`}>
 📍 {prediction.venue}
 </p>
 )}
 </div>
 </div>
 <div className="text-right">
 <p className={`text-xs ${textColor} opacity-60`}>
 {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
 </p>
 <p className={`text-xs ${textColor} opacity-40 font-light`}>
 {predictionDate.toLocaleDateString()}
 </p>
 </div>
 </div>
 {/* Prediction Details */}
 <div className="flex items-center gap-4">
 <div className={`px-3 py-1 text-xs font-light ${
 prediction.confidence === 'very-high' ? 'bg-[var(--color-accent)]/30 text-[var(--color-accent)]' :
 prediction.confidence === 'high' ? 'bg-[var(--color-evidence)]/30 text-[var(--color-evidence)]' :
 prediction.confidence === 'medium' ? 'bg-[var(--color-sealed)]/30 text-[var(--color-sealed)]' :
 'bg-[var(--color-paper-soft)] text-[var(--color-ink-muted)]'
 }`}>
 {prediction.confidence || 'Moderate'} Confidence
 </div>

 {prediction.resolvedAt && (
 <p className={`text-xs ${textColor} opacity-60`}>
 Resolved {new Date(prediction.resolvedAt * 1000).toLocaleDateString()}
 </p>
 )}
 </div>
 {/* Reasoning */}
 {prediction.reasoning && (
 <div className={`bg-[var(--color-paper-raised)] p-3`}>
 <p className={`text-xs ${textColor} opacity-75 font-light leading-relaxed`}>
 {prediction.reasoning}
 </p>
 </div>
 )}
 {/* Status Message */}
 <div className={`text-sm font-light ${textColor}`}>
 {isWin && (
 <p>✅ {statusText} Your analysis was spot on.</p>
 )}
 {isLoss && (
 <p>💡 {statusText} Your reasoning was sound, even though the outcome differed.</p>
 )}
 {isPending && (
 <p>⏳ {statusText} Check back when the market resolves.</p>
 )}
 </div>
 {/* Share Button (if resolved win) */}
 {isWin && (
 <button className={`text-xs font-light px-3 py-1.5 transition-all bg-[var(--color-evidence)]/20 hover:bg-[var(--color-evidence)]/30 text-[var(--color-evidence)] border border-[var(--color-evidence)]/30`}>
 🔗 Share this win
 </button>
 )}
 </div>
 );
}

/**
 * Loading skeleton
 */
function TimelineSkeleton({ isNight }) {
 return (
 <div className="space-y-4">
 <div className="flex gap-2 pb-2">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="h-10 w-20 bg-[var(--color-paper-soft)] animate-pulse"></div>
 ))}
 </div>
 {[...Array(3)].map((_, i) => (
 <div key={i} className="h-32 bg-[var(--color-paper-raised)] animate-pulse"></div>
 ))}
 </div>
 );
}
