'use client';

import { useState, useEffect } from 'react';
import { useOrderSigning } from '@/hooks/useOrderSigning';
import { ConnectKitButton } from 'connectkit';
import { useBalance, useAccount } from 'wagmi';

// Polygon USDC Address
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

/**
 * OrderSigningPanel - Inline order signing UI
 * 
 * Integrated into market analysis view
 * User can:
 * 1. Enter order parameters (size, price, side)
 * 2. Connect MetaMask (if not connected)
 * 3. Sign order in MetaMask
 * 4. Submit to server (server adds builder attribution)
 */
export function OrderSigningPanel({ market, onClose, isNight, onSuccess }) {
  // Order parameters
  const [side, setSide] = useState('YES');
  const [price, setPrice] = useState('0.50');
  const [size, setSize] = useState('');

  // UI state
  const [step, setStep] = useState('input'); // 'input' | 'review' | 'signing' | 'submitted'
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Hook for order signing
  const {
    submitOrderFlow,
    error,
    success,
    isConnected,
    address,
  } = useOrderSigning();

  // Fetch real user balance (USDC on Polygon)
  const { data: balanceData } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    chainId: 137, // Polygon Mainnet
    watch: true, // Refresh on blocks
  });

  const userBalance = balanceData ? parseFloat(balanceData.formatted) : 0;
  const balanceSymbol = balanceData?.symbol || 'USDC';

  // Calculate estimated cost
  useEffect(() => {
    if (size && price) {
      setEstimatedCost(parseFloat(size) * parseFloat(price));
    }
  }, [size, price]);

  // Handle successful submission
  useEffect(() => {
    if (success) {
      setStep('submitted');
      setTimeout(() => {
        if (onSuccess) onSuccess(success);
        onClose();
      }, 2000);
    }
  }, [success, onClose, onSuccess]);

  const handleSubmitOrder = async () => {
    if (!size || !price) {
      alert('Please enter size and price');
      return;
    }

    if (estimatedCost > userBalance) {
      alert(`Insufficient balance. Need ${estimatedCost.toFixed(2)} ${balanceSymbol}, have ${userBalance.toFixed(2)} ${balanceSymbol}`);
      return;
    }

    // Resolve Token ID for the selected outcome
    // Assuming clobTokenIds is [YES_ID, NO_ID] or [NO_ID, YES_ID]
    // Polymarket convention: outcomePrices[0] = YES, outcomePrices[1] = NO
    // So clobTokenIds[0] = YES Token, clobTokenIds[1] = NO Token (usually)
    // We'll rely on index 0 = Yes, index 1 = No as per polymarketService mapping
    const clobTokenIds = market.rawMarket?.clobTokenIds || market.clobTokenIds;
    
    if (!clobTokenIds || clobTokenIds.length < 2) {
      // Fallback: Try to use marketID if it looks like a token ID (unlikely to work for binary)
      console.warn("Missing clobTokenIds, order might fail");
    }
    
    // Select token ID based on side (YES/NO)
    const tokenID = side === 'YES' 
      ? clobTokenIds?.[0] 
      : clobTokenIds?.[1];

    if (!tokenID) {
      alert('Error: Could not determine Token ID for this market. Trading unavailable.');
      return;
    }

    setStep('signing');

    const result = await submitOrderFlow(
      {
        marketID: market.marketID,
        tokenID: tokenID, // Explicit Token ID
        side: side,
        price: parseFloat(price),
        size: parseFloat(size),
      },
      userBalance
    );

    if (!result) {
      setStep('input'); // Reset on error
    }
  };

  const bgColor = isNight ? 'bg-black/40' : 'bg-white/40';
  const textColor = isNight ? 'text-white' : 'text-black';
  const borderColor = isNight ? 'border-white/10' : 'border-black/10';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm`}
      onClick={onClose}
    >
      <div
        className={`${bgColor} backdrop-blur-xl border ${borderColor} rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-2xl font-light ${textColor}`}>Trade Order</h2>
          <button
            onClick={onClose}
            className={`text-2xl ${textColor} opacity-50 hover:opacity-75`}
          >
            ×
          </button>
        </div>

        {/* Market Info */}
        <div className={`mb-6 pb-4 border-b ${borderColor}`}>
          <p className={`text-sm ${textColor} opacity-70`}>{market.title}</p>
          <p className={`text-xs ${textColor} opacity-50 mt-1`}>ID: {market.marketID}</p>
        </div>

        {/* Input Step */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Side Selection */}
            <div>
              <label className={`text-xs ${textColor} opacity-70 mb-2 block`}>Prediction</label>
              <div className="flex gap-3">
                {['YES', 'NO'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`flex-1 py-2 rounded-lg font-light text-sm transition-all border ${
                      side === s
                        ? isNight
                          ? 'bg-blue-500/40 border-blue-400 text-blue-100'
                          : 'bg-blue-400/40 border-blue-500 text-blue-900'
                        : isNight
                        ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        : 'bg-black/5 border-black/10 text-black/70 hover:bg-black/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Input */}
            <div>
              <label className={`text-xs ${textColor} opacity-70 mb-2 block`}>Price (per share)</label>
              <input
                type="number"
                min="0.01"
                max="0.99"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-transparent border ${borderColor} ${textColor} placeholder:${textColor} placeholder:opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                placeholder="0.50"
              />
              <p className={`text-xs ${textColor} opacity-50 mt-1`}>
                {side === 'YES' ? 'Bullish' : 'Bearish'} outcome
              </p>
            </div>

            {/* Size Input */}
            <div>
              <label className={`text-xs ${textColor} opacity-70 mb-2 block`}>Size (shares)</label>
              <input
                type="number"
                min="1"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-transparent border ${borderColor} ${textColor} placeholder:${textColor} placeholder:opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                placeholder="100"
              />
            </div>

            {/* Cost Estimate */}
            {estimatedCost > 0 && (
              <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-lg p-3`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${textColor} opacity-70`}>Estimated Cost</span>
                  <span className={`text-lg font-light ${textColor}`}>
                    ${estimatedCost.toFixed(2)} {balanceSymbol}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs ${textColor} opacity-50`}>Available Balance</span>
                  <span className={`text-sm ${textColor} ${
                    userBalance < estimatedCost ? 'text-red-400' : ''
                  }`}>
                    ${userBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Wallet Connection */}
            {!isConnected ? (
              <div>
                <p className={`text-xs ${textColor} opacity-70 mb-3`}>
                  Connect MetaMask to sign and submit your order
                </p>
                <ConnectKitButton />
              </div>
            ) : (
              <p className={`text-xs ${textColor} opacity-50`}>
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            )}

            {/* Error Display */}
            {error && (
              <div className={`${isNight ? 'bg-red-500/20 border-red-400/30' : 'bg-red-400/20 border-red-500/30'} border rounded-lg p-3`}>
                <p className={`text-sm ${textColor} text-red-400`}>{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border ${
                  isNight
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black/70'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!isConnected || !size || !price || estimatedCost > userBalance}
                className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border ${
                  isConnected && size && price && estimatedCost <= userBalance
                    ? isNight
                      ? 'bg-blue-500/30 hover:bg-blue-500/40 border-blue-400/30 text-blue-200'
                      : 'bg-blue-400/30 hover:bg-blue-400/40 border-blue-500/30 text-blue-900'
                    : isNight
                    ? 'bg-gray-500/20 border-gray-400/20 text-gray-400'
                    : 'bg-gray-400/20 border-gray-500/20 text-gray-600'
                }`}
              >
                Review
              </button>
            </div>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-lg p-4 space-y-3`}>
              <OrderReviewRow label="Prediction" value={side} textColor={textColor} />
              <OrderReviewRow label="Price" value={`$${price}`} textColor={textColor} />
              <OrderReviewRow label="Size" value={`${size} shares`} textColor={textColor} />
              <div className={`border-t ${borderColor} pt-3`}>
                <OrderReviewRow label="Total Cost" value={`$${estimatedCost.toFixed(2)} ${balanceSymbol}`} textColor={textColor} />
              </div>
            </div>

            <p className={`text-xs ${textColor} opacity-60 text-center`}>
              You'll sign this order in MetaMask. No fees charged by fourcast.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('input')}
                className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border ${
                  isNight
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                    : 'bg-black/5 hover:bg-black/10 border-black/10 text-black/70'
                }`}
              >
                Back
              </button>
              <button
                onClick={handleSubmitOrder}
                className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border ${
                  isNight
                    ? 'bg-green-500/30 hover:bg-green-500/40 border-green-400/30 text-green-200'
                    : 'bg-green-400/30 hover:bg-green-400/40 border-green-500/30 text-green-900'
                }`}
              >
                Sign & Submit
              </button>
            </div>
          </div>
        )}

        {/* Signing Step */}
        {step === 'signing' && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center py-8">
              <div className="relative w-16 h-16">
                <div className={`absolute inset-0 border-4 border-blue-500/30 rounded-full animate-spin`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔐</span>
                </div>
              </div>
            </div>
            <p className={`text-lg ${textColor} font-light`}>Signing Order</p>
            <p className={`text-sm ${textColor} opacity-60`}>
              Approve the signature in MetaMask to continue
            </p>
          </div>
        )}

        {/* Success Step */}
        {step === 'submitted' && success && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center py-8">
              <span className="text-5xl">✓</span>
            </div>
            <p className={`text-lg ${textColor} font-light`}>Order Submitted</p>
            <div className={`${isNight ? 'bg-green-500/20 border-green-400/30' : 'bg-green-400/20 border-green-500/30'} border rounded-lg p-3`}>
              <p className={`text-sm font-light ${textColor}`}>
                Order ID: {success.orderID}
              </p>
            </div>
            <p className={`text-xs ${textColor} opacity-60`}>
              Redirecting to Polymarket...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Review row component
 */
function OrderReviewRow({ label, value, textColor }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${textColor} opacity-70`}>{label}</span>
      <span className={`text-sm font-light ${textColor}`}>{value}</span>
    </div>
  );
}
