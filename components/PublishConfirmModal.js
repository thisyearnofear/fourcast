'use client';

import { useState } from 'react';
import { BRAND } from '@/constants/brand';
import { useCantonWalletContext } from '@/app/CantonWalletLayer';

export default function PublishConfirmModal({ isOpen, onClose, onConfirm, market, analysis, isNight, isPublishing }) {
  const canton = useCantonWalletContext();
  const [settlementLayer, setSettlementLayer] = useState('arc'); // 'arc' | 'canton'

  if (!isOpen) return null;

  const chainLabel = settlementLayer === 'canton'
    ? BRAND.publish.cantonPrivate.chain
    : BRAND.publish.arcPreferred.chain;
  const gasLabel = settlementLayer === 'canton'
    ? BRAND.publish.cantonPrivate.gas
    : BRAND.publish.arcPreferred.gas;

  const recommendation = analysis?.recommended_action || analysis?.assessment?.direction || 'Neutral';
  const confidence = analysis?.assessment?.confidence || 'Unknown';
  const reasoning = analysis?.reasoning || analysis?.analysis || '';
  const reasoningPreview = reasoning.length > 120 ? reasoning.slice(0, 120) + '...' : reasoning;

  const handleConfirm = () => {
    onConfirm(settlementLayer);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-w-md w-full rounded-2xl p-6 border backdrop-blur-xl bg-black/60 border-white/10`}>
        <h3 className={`text-lg font-light mb-4 text-white`}>
          Record Your Prediction
        </h3>

        <div className="space-y-3 mb-6">
          <div className={`rounded-xl p-3 border bg-white/5 border-white/10`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Market</div>
            <div className={`text-sm font-medium text-white`}>
              {market?.title || market?.question || 'Unknown'}
            </div>
          </div>

          <div className="flex gap-3">
            <div className={`flex-1 rounded-xl p-3 border bg-white/5 border-white/10`}>
              <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Your Call</div>
              <div className={`text-sm font-medium text-green-300`}>
                {recommendation}
              </div>
            </div>
            <div className={`flex-1 rounded-xl p-3 border bg-white/5 border-white/10`}>
              <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Confidence</div>
              <div className={`text-sm font-medium text-purple-300`}>
                {confidence}
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-3 border bg-white/5 border-white/10`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">AI Reasoning</div>
            <div className={`text-xs leading-relaxed text-white/60`}>
              {reasoningPreview}
            </div>
          </div>

          {/* Settlement Layer Selector */}
          <div className={`rounded-xl p-3 border bg-white/5 border-white/10`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40 mb-2">Settlement Layer</div>
            <div className={`grid ${canton?.cantonEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              <button
                type="button"
                onClick={() => setSettlementLayer('arc')}
                className={`rounded-lg p-2.5 text-left transition-all border ${
                  settlementLayer === 'arc'
                    ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                }`}
              >
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <span>◆</span> Arc (Public)
                </div>
                <div className="text-[10px] opacity-60 mt-1">
                  USDC · public reputation receipt
                </div>
              </button>
              {canton?.cantonEnabled && (
              <button
                type="button"
                onClick={() => setSettlementLayer('canton')}
                disabled={!canton?.connected}
                className={`rounded-lg p-2.5 text-left transition-all border disabled:opacity-30 disabled:cursor-not-allowed ${
                  settlementLayer === 'canton'
                    ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                }`}
              >
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <span>◈</span> Canton (Private)
                </div>
                <div className="text-[10px] opacity-60 mt-1">
                  {canton?.connected ? 'cBTC/cETH · hidden sizes' : 'Connect Console Wallet first'}
                </div>
              </button>
              )}
            </div>
          </div>

          <div className={`flex items-center justify-between rounded-xl p-3 border bg-white/5 border-white/10`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40">Chain</div>
            <div className={`text-xs font-medium ${settlementLayer === 'canton' ? 'text-teal-300' : 'text-indigo-300'}`}>
              {chainLabel}
            </div>
            <div className="text-[10px] uppercase tracking-wider opacity-40">Fee</div>
            <div className={`text-xs font-medium text-white/80`}>{gasLabel}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm transition-all border-white/10 text-white/50 hover:text-white/70 disabled:opacity-30`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPublishing}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
              settlementLayer === 'canton'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-400/30 text-teal-200 hover:from-teal-500/30 hover:to-cyan-500/30'
                : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-200 hover:from-purple-500/30 hover:to-pink-500/30'
            }`}
          >
            {isPublishing
              ? 'Confirming...'
              : settlementLayer === 'canton'
                ? 'Settle Privately on Canton'
                : 'Confirm & Publish on Arc'}
          </button>
        </div>

        <p className={`text-[10px] text-center mt-4 text-white/25`}>
          {settlementLayer === 'canton'
            ? 'Private Daml transaction — position size visible only to you and the operator.'
            : 'This action is on-chain and cannot be undone.'}
        </p>
      </div>
    </div>
  );
}
