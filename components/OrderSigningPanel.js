'use client';

import { useState, useEffect, useMemo } from 'react';
import { useOrderSigning } from '@/hooks/useOrderSigning';
import { ConnectKitButton } from 'connectkit';
import { useBalance, useAccount, useSwitchChain } from 'wagmi';
import { calculateKellySizing } from '@/utils/kellySizing';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// Polygon Configuration
const POLYGON_CHAIN_ID = 137;
const POLYGON_CHAIN_NAME = 'Polygon';
// Native USDC on Polygon (current standard)
const USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

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
export function OrderSigningPanel({ market, onClose, isNight, onSuccess, initialSide = 'YES', embedded = false, analysis = null }) {
  // SSR hydration guard — wagmi hooks return neutral state during SSR that
  // doesn't match the client's resolved state. Defer JSX until after mount.
  const [mounted, setMounted] = useState(false);

  // Order parameters
  const [side, setSide] = useState(initialSide);
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

  // Get current chain and switch chain functionality
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();

  // Check if on correct chain
  const isCorrectChain = chain?.id === POLYGON_CHAIN_ID;

  // Fetch real user balance (USDC on Polygon)
  const { data: balanceData } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    chainId: POLYGON_CHAIN_ID, // Polygon Mainnet
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

  // ── Kelly Criterion Position Sizing ───────────────────────────────────
  // Compute recommended bet size based on AI analysis confidence & edge
  const kellyResult = useMemo(() => {
    if (!analysis) return null;

    // Extract AI probability from analysis data
    // Prefer synthFairProb (ML ensemble), fallback to any aiProbability field
    const aiProb =
      analysis.synthData?.polymarketEdge?.synthFairProb ??
      analysis.aiProbability ??
      null;

    // Market YES odds from current market data
    const marketYesOdds = market?.ask ?? market?.currentOdds?.yes ?? null;

    if (aiProb == null || marketYesOdds == null) return null;

    const confidence = analysis.assessment?.confidence || 'LOW';
    const source = analysis.source || 'llm';

    return calculateKellySizing(aiProb, marketYesOdds, 0.5, confidence, source);
  }, [analysis, market]);

  // Apply Kelly size to the size input
  const applyKellySize = () => {
    if (kellyResult?.actionable && kellyResult.sizePct > 0 && userBalance > 0) {
      // Calculate size in shares: sizePct * balance / price
      const shares = (kellyResult.sizePct * userBalance) / parseFloat(price || '0.50');
      setSize(Math.max(1, Math.round(shares)).toString());
    }
  };

  // Handle successful submission
  useEffect(() => {
    if (success) {
      setStep('submitted');
      setTimeout(() => {
        if (onSuccess) onSuccess(success);
        if (!embedded) onClose();
      }, 2000);
    }
  }, [success, onClose, onSuccess, embedded]);

  // Mark as mounted after first client render — gates JSX output to client only.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus trap is active only when this component is the top-level modal
  // (standalone). When embedded inside ArbitrageExecutionPanel, the parent
  // owns the trap and ARIA so we don't compete with it.
  const modalRef = useFocusTrap({ isOpen: !embedded, onClose });

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
    // clobTokenIds might be a JSON string (from some API endpoints) or an array
    let clobTokenIds = market.rawMarket?.clobTokenIds || market.clobTokenIds;

    if (typeof clobTokenIds === 'string') {
      try {
        clobTokenIds = JSON.parse(clobTokenIds);
      } catch (e) {
        console.error('Failed to parse clobTokenIds:', e);
      }
    }

    if (!clobTokenIds || !Array.isArray(clobTokenIds) || clobTokenIds.length < 2) {
      // Fallback: Try to use marketID if it looks like a token ID (unlikely to work for binary)
      console.warn("Invalid clobTokenIds format", clobTokenIds);
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

  // SSR hydration guard — wagmi hooks may return values during SSR that don't
  // match the client. Skip rendering until mounted (same pattern as UnifiedConnect).
  if (!mounted) return null;

  // Glass CSS classes (DRY)
  const glassPanel = 'glass-heavy';
  const textColor = 'text-white';
  const borderColor = 'border-white/10';

  const content = (
    <div
      ref={!embedded ? modalRef : undefined}
      role={!embedded ? 'dialog' : undefined}
      aria-modal={!embedded ? 'true' : undefined}
      aria-labelledby={!embedded ? 'order-signing-heading' : undefined}
      className={`${embedded ? 'h-full flex flex-col' : `${glassPanel} rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl`}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header (Only show close button if NOT embedded) */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <h2 id="order-signing-heading" className={`text-2xl font-light ${textColor}`}>Trade Order</h2>
          <button
            onClick={onClose}
            className={`text-2xl ${textColor} opacity-50 hover:opacity-75`}
          >
            ×
          </button>
        </div>
      )}

      {/* Market Info (Hide if embedded as parent shows context) */}
      {!embedded && (
        <div className={`mb-6 pb-4 border-b ${borderColor}`}>
          <p className={`text-sm ${textColor} opacity-70`}>{market.title}</p>
          <p className={`text-xs ${textColor} opacity-50 mt-1`}>ID: {market.marketID}</p>
        </div>
      )}

      {/* Input Step */}
      {step === 'input' && (
        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Chain & Balance Status Card */}
          {isConnected && (
            <div className={`bg-white/5 border-white/10 border rounded-xl p-4`}>
              <div className="space-y-2">
                {isCorrectChain ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${textColor} opacity-70`}>Network</span>
                      <span className={`text-xs font-medium ${textColor} flex items-center gap-1`}>
                        ✓ {POLYGON_CHAIN_NAME}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className={`text-xs ${textColor} opacity-70`}>Available Balance</span>
                      <span className={`text-sm font-light ${textColor}`}>
                        ${userBalance.toFixed(2)} {balanceSymbol}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${textColor} opacity-70`}>Network</span>
                      <span className={`text-xs text-amber-400`}>
                        {chain?.name || 'Unknown'}
                      </span>
                    </div>
                    <button
                      onClick={() => switchChain?.({ chainId: POLYGON_CHAIN_ID })}
                      className={`w-full py-2 rounded-lg font-light text-xs transition-all border mt-2 bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 text-amber-300`}
                    >
                      Switch to {POLYGON_CHAIN_NAME}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Connection Required */}
          {!isConnected && (
            <div className={`bg-white/5 border-white/10 border rounded-xl p-4 text-center`}>
              <p className={`text-xs ${textColor} opacity-70 mb-3`}>
                Connect wallet to trade
              </p>
              <ConnectKitButton />
            </div>
          )}

          {/* ── Kelly Criterion Position Sizing Card ── */}
          {kellyResult && (
            <div className={`rounded-xl border overflow-hidden transition-all ${
              kellyResult.actionable
                ? 'bg-gradient-to-br from-purple-900/40 via-blue-900/20 to-emerald-900/30 border-purple-500/30 shadow-lg shadow-purple-500/10'
                : 'bg-white/5 border-white/10'
            }`}>
              {/* Header */}
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                kellyResult.actionable
                  ? 'border-purple-500/20'
                  : borderColor
              }`}>
                <span className="text-sm">🧮</span>
                <span className={`text-[11px] font-medium uppercase tracking-wider ${textColor} opacity-70`}>
                  Kelly Criterion Sizing
                </span>
                {kellyResult.actionable && (
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    analysis?.source?.includes('synthdata')
                      ? 'bg-purple-500/30 text-purple-300'
                      : 'bg-blue-500/30 text-blue-300'
                  }`}>
                    {analysis?.source?.includes('synthdata') ? 'ML ENSEMBLE' : 'AI'}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-3 space-y-2">
                {kellyResult.actionable ? (
                  <>
                    {/* Direction + Edge row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          kellyResult.direction === 'BUY YES'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {kellyResult.direction === 'BUY YES' ? '▲ BUY YES' : '▼ BUY NO'}
                        </span>
                        <span className={`text-lg font-bold ${
                          kellyResult.edge > 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}>
                          {(kellyResult.edge * 100).toFixed(1)}%
                        </span>
                        <span className={`text-[10px] ${textColor} opacity-40`}>edge</span>
                      </div>

                      {/* Kelly fraction badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50`}>
                        k = {kellyResult.kellyPct.toFixed(2)}
                      </span>
                    </div>

                    {/* Recommended size row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${textColor} opacity-60`}>
                          Recommended:
                        </span>
                        <span className={`text-base font-semibold ${textColor}`}>
                          {(kellyResult.sizePct * 100).toFixed(1)}%
                        </span>
                        <span className={`text-[10px] ${textColor} opacity-40`}>of wallet</span>
                      </div>

                      {/* Apply button */}
                      <button
                        onClick={applyKellySize}
                        disabled={userBalance <= 0}
                        className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                          userBalance > 0
                            ? 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/30 text-purple-200 hover:scale-105'
                            : 'bg-gray-500/20 border-gray-400/20 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Apply ✓
                      </button>
                    </div>

                    {/* Confidence + source row */}
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${
                        (analysis?.assessment?.confidence || 'LOW') === 'HIGH'
                          ? 'bg-green-500/20 text-green-300'
                          : (analysis?.assessment?.confidence || 'LOW') === 'MEDIUM'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}>
                        {analysis?.assessment?.confidence || 'LOW'}
                      </span>
                      {analysis?.source?.includes('synthdata') && (
                        <span className={`${textColor} opacity-50`}>
                          SynthData 200+ ML models
                        </span>
                      )}
                      {userBalance > 0 && !isNaN(kellyResult.sizePct * userBalance) && (
                        <span className={`${textColor} opacity-40 ml-auto`}>
                          ≈ ${(kellyResult.sizePct * userBalance).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-xs opacity-50">⚖️</span>
                    <p className={`text-xs ${textColor} opacity-50`}>
                      No actionable edge — edge too small ({Math.abs(kellyResult.edge * 100).toFixed(1)}%) to recommend a Kelly-sized position
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Side Selection */}
          <div>
            <label className={`text-xs ${textColor} opacity-70 mb-2 block`}>Prediction</label>
            <div className="flex gap-3">
              {['YES', 'NO'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded-lg font-light text-sm transition-all border ${side === s
                      ? 'bg-blue-500/40 border-blue-400 text-blue-100'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
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
            <div className={`bg-white/5 border-white/10 border rounded-lg p-3`}>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${textColor} opacity-70`}>Estimated Cost</span>
                <span className={`text-lg font-light ${textColor}`}>
                  ${estimatedCost.toFixed(2)}
                </span>
              </div>
              {isConnected && isCorrectChain && userBalance < estimatedCost && (
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">⚠️</span>
                    <span className={`text-xs text-red-400`}>Insufficient balance</span>
                  </div>
                  <button
                    onClick={() => window.open('https://app.uniswap.org/swap?outputCurrency=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', '_blank')}
                    className={`w-full py-2 rounded-lg font-light text-xs transition-all border bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-300`}
                  >
                    Quick Swap ETH to USDC ↗
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className={`bg-red-500/20 border-red-400/30 border rounded-lg p-3`}>
              <p className={`text-sm ${textColor} text-red-400`}>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 mt-auto">
            {!embedded && (
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border bg-white/5 hover:bg-white/10 border-white/10 text-white/70`}
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => setStep('review')}
              disabled={!isConnected || !isCorrectChain || !size || !price || estimatedCost > userBalance}
              className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border ${isConnected && isCorrectChain && size && price && estimatedCost <= userBalance
                  ? 'bg-blue-500/30 hover:bg-blue-500/40 border-blue-400/30 text-blue-200'
                  : 'bg-gray-500/20 border-gray-400/20 text-gray-400'
                }`}
              title={
                !isConnected
                  ? 'Connect wallet to trade'
                  : !isCorrectChain
                    ? `Switch to ${POLYGON_CHAIN_NAME}`
                    : !size || !price
                      ? 'Enter size and price'
                      : estimatedCost > userBalance
                        ? `Need $${(estimatedCost - userBalance).toFixed(2)} more`
                        : 'Review and sign order'
              }
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div className="space-y-4 flex-1 flex flex-col">
          <div className={`bg-white/5 rounded-lg p-4 space-y-3`}>
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

          <div className="flex gap-3 pt-4 mt-auto">
            <button
              onClick={() => setStep('input')}
              className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border bg-white/5 hover:bg-white/10 border-white/10 text-white/70`}
            >
              Back
            </button>
            <button
              onClick={handleSubmitOrder}
              className={`flex-1 py-3 rounded-lg font-light text-sm transition-all border bg-green-500/30 hover:bg-green-500/40 border-green-400/30 text-green-200`}
            >
              Sign & Submit
            </button>
          </div>
        </div>
      )}

      {/* Signing Step */}
      {step === 'signing' && (
        <div className="space-y-4 text-center flex-1 flex flex-col justify-center">
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
        <div className="space-y-4 text-center flex-1 flex flex-col justify-center">
          <div className="flex justify-center py-8">
            <span className="text-5xl">✓</span>
          </div>
          <p className={`text-lg ${textColor} font-light`}>Order Submitted</p>
          <div className={`bg-green-500/20 border-green-400/30 border rounded-lg p-3`}>
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
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm`}
      onClick={onClose}
    >
      {content}
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
