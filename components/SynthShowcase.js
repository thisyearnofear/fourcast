'use client';

/**
 * Compact Synth showcase component
 * Shows what Synth provides without creating a separate page
 */
export function SynthShowcase({ isNight = false }) {
  const textColor = isNight ? 'text-white' : 'text-slate-900';
  const cardBg = isNight ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/30';
  const subtleText = isNight ? 'text-white/60' : 'text-slate-600';

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-6 ${cardBg}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h3 className={`font-medium text-lg ${textColor}`}>
          Powered by SynthData
        </h3>
        <span className={`ml-auto px-2 py-1 rounded text-[10px] font-medium ${
          isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
        }`}>
          200+ ML MODELS
        </span>
      </div>

      <p className={`text-sm ${subtleText} mb-4`}>
        Quantitative forecasts from Bittensor Subnet 50's decentralized ML ensemble
      </p>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <span className={`${textColor} opacity-60`}>•</span>
          <div>
            <span className={`font-medium ${textColor}`}>Probabilistic Percentiles:</span>
            <span className={` ${subtleText}`}> P5/P50/P95 price targets for BTC, ETH, SOL, Gold, Stocks</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className={`${textColor} opacity-60`}>•</span>
          <div>
            <span className={`font-medium ${textColor}`}>Edge Detection:</span>
            <span className={` ${subtleText}`}> Compare ML fair odds vs live Polymarket/Kalshi prices</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className={`${textColor} opacity-60`}>•</span>
          <div>
            <span className={`font-medium ${textColor}`}>Path-Dependent Analysis:</span>
            <span className={` ${subtleText}`}> Novel use case for "BTC $60K before $65K?" type markets</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className={`${textColor} opacity-60`}>•</span>
          <div>
            <span className={`font-medium ${textColor}`}>Volatility Forecasts:</span>
            <span className={` ${subtleText}`}> Confidence scoring based on forecast vs realized volatility</span>
          </div>
        </div>
      </div>

      <div className={`mt-4 pt-4 border-t ${isNight ? 'border-white/10' : 'border-black/10'}`}>
        <p className={`text-xs ${subtleText}`}>
          Look for the <span className={`px-1.5 py-0.5 rounded font-medium ${
            isNight ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-400/20 text-purple-700'
          }`}>🤖 ML</span> badge on markets to see SynthData-backed analysis
        </p>
      </div>
    </div>
  );
}
