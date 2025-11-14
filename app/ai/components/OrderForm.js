'use client';

import React, { useState, useEffect } from 'react';
import { tradingService } from '@/services/tradingService';

export default function OrderForm({
  market,
  walletAddress,
  isConnected,
  onSuccess,
  isNight
}) {
  const [orderForm, setOrderForm] = useState({
    side: 'BUY',
    price: market?.currentOdds?.yes || null,
    size: 1
  });
  const [walletStatus, setWalletStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isConnected && walletAddress) {
      checkWalletStatus();
    }
  }, [walletAddress, isConnected]);

  const checkWalletStatus = async () => {
    setIsLoading(true);
    const result = await tradingService.checkWalletStatus(walletAddress);
    if (result.success) {
      setWalletStatus(result.wallet);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const orderCost = tradingService.calculateOrderCost(orderForm.price, orderForm.size);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const order = {
      marketID: market.marketID,
      price: orderForm.price,
      side: orderForm.side,
      size: orderForm.size,
      walletAddress
    };

    const result = await tradingService.submitOrder(order, walletStatus);
    if (result.success) {
      onSuccess?.(result);
      setOrderForm({ side: 'BUY', price: market?.currentOdds?.yes || null, size: 1 });
    } else {
      setError(result.error);
    }
    setIsSubmitting(false);
  };

  if (!isConnected) {
    return (
      <div className={`text-center py-8 text-sm ${isNight ? 'text-white' : 'text-black'} opacity-60`}>
        Connect your wallet to place orders
      </div>
    );
  }

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20';
  const inputBgColor = isNight ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/20';
  const buttonBgColor = isNight ? 'bg-blue-500/30 hover:bg-blue-500/50' : 'bg-blue-400/30 hover:bg-blue-400/50';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Wallet Status */}
      {walletStatus && (
        <div className={`${bgColor} rounded-lg p-3 border text-xs ${textColor}`}>
          <div className="flex justify-between mb-2">
            <span className="opacity-70">Balance</span>
            <span className="font-light">{walletStatus.balance.formatted} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Status</span>
            <span className={walletStatus.canTrade ? 'text-green-400' : 'text-red-400'}>
              {walletStatus.canTrade ? 'Ready' : 'Approval needed'}
            </span>
          </div>
        </div>
      )}

      {/* Side Selector */}
      <div>
        <label className={`${textColor} text-xs opacity-70 block mb-2`}>Side</label>
        <div className="flex gap-2">
          {['BUY', 'SELL'].map(side => (
            <button
              key={side}
              type="button"
              onClick={() => setOrderForm(prev => ({ ...prev, side }))}
              className={`flex-1 py-2 rounded-lg text-sm font-light transition-all ${
                orderForm.side === side
                  ? side === 'BUY'
                    ? isNight
                      ? 'bg-green-500/50 text-green-100'
                      : 'bg-green-400/50 text-green-900'
                    : isNight
                    ? 'bg-red-500/50 text-red-100'
                    : 'bg-red-400/50 text-red-900'
                  : `${bgColor} border ${textColor} opacity-60`
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      {/* Price Input */}
      <div>
        <label className={`${textColor} text-xs opacity-70 block mb-2`}>
          Price (0.00 - 1.00)
        </label>
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={orderForm.price || ''}
          onChange={e => setOrderForm(prev => ({
            ...prev,
            price: e.target.value ? parseFloat(e.target.value) : null
          }))}
          className={`w-full px-3 py-2 rounded-lg text-sm ${inputBgColor} border ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400`}
          placeholder="0.50"
        />
      </div>

      {/* Size Input */}
      <div>
        <label className={`${textColor} text-xs opacity-70 block mb-2`}>
          Size (tokens)
        </label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={orderForm.size || 1}
          onChange={e => setOrderForm(prev => ({
            ...prev,
            size: e.target.value ? parseFloat(e.target.value) : 1
          }))}
          className={`w-full px-3 py-2 rounded-lg text-sm ${inputBgColor} border ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400`}
          placeholder="1"
        />
      </div>

      {/* Cost Summary */}
      {orderCost && (
        <div className={`${bgColor} rounded-lg p-3 border text-xs ${textColor}`}>
          <div className="flex justify-between">
            <span className="opacity-70">Total Cost</span>
            <span className="font-light">{orderCost.total} USDC</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
          <p className={`text-xs ${textColor} opacity-90`}>{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !walletStatus?.canTrade || !orderForm.price || !orderForm.size}
        className={`w-full py-2 rounded-lg text-sm font-light transition-all disabled:opacity-50 ${buttonBgColor} ${textColor}`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Order'}
      </button>

      {/* Disclaimer */}
      <div className={`text-xs ${textColor} opacity-40 text-center`}>
        Trades are final. Always verify amounts before confirming.
      </div>
    </form>
  );
}
