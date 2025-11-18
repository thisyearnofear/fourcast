'use client';

import React, { useState, useEffect } from 'react';
import { tradingService } from '@/services/tradingService';
import { ethers } from 'ethers';

export default function OrderForm({
  market,
  walletAddress,
  isConnected,
  onSuccess,
  isNight,
  chainId
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
  const [feeBps, setFeeBps] = useState(null);
  const [feeFormatted, setFeeFormatted] = useState(null);

  useEffect(() => {
    if (isConnected && walletAddress) {
      checkWalletStatus();
    }
  }, [walletAddress, isConnected]);

  useEffect(() => {
    const fetchFee = async () => {
      try {
        const cid = chainId || 56;
        const res = await fetch(`/api/predictions/health?chainId=${cid}`);
        const json = await res.json();
        if (json && json.success) {
          setFeeBps(json.feeBps);
        }
      } catch (_) {}
    };
    fetchFee();
  }, [chainId]);

  const checkWalletStatus = async () => {
    setIsLoading(true);
    const result = await tradingService.checkWalletStatus(walletAddress, chainId);
    if (result.success) {
      setWalletStatus(result.wallet);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const orderCost = tradingService.calculateOrderCost(orderForm.price, orderForm.size);

  useEffect(() => {
    try {
      if (feeBps && orderForm.size) {
        const stakeWei = ethers.parseEther(String(orderForm.size));
        const feeWei = (stakeWei * BigInt(feeBps)) / 10000n;
        setFeeFormatted(ethers.formatEther(feeWei));
      } else {
        setFeeFormatted(null);
      }
    } catch (_) {
      setFeeFormatted(null);
    }
  }, [feeBps, orderForm.size]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const order = {
      marketID: market.marketID,
      price: orderForm.price,
      side: orderForm.side,
      size: orderForm.size,
      walletAddress,
      chainId
    };

    const result = await tradingService.submitOrder(order, walletStatus);
    if (result.success) {
      if (result.mode === 'client_signature_required' && result.txRequest && window?.ethereum) {
        try {
          const desiredChain = chainId || 56;
          const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
          const currentChain = parseInt(currentChainHex, 16);
          if (desiredChain && currentChain !== desiredChain) {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + desiredChain.toString(16) }] });
          }
          const tx = result.txRequest;
          const valueHex = ethers.toBeHex(BigInt(tx.value));
          const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: tx.to, data: tx.data, value: valueHex }]
          });
          onSuccess?.({ success: true, orderID: txHash, order: result.order });
        } catch (sendErr) {
          setError(sendErr?.message || 'Wallet transaction failed');
        }
      } else {
        onSuccess?.(result);
      }
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
  const nativeSymbol = (() => {
    const id = Number(chainId || 56);
    if (id === 42161 || id === 421614) return 'ETH';
    if (id === 137 || id === 80001) return 'MATIC';
    return 'BNB';
  })();
  const isPolygon = Number(chainId) === 137 || Number(chainId) === 80001;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Wallet Status */}
      {walletStatus && (
        <div className={`${bgColor} rounded-lg p-3 border text-xs ${textColor}`}>
          <div className="flex justify-between mb-2">
            <span className="opacity-70">Balance</span>
            <span className="font-light">{walletStatus.balance.formatted} {walletStatus.balance.symbol || nativeSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Status</span>
            <span className={walletStatus.canTrade ? 'text-green-400' : 'text-red-400'}>
              {walletStatus.canTrade ? 'Ready' : 'Insufficient balance'}
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
      {(orderCost || feeFormatted) && (
        <div className={`${bgColor} rounded-lg p-3 border text-xs ${textColor}`}>
          {orderCost && (
            <div className="flex justify-between mb-2">
              <span className="opacity-70">Stake Size</span>
              <span className="font-light">{orderForm.size} {nativeSymbol}</span>
            </div>
          )}
          {typeof feeBps === 'number' && (
            <div className="flex justify-between mb-2">
              <span className="opacity-70">Fee Rate</span>
              <span className="font-light">{feeBps} bps</span>
            </div>
          )}
          {feeFormatted && (
            <div className="flex justify-between">
              <span className="opacity-70">Fee Sent</span>
              <span className="font-light">{feeFormatted} BNB</span>
            </div>
          )}
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
        disabled={isSubmitting || !walletStatus?.canTrade || !orderForm.price || !orderForm.size || isPolygon}
        className={`w-full py-2 rounded-lg text-sm font-light transition-all disabled:opacity-50 ${buttonBgColor} ${textColor}`}
      >
        {isSubmitting ? 'Submitting...' : 'Place Prediction'}
      </button>

      {/* Disclaimer */}
      <div className={`text-xs ${textColor} opacity-40 text-center`}>
        {isPolygon ? 'Polygon ERC20 receipt not yet enabled.' : 'Only the fee is sent on-chain; stake is recorded in the receipt.'}
      </div>
    </form>
  );
}
