'use client';

import { useState, useEffect } from 'react';
import useKalshiAuth from '@/hooks/useKalshiAuth';
import KalshiLoginModal from './KalshiLoginModal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export default function KalshiOrderPanel({ market, isNight, onClose, embedded = false }) {
 const { token, isAuthenticated, checkAuth } = useKalshiAuth();
 const [showLogin, setShowLogin] = useState(false);
 // Focus trap is active only when this component is the top-level modal
 // (standalone). When embedded inside ArbitrageExecutionPanel, the parent
 // owns the trap and ARIA so we don't compete with it.
 const modalRef = useFocusTrap({ isOpen: !embedded, onClose });
 const [balance, setBalance] = useState(null);
 const [orderSide, setOrderSide] = useState('yes');
 const [orderType, setOrderType] = useState('limit');
 const [contracts, setContracts] = useState(10);
 const [limitPrice, setLimitPrice] = useState(
 Math.round((market.currentOdds?.yes || market.odds_yes || 0.5) * 100)
 );
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [orderResult, setOrderResult] = useState(null);

 // Glass CSS classes (DRY)
 const glassPanel = 'mc-panel';
 const textColor = 'text-[var(--color-ink)]';
 const borderColor = 'border-[var(--color-rule)]';
 const glassInput = 'mc-input';
 const inputBg = 'bg-[var(--color-paper-raised)]';

 const yesOdds = market.currentOdds?.yes || market.odds_yes || 0.5;
 const noOdds = 1 - yesOdds;
 const priceCents = orderType === 'limit' ? limitPrice : Math.round(yesOdds * 100);
 const estimatedCost = contracts * priceCents;
 const potentialProfit = contracts * (100 - priceCents);

 const fetchBalance = async () => {
 try {
 const response = await fetch('/api/kalshi/balance', {
 headers: { Authorization: `Bearer ${token}` }
 });
 if (response.ok) {
 const data = await response.json();
 setBalance(data.balance);
 }
 } catch (err) {
 console.error('Failed to fetch balance:', err);
 }
 };

 const handleSubmitOrder = async () => {
 setIsSubmitting(true);
 setOrderResult(null);
 try {
 const response = await fetch('/api/kalshi/order', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`
 },
 body: JSON.stringify({
 ticker: market.ticker,
 side: orderSide,
 type: orderType,
 contracts,
 price: orderType === 'limit' ? limitPrice : undefined
 })
 });
 const data = await response.json();
 setOrderResult(data);
 if (data.success) {
 fetchBalance();
 }
 } catch (err) {
 setOrderResult({ success: false, message: 'Order failed: ' + err.message });
 } finally {
 setIsSubmitting(false);
 }
 };

 useEffect(() => {
 if (isAuthenticated && checkAuth()) {
 fetchBalance();
 }
 }, [isAuthenticated]);

 const content = (
 <div
 ref={!embedded ? modalRef : undefined}
 role={!embedded ? 'dialog' : undefined}
 aria-modal={!embedded ? 'true' : undefined}
 aria-labelledby={!embedded ? 'kalshi-order-heading' : undefined}
 className={`${embedded ? 'h-full flex flex-col' : `${glassPanel} max-w-lg w-full p-8 shadow-2xl my-8`}`}
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header (Hide close button if embedded) */}
 {!embedded && (
 <div className="flex items-start justify-between mb-6">
 <div className="flex-1 pr-4">
 <h2 id="kalshi-order-heading" className={`text-2xl font-light ${textColor} mb-1 line-clamp-2`}>
 {market.title || market.market_title}
 </h2>
 <p className={`text-sm ${textColor} opacity-60`}>Kalshi Market Trading</p>
 </div>
 <button
 onClick={onClose}
 className={`text-2xl ${textColor} opacity-50 hover:opacity-75 flex-shrink-0`}
 >
 ×
 </button>
 </div>
 )}

 {/* Balance Display */}
 {isAuthenticated && balance !== null && (
 <div className={`${glassInput} p-4 mb-6`}>
 <div className={`text-sm ${textColor} opacity-70 mb-1`}>Available Balance</div>
 <div className={`text-2xl font-light ${textColor}`}>${(balance / 100).toFixed(2)}</div>
 </div>
 )}

 {/* Order Form */}
 <div className={`space-y-4 ${embedded ? 'flex-1 overflow-y-auto custom-scrollbar' : 'mb-6'}`}>
 {/* Side Selection */}
 <div>
 <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Position</label>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => setOrderSide('yes')}
 className={`px-4 py-3 transition-all border ${orderSide === 'yes'
 ? 'bg-[var(--color-accent)]/30 border-[var(--color-accent)] text-[var(--color-accent)]'
 : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
 }`}
 >
 <div className="font-light">Yes</div>
 <div className="text-sm opacity-70">{(yesOdds * 100).toFixed(1)}¢</div>
 </button>
 <button
 onClick={() => setOrderSide('no')}
 className={`px-4 py-3 transition-all border ${orderSide === 'no'
 ? 'bg-[var(--color-breach)]/30 border-[var(--color-breach)] text-[var(--color-breach)]'
 : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
 }`}
 >
 <div className="font-light">No</div>
 <div className="text-sm opacity-70">{(noOdds * 100).toFixed(1)}¢</div>
 </button>
 </div>
 </div>

 {/* Order Type */}
 <div>
 <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Order Type</label>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => setOrderType('limit')}
 className={`px-4 py-3 transition-all border ${orderType === 'limit'
 ? 'bg-[var(--color-evidence)]/30 border-[var(--color-evidence)] text-[var(--color-evidence)]'
 : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
 }`}
 >
 Limit Order
 </button>
 <button
 onClick={() => setOrderType('market')}
 className={`px-4 py-3 transition-all border ${orderType === 'market'
 ? 'bg-[var(--color-evidence)]/30 border-[var(--color-evidence)] text-[var(--color-evidence)]'
 : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
 }`}
 >
 Market Order
 </button>
 </div>
 </div>

 {/* Number of Contracts */}
 <div>
 <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Number of Contracts</label>
 <input
 type="number"
 min="1"
 value={contracts}
 onChange={(e) => setContracts(parseInt(e.target.value) || 1)}
 className={`w-full px-4 py-3 ${inputBg} border ${borderColor} ${textColor} focus:border-[var(--color-accent)] outline-none transition-colors`}
 />
 </div>

 {/* Limit Price (only for limit orders) */}
 {orderType === 'limit' && (
 <div>
 <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Limit Price (cents)</label>
 <input
 type="number"
 min="1"
 max="99"
 value={limitPrice}
 onChange={(e) => setLimitPrice(parseInt(e.target.value) || 1)}
 className={`w-full px-4 py-3 ${inputBg} border ${borderColor} ${textColor} focus:border-[var(--color-accent)] outline-none transition-colors`}
 />
 </div>
 )}

 {/* Order Summary */}
 <div className={`bg-[var(--color-paper-raised)] p-4 space-y-2`}>
 <div className="flex justify-between text-sm">
 <span className={`${textColor} opacity-70`}>Estimated Cost</span>
 <span className={`font-light ${textColor}`}>${(estimatedCost / 100).toFixed(2)}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className={`${textColor} opacity-70`}>Potential Profit</span>
 <span className="font-light text-[var(--color-accent)]">${(potentialProfit / 100).toFixed(2)}</span>
 </div>
 </div>
 </div>

 {/* Order Result */}
 {orderResult && (
 <div
 className={`mb-4 px-4 py-3 text-sm ${orderResult.success
 ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
 : 'bg-[var(--color-breach)]/20 text-[var(--color-breach)] border border-[var(--color-breach)]/30'
 }`}
 >
 {orderResult.message}
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex gap-3 pt-2 mt-auto">
 {!embedded && (
 <button
 onClick={onClose}
 disabled={isSubmitting}
 className={`flex-1 px-4 py-3 font-light text-sm transition-all border bg-[var(--color-paper-raised)] hover:bg-[var(--color-paper-soft)] border-[var(--color-rule)] text-[var(--color-ink-muted)] disabled:opacity-50`}
 >
 Cancel
 </button>
 )}
 <button
 onClick={handleSubmitOrder}
 disabled={isSubmitting || (balance !== null && estimatedCost > balance)}
 className={`flex-1 px-4 py-3 font-light text-sm transition-all border bg-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/40 border-[var(--color-accent)]/30 text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed`}
 >
 {isSubmitting ? (
 <span className="flex items-center justify-center gap-2">
 <span className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin"></span>
 Placing...
 </span>
 ) : isAuthenticated ? (
 balance !== null && estimatedCost > balance ? 'Insufficient Balance' : 'Place Order'
 ) : (
 'Connect & Trade'
 )}
 </button>
 </div>

 {!isAuthenticated && (
 <p className={`text-xs ${textColor} opacity-50 mt-4 text-center`}>
 You'll be prompted to connect your Kalshi account
 </p>
 )}
 </div>
 );

 if (embedded) {
 return (
 <>
 {content}
 <KalshiLoginModal
 isOpen={showLogin}
 onClose={() => setShowLogin(false)}
 onSuccess={() => {
 setShowLogin(false);
 fetchBalance();
 }}
 isNight={isNight}
 />
 </>
 );
 }

 return (
 <>
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
 {content}
 </div>

 <KalshiLoginModal
 isOpen={showLogin}
 onClose={() => setShowLogin(false)}
 onSuccess={() => {
 setShowLogin(false);
 fetchBalance();
 }}
 isNight={isNight}
 />
 </>
 );
}
