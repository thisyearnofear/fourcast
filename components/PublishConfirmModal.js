'use client';

import { BRAND } from '@/constants/brand';

export default function PublishConfirmModal({ isOpen, onClose, onConfirm, market, analysis, isNight, isPublishing }) {
  // Arc is the only publish chain
  const chainLabel = BRAND.publish.arcPreferred.chain;
  const gasLabel = BRAND.publish.arcPreferred.gas;
  if (!isOpen) return null;

  const recommendation = analysis?.recommended_action || analysis?.assessment?.direction || 'Neutral';
  const confidence = analysis?.assessment?.confidence || 'Unknown';
  const reasoning = analysis?.reasoning || analysis?.analysis || '';
  const reasoningPreview = reasoning.length > 120 ? reasoning.slice(0, 120) + '...' : reasoning;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-w-md w-full rounded-2xl p-6 border backdrop-blur-xl ${isNight ? 'bg-black/60 border-white/10' : 'bg-white/80 border-black/10'}`}>
        <h3 className={`text-lg font-light mb-4 ${isNight ? 'text-white' : 'text-black'}`}>
          Record Your Prediction
        </h3>

        <div className="space-y-3 mb-6">
          <div className={`rounded-xl p-3 border ${isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Market</div>
            <div className={`text-sm font-medium ${isNight ? 'text-white' : 'text-black'}`}>
              {market?.title || market?.question || 'Unknown'}
            </div>
          </div>

          <div className="flex gap-3">
            <div className={`flex-1 rounded-xl p-3 border ${isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
              <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Your Call</div>
              <div className={`text-sm font-medium ${isNight ? 'text-green-300' : 'text-green-700'}`}>
                {recommendation}
              </div>
            </div>
            <div className={`flex-1 rounded-xl p-3 border ${isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
              <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Confidence</div>
              <div className={`text-sm font-medium ${isNight ? 'text-purple-300' : 'text-purple-700'}`}>
                {confidence}
              </div>
            </div>
          </div>

          <div className={`rounded-xl p-3 border ${isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">AI Reasoning</div>
            <div className={`text-xs leading-relaxed ${isNight ? 'text-white/60' : 'text-black/60'}`}>
              {reasoningPreview}
            </div>
          </div>

          <div className={`flex items-center justify-between rounded-xl p-3 border ${isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-40">Settlement</div>
            <div className={`text-xs font-medium ${isNight ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {chainLabel}
            </div>
            <div className="text-[10px] uppercase tracking-wider opacity-40">Fee</div>
            <div className={`text-xs font-medium ${isNight ? 'text-white/80' : 'text-black/80'}`}>{gasLabel}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm transition-all ${isNight ? 'border-white/10 text-white/50 hover:text-white/70' : 'border-black/10 text-black/50 hover:text-black/70'} disabled:opacity-30`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPublishing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 text-purple-200 text-sm font-medium hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50"
          >
            {isPublishing ? 'Confirming...' : 'Confirm & Publish'}
          </button>
        </div>

        <p className={`text-[10px] text-center mt-4 ${isNight ? 'text-white/25' : 'text-black/25'}`}>
          This action is on-chain and cannot be undone.
        </p>
      </div>
    </div>
  );
}
