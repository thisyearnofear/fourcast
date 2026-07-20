'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Unified Arbitrage Executor
 *
 * Places both legs of an arbitrage trade with a single click:
 * 1. Buy on the cheaper venue
 * 2. Sell on the more expensive venue
 * 3. Shows real-time execution status for each leg
 */
export default function ArbitrageExecutor({ opportunity, onClose, isNight = false }) {
 const { address } = useAccount();

 const [legs, setLegs] = useState([
 { platform: '', action: '', status: 'pending', txHash: null, error: null },
 { platform: '', action: '', status: 'pending', txHash: null, error: null },
 ]);
 const [overallStatus, setOverallStatus] = useState('idle'); // idle | executing | partial | success | failed

 // Hook stays active for the lifetime of the rendered modal (parent controls
 // visibility by passing / withdrawing `opportunity`).
 const modalRef = useFocusTrap({ isOpen: !!opportunity, onClose });

 if (!opportunity) return null;

 const { polymarket, kalshi, arbitrage } = opportunity;

 const buyPlatform = arbitrage.buy_platform;
 const sellPlatform = arbitrage.sell_platform;
 const buyLeg = buyPlatform === 'polymarket' ? polymarket : kalshi;
 const sellLeg = sellPlatform === 'polymarket' ? polymarket : kalshi;

 const textColor = 'text-white';
 const mutedColor = 'text-white/50';
 const cardBg = 'bg-slate-900 border-white/10';

 const executeAll = useCallback(async () => {
 setOverallStatus('executing');

 // Leg 1: Buy on cheaper venue
 setLegs(prev => {
 const next = [...prev];
 next[0] = { platform: buyPlatform, action: 'buy', status: 'submitting', txHash: null, error: null };
 return next;
 });

 try {
 const buyResponse = await fetch('/api/orders', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 platform: buyPlatform,
 marketId: buyLeg.id || buyLeg.marketID,
 side: 'YES',
 size: 10,
 price: buyPlatform === 'polymarket' ? arbitrage.buy_odds : Math.round(arbitrage.buy_odds * 100),
 type: 'limit',
 userAddress: address,
 }),
 });
 const buyResult = await buyResponse.json();

 setLegs(prev => {
 const next = [...prev];
 next[0] = {
 platform: buyPlatform,
 action: 'buy',
 status: buyResult.success ? 'confirmed' : 'failed',
 txHash: buyResult.txHash || buyResult.orderId || null,
 error: buyResult.success ? null : (buyResult.error || 'Order failed'),
 };
 return next;
 });
 } catch (err) {
 setLegs(prev => {
 const next = [...prev];
 next[0] = { platform: buyPlatform, action: 'buy', status: 'failed', txHash: null, error: err.message };
 return next;
 });
 }

 // Leg 2: Sell on more expensive venue
 setLegs(prev => {
 const next = [...prev];
 next[1] = { platform: sellPlatform, action: 'sell', status: 'submitting', txHash: null, error: null };
 return next;
 });

 try {
 const sellResponse = await fetch('/api/orders', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 platform: sellPlatform,
 marketId: sellLeg.id || sellLeg.marketID,
 side: 'NO',
 size: 10,
 price: sellPlatform === 'polymarket' ? arbitrage.sell_odds : Math.round(arbitrage.sell_odds * 100),
 type: 'limit',
 userAddress: address,
 }),
 });
 const sellResult = await sellResponse.json();

 setLegs(prev => {
 const next = [...prev];
 next[1] = {
 platform: sellPlatform,
 action: 'sell',
 status: sellResult.success ? 'confirmed' : 'failed',
 txHash: sellResult.txHash || sellResult.orderId || null,
 error: sellResult.success ? null : (sellResult.error || 'Order failed'),
 };
 return next;
 });
 } catch (err) {
 setLegs(prev => {
 const next = [...prev];
 next[1] = { platform: sellPlatform, action: 'sell', status: 'failed', txHash: null, error: err.message };
 return next;
 });
 }

 // Determine overall result
 const finalLegs = legs;
 const leg0ok = finalLegs[0]?.status === 'confirmed';
 const leg1ok = finalLegs[1]?.status === 'confirmed';
 if (leg0ok && leg1ok) setOverallStatus('success');
 else if (leg0ok || leg1ok) setOverallStatus('partial');
 else setOverallStatus('failed');
 }, [buyPlatform, sellPlatform, buyLeg, sellLeg, arbitrage, address]);

 return (
 <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
 style={{ background: 'rgba(10,10,15,0.7)', backdropFilter: 'blur(6px)' }}
 onClick={onClose}
 >
 <div
 ref={modalRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="arbitrage-executor-heading"
 className={`relative w-full max-w-2xl overflow-hidden border ${cardBg} shadow-2xl`}
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className={`px-6 py-5 border-b border-white/10`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <span className="text-2xl">⚡</span>
 <div>
 <h2 id="arbitrage-executor-heading" className={`text-lg font-semibold ${textColor}`}>Execute Arbitrage</h2>
 <p className={`text-xs ${mutedColor} mt-0.5`}>
 {(polymarket?.title || kalshi?.title || '').slice(0, 80)}
 </p>
 </div>
 </div>
 <button onClick={onClose} className={`text-sm px-3 py-1.5 bg-white/10 text-white/60 hover:bg-white/20 transition-all`}>
 Close
 </button>
 </div>
 </div>

 {/* Spread Summary */}
 <div className={`px-6 py-4 bg-green-500/5 border-b border-white/5`}>
 <div className="flex items-center justify-between">
 <div>
 <span className={`text-xs font-medium uppercase tracking-wider ${mutedColor}`}>Price Spread</span>
 <div className={`text-2xl font-bold text-green-400`}>
 {arbitrage.spread_percent || '0'}%
 </div>
 </div>
 <div className="text-right">
 <span className={`text-xs font-medium uppercase tracking-wider ${mutedColor}`}>Strategy</span>
 <div className={`text-sm font-medium ${textColor}`}>
 Buy {arbitrage.buy_platform} → Sell {arbitrage.sell_platform}
 </div>
 </div>
 </div>
 {overallStatus === 'success' && (
 <div className={`mt-3 px-3 py-2 text-sm font-medium text-center bg-green-500/20 text-green-400`}>
 ✅ Arbitrage executed successfully — both legs confirmed
 </div>
 )}
 {overallStatus === 'partial' && (
 <div className={`mt-3 px-3 py-2 text-sm font-medium text-center bg-amber-500/20 text-amber-400`}>
 ⚠️ Partial execution — one leg confirmed, one failed
 </div>
 )}
 {overallStatus === 'failed' && (
 <div className={`mt-3 px-3 py-2 text-sm font-medium text-center bg-red-500/20 text-red-400`}>
 ❌ Execution failed — both legs rejected
 </div>
 )}
 </div>

 {/* Legs */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-4 p-6">
 {[
 { leg: legs[0], platform: buyPlatform, action: 'Buy', market: buyLeg, odds: arbitrage.buy_odds },
 { leg: legs[1], platform: sellPlatform, action: 'Sell', market: sellLeg, odds: arbitrage.sell_odds },
 ].map((item, i) => {
 const l = item.leg;
 const isWorking = l?.status === 'submitting';
 const isDone = l?.status === 'confirmed';
 const isErr = l?.status === 'failed';

 return (
 <div key={i} className={`p-4 border bg-white/5 border-white/10`}>
 <div className={`inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-3 ${
 item.action === 'Buy'
 ? 'bg-green-500/20 text-green-400 border border-green-500/30'
 : 'bg-red-500/20 text-red-400 border border-red-500/30'
 }`}>
 Leg {i + 1}: {item.action} on {item.platform}
 </div>
 <p className={`text-sm font-medium ${textColor} line-clamp-2 mb-2`}>
 {item.market?.title || item.market?.question || 'Market'}
 </p>
 <div className="flex items-center gap-3 text-xs mb-3">
 <span className={mutedColor}>Odds: <strong className={textColor}>{(item.odds * 100).toFixed(1)}%</strong></span>
 <span className={mutedColor}>Vol: <strong className={textColor}>${(item.market?.volume_24h || 0).toLocaleString()}</strong></span>
 </div>
 {/* Status indicator */}
 {isWorking && (
 <div className="flex items-center gap-2 text-xs text-blue-400">
 <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
 Submitting order...
 </div>
 )}
 {isDone && (
 <div className="text-xs text-green-400">✅ Confirmed</div>
 )}
 {isErr && (
 <div className="text-xs text-red-400">❌ {l.error?.slice(0, 50) || 'Failed'}</div>
 )}
 {l?.txHash && (
 <div className="text-[10px] mt-1 font-mono text-blue-400/60 truncate">
 TX: {l.txHash.slice(0, 20)}...
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Execute button */}
 <div className={`px-6 pb-6`}>
 {overallStatus === 'idle' && (
 <button
 onClick={executeAll}
 disabled={!address}
 className={`w-full py-3 text-sm font-semibold transition-all ${
 address
 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 shadow-lg'
 : 'bg-white/10 text-white/30 cursor-not-allowed'
 }`}
 >
 {address ? `Execute Arbitrage (${arbitrage.spread_percent || '0'}% spread)` : 'Connect wallet to execute'}
 </button>
 )}
 {overallStatus === 'executing' && (
 <div className={`w-full py-3 text-sm font-semibold text-center bg-blue-500/20 text-blue-400`}>
 <div className="flex items-center justify-center gap-2">
 <div className="w-4 h-4 border-2 border-current/30 border-t-current animate-spin" />
 Executing both legs...
 </div>
 </div>
 )}
 {(overallStatus === 'success' || overallStatus === 'partial' || overallStatus === 'failed') && (
 <button
 onClick={onClose}
 className={`w-full py-3 text-sm font-semibold transition-all ${
 overallStatus === 'success'
 ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
 : 'bg-white/10 text-white/60 hover:bg-white/20'
 }`}
 >
 {overallStatus === 'success' ? '✅ Done — Close' : 'Close'}
 </button>
 )}
 </div>
 </div>
 </div>
 );
}
