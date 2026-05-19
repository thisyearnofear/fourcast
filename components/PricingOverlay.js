'use client';

import { useState } from 'react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic AI analysis',
    features: [
      '3 AI analyses per day',
      'Basic confidence scoring',
      'Market browsing & discovery',
      'Public track record',
    ],
    cta: 'Current plan',
    disabled: true,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    description: 'Unlimited analysis for serious traders',
    features: [
      'Unlimited AI analyses',
      'Deep analysis mode (Qwen3-235B)',
      'Live weather data integration',
      'Web search for context',
      'Cross-platform arbitrage detection',
      'Priority AI processing',
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19.99',
    period: '/month',
    description: 'Maximum edge for active traders',
    features: [
      'Everything in Pro',
      'Kelly Criterion position sizing',
      'API access for developers',
      'Automated arbitrage execution',
      'Custom alert system',
      'Dedicated support',
    ],
    cta: 'Go Premium',
    disabled: false,
    popular: false,
  },
];

export default function PricingOverlay({ isOpen, onClose, isNight = false }) {
  const [selectedPlan, setSelectedPlan] = useState('pro');

  if (!isOpen) return null;

  const textColor = isNight ? 'text-white' : 'text-black';
  const mutedColor = isNight ? 'text-white/50' : 'text-black/50';

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl rounded-3xl overflow-hidden ${
          isNight ? 'bg-slate-900 border border-white/10' : 'bg-white border border-black/10'
        } shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 pt-8 pb-6 text-center border-b ${isNight ? 'border-white/10' : 'border-black/10'}`}>
          <div className="text-4xl mb-3">🔮</div>
          <h2 className={`text-2xl font-semibold ${textColor} mb-2`}>
            Unlock Your Full Edge
          </h2>
          <p className={`text-sm ${mutedColor} max-w-md mx-auto`}>
            You've experienced the power of AI-driven prediction analysis. Upgrade for unlimited access to every feature.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isProPlan = plan.popular;

            return (
              <button
                key={plan.id}
                onClick={() => !plan.disabled && setSelectedPlan(plan.id)}
                disabled={plan.disabled}
                className={`relative flex flex-col p-5 rounded-2xl text-left transition-all border ${
                  isProPlan
                    ? isNight
                      ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/30'
                      : 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
                    : isNight
                      ? 'bg-white/5 border-white/10 hover:border-white/20'
                      : 'bg-black/5 border-black/10 hover:border-black/20'
                } ${plan.disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
              >
                {isProPlan && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider
                    bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg`}>
                    Most Popular
                  </div>
                )}

                <div className="mb-3">
                  <h3 className={`text-lg font-semibold ${textColor}`}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-3xl font-bold ${textColor}`}>{plan.price}</span>
                    <span className={`text-sm ${mutedColor}`}>{plan.period}</span>
                  </div>
                  <p className={`text-xs ${mutedColor} mt-1`}>{plan.description}</p>
                </div>

                <ul className="flex-1 space-y-2 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 ${plan.disabled ? 'text-gray-400' : 'text-green-400'}`}>
                        {plan.disabled ? '○' : '✓'}
                      </span>
                      <span className={`${plan.disabled ? mutedColor : ''} ${isNight ? 'text-white/80' : 'text-black/80'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div
                  className={`w-full py-2.5 rounded-xl text-sm font-medium text-center transition-all ${
                    plan.disabled
                      ? isNight ? 'bg-white/10 text-white/40' : 'bg-black/10 text-black/40'
                      : isSelected
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                        : isNight
                          ? 'bg-white/10 text-white/70 hover:bg-white/20'
                          : 'bg-black/10 text-black/70 hover:bg-black/20'
                  }`}
                >
                  {plan.cta}
                </div>
              </button>
            );
          })}
        </div>

        {/* Annual upsell note */}
        <div className={`px-6 pb-4 text-center`}>
          <p className={`text-xs ${mutedColor}`}>
            Annual plans available at ~33% off. All plans include a 7-day free trial.
            {' '}Payments processed in USDC on Arc.
          </p>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-center gap-4 px-6 pb-6`}>
          <button
            onClick={onClose}
            className={`text-sm font-medium px-4 py-2 rounded-xl transition-all ${
              isNight ? 'text-white/60 hover:text-white/80' : 'text-black/60 hover:text-black/80'
            }`}
          >
            Maybe later
          </button>
          {selectedPlan !== 'free' && (
            <button
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-all shadow-lg"
              onClick={() => {
                // Placeholder — payment integration point
                // In production: redirect to USDC checkout or Stripe
                alert(`🚧 Payment integration placeholder\n\nSelected plan: ${PLANS.find(p => p.id === selectedPlan)?.name}\n\nTo complete: integrate Stripe or Circle USDC checkout.`);
              }}
            >
              Continue with {PLANS.find(p => p.id === selectedPlan)?.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
