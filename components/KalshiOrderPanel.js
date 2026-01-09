'use client';

import { useState, useEffect } from 'react';
import useKalshiAuth from '@/hooks/useKalshiAuth';
import KalshiLoginModal from './KalshiLoginModal';

export default function KalshiOrderPanel({ market, isNight, onClose }) {
    const { token, isAuthenticated, checkAuth } = useKalshiAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [balance, setBalance] = useState(null);
    const [orderSide, setOrderSide] = useState('yes');
    const [orderType, setOrderType] = useState('limit');
    const [contracts, setContracts] = useState(10);
    const [limitPrice, setLimitPrice] = useState(
        Math.round((market.currentOdds?.yes || market.odds_yes || 0.5) * 100)
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderResult, setOrderResult] = useState(null);

    const bgColor = isNight ? 'bg-black/40' : 'bg-white/40';
    const textColor = isNight ? 'text-white' : 'text-black';
    const borderColor = isNight ? 'border-white/10' : 'border-black/10';
    const inputBg = isNight ? 'bg-white/5' : 'bg-black/5';

    useEffect(() => {
        if (isAuthenticated && checkAuth()) {
            fetchBalance();
        }
    }, [isAuthenticated]);

    const fetchBalance = async () => {
        try {
            const validToken = checkAuth() ? token : null;
            if (!validToken) return;

            const response = await fetch(`/api/kalshi/balance?token=${validToken}`);
            const data = await response.json();

            if (data.success) {
                setBalance(data.data.balance);
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    };

    const handleSubmitOrder = async () => {
        if (!isAuthenticated || !checkAuth()) {
            setShowLogin(true);
            return;
        }

        setIsSubmitting(true);
        setOrderResult(null);

        try {
            const order = {
                ticker: market.marketID || market.id,
                action: 'buy',
                side: orderSide,
                count: contracts,
                type: orderType,
                ...(orderType === 'limit' && { yes_price: limitPrice })
            };

            const response = await fetch('/api/kalshi/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, order })
            });

            const data = await response.json();

            if (data.success) {
                setOrderResult({
                    success: true,
                    message: `Order placed successfully!${data.data.order_id ? ` Order ID: ${data.data.order_id}` : ''}`
                });
                fetchBalance(); // Refresh balance
            } else {
                setOrderResult({
                    success: false,
                    message: data.error || 'Order failed'
                });
            }
        } catch (error) {
            setOrderResult({
                success: false,
                message: 'Connection error. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const yesOdds = market.currentOdds?.yes || market.odds_yes || 0.5;
    const noOdds = market.currentOdds?.no || market.odds_no || 0.5;

    const estimatedCost = orderType === 'market'
        ? contracts * (orderSide === 'yes' ? yesOdds : noOdds) * 100
        : contracts * limitPrice;

    const potentialProfit = contracts * 100 - estimatedCost;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
                <div
                    className={`${bgColor} backdrop-blur-xl border ${borderColor} rounded-2xl max-w-lg w-full p-8 shadow-2xl my-8`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1 pr-4">
                            <h2 className={`text-2xl font-light ${textColor} mb-1 line-clamp-2`}>
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

                    {/* Balance Display */}
                    {isAuthenticated && balance !== null && (
                        <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-xl p-4 mb-6`}>
                            <div className={`text-sm ${textColor} opacity-70 mb-1`}>Available Balance</div>
                            <div className={`text-2xl font-light ${textColor}`}>${(balance / 100).toFixed(2)}</div>
                        </div>
                    )}

                    {/* Order Form */}
                    <div className="space-y-4 mb-6">
                        {/* Side Selection */}
                        <div>
                            <label className={`block text-xs ${textColor} opacity-70 mb-2`}>Position</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setOrderSide('yes')}
                                    className={`px-4 py-3 rounded-xl transition-all border ${orderSide === 'yes'
                                            ? 'bg-green-500/30 border-green-400 text-green-100'
                                            : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
                                        }`}
                                >
                                    <div className="font-light">Yes</div>
                                    <div className="text-sm opacity-70">{(yesOdds * 100).toFixed(1)}¢</div>
                                </button>
                                <button
                                    onClick={() => setOrderSide('no')}
                                    className={`px-4 py-3 rounded-xl transition-all border ${orderSide === 'no'
                                            ? 'bg-red-500/30 border-red-400 text-red-100'
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
                                    className={`px-4 py-3 rounded-xl transition-all border ${orderType === 'limit'
                                            ? isNight
                                                ? 'bg-blue-500/30 border-blue-400 text-blue-100'
                                                : 'bg-blue-400/30 border-blue-500 text-blue-900'
                                            : `${inputBg} border-transparent hover:bg-opacity-70 ${textColor}`
                                        }`}
                                >
                                    Limit Order
                                </button>
                                <button
                                    onClick={() => setOrderType('market')}
                                    className={`px-4 py-3 rounded-xl transition-all border ${orderType === 'market'
                                            ? isNight
                                                ? 'bg-blue-500/30 border-blue-400 text-blue-100'
                                                : 'bg-blue-400/30 border-blue-500 text-blue-900'
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
                                className={`w-full px-4 py-3 rounded-xl ${inputBg} border ${borderColor} ${textColor} focus:border-emerald-500 outline-none transition-colors`}
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
                                    className={`w-full px-4 py-3 rounded-xl ${inputBg} border ${borderColor} ${textColor} focus:border-emerald-500 outline-none transition-colors`}
                                />
                            </div>
                        )}

                        {/* Order Summary */}
                        <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-xl p-4 space-y-2`}>
                            <div className="flex justify-between text-sm">
                                <span className={`${textColor} opacity-70`}>Estimated Cost</span>
                                <span className={`font-light ${textColor}`}>${(estimatedCost / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className={`${textColor} opacity-70`}>Potential Profit</span>
                                <span className="font-light text-green-400">${(potentialProfit / 100).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Order Result */}
                    {orderResult && (
                        <div
                            className={`mb-4 px-4 py-3 rounded-xl text-sm ${orderResult.success
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                        >
                            {orderResult.message}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-3 rounded-lg font-light text-sm transition-all border ${isNight
                                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black/70'
                                } disabled:opacity-50`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmitOrder}
                            disabled={isSubmitting || (balance !== null && estimatedCost > balance)}
                            className={`flex-1 px-4 py-3 rounded-lg font-light text-sm transition-all border ${isNight
                                    ? 'bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-400/30 text-emerald-200'
                                    : 'bg-emerald-400/30 hover:bg-emerald-400/40 border-emerald-500/30 text-emerald-900'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
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
