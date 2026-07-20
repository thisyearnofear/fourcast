'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useSubscription, TIERS } from '@/hooks/useSubscription';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ARC_EXPLORER_TX } from '@/constants/appConstants';

// Pricing is operator-first per docs/GO_TO_MARKET.md §3 and constants/brand.js
// positioning. Premium ($19.99/mo) is the headline — it is the Quant-Operator
// tier. Pro ($9.99) sits quietly beside it for casual signal publishers.
const PLANS = [
 {
 id: 'free', name: 'Free', price: '$0', period: 'forever',
 description: 'Audit-only access for newcomers',
 features: ['3 AI analyses per day', 'Public Track Record browsing', 'Signal marketplace audit', 'No Autopilot execution'],
 cta: 'Current plan', disabled: true, popular: false, audience: 'auditor',
 },
 {
 id: 'pro', name: 'Pro', price: '$9.99', period: '/month',
 description: 'For Signal Analysts who publish, not automate',
 features: ['Unlimited AI analyses', 'Deep analysis mode (Qwen3-235B)', 'Live weather data integration', 'Web search for context', 'Publish public signals on Arc', 'Follow-graph onboarding'],
 cta: 'Upgrade to Pro', disabled: false, popular: false, tier: TIERS.PRO, audience: 'analyst',
 },
 {
 id: 'premium', name: 'Premium', price: '$19.99', period: '/month',
 description: 'For Quant Operators running real capital',
 features: ['Everything in Pro', 'Kelly Criterion position sizing', 'Autopilot execution with Polymarket Builder attribution', 'Audited Track Record on Arc', 'Daily concierge Telegram report', 'API access for developer workflows'],
 cta: 'Upgrade to Premium', disabled: false, popular: true, tier: TIERS.PREMIUM, audience: 'operator',
 },
];

export default function PricingOverlay({ isOpen, onClose, isNight = false }) {
 const [selectedPlan, setSelectedPlan] = useState('premium');
 const { txState, subscribe, resetTx, subscription, isConfigured } = useSubscription();
 const modalRef = useFocusTrap({ isOpen, onClose });

 // Don't show pricing overlay if payment system isn't configured
 if (!isOpen || !isConfigured) return null;

 const textColor = 'text-white';
 const mutedColor = 'text-white/50';

 const activePlan = PLANS.find(p => p.id === selectedPlan);
 const isProcessing = txState.status !== 'idle' && txState.status !== 'success' && txState.status !== 'error';

 const getTxStatusText = () => {
 switch (txState.status) {
 case 'approving': return 'Approving USDC...';
 case 'approving-wallet': return 'Approve in wallet...';
 case 'subscribing': return 'Subscribing...';
 case 'confirming': return 'Confirming transaction...';
 case 'success': return '✅ Subscription active!';
 case 'error': return `❌ ${txState.error || 'Transaction failed'}`;
 default: return '';
 }
 };

 return (
 <div
 className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto"
 style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)' }}
 onClick={onClose}
 >
 <div
 ref={modalRef}
 role="dialog"
 aria-modal="true"
 aria-labelledby="pricing-overlay-heading"
 className={`relative w-full max-w-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl`}
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className={`px-6 pt-8 pb-6 text-center border-b border-white/10`}>
 <div className="mb-3 flex items-center justify-center">
 <Sparkles className="h-10 w-10 text-emerald-300" aria-hidden="true" />
 </div>
 <h2 id="pricing-overlay-heading" className={`text-2xl font-semibold ${textColor} mb-2`}>
 Unlock Your Autopilot
 </h2>
 <p className={`text-sm ${mutedColor} max-w-md mx-auto`}>
 {subscription.active
 ? `You're currently on ${PLANS.find(p => p.tier === subscription.tier)?.name || 'a paid'} plan. Upgrade or extend below.`
 : "You've experienced the power of AI-driven prediction analysis. Upgrade for unlimited access to every feature."}
 </p>
 {!isConfigured && (
 <p className="text-xs text-amber-400 mt-2">
 ⚙️ Payment not configured — add contract addresses to .env.local
 </p>
 )}
 </div>

 {/* Plans */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
 {PLANS.map((plan) => {
 const isSelected = selectedPlan === plan.id;
 const isProPlan = plan.popular;

 return (
 <button
 key={plan.id}
 onClick={() => !plan.disabled && !isProcessing && setSelectedPlan(plan.id)}
 disabled={plan.disabled || isProcessing}
 className={`relative flex flex-col p-5 text-left transition-all border ${
 isProPlan
 ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
 : 'bg-white/5 border-white/10 hover:border-white/20'
 } ${plan.disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
 >
 {isProPlan && (
 <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider
 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg`}>
 Operator Tier
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
 <span className={`${plan.disabled ? mutedColor : ''} text-white/80`}>
 {f}
 </span>
 </li>
 ))}
 </ul>
 <div
 className={`w-full py-2.5 text-sm font-medium text-center transition-all ${
 plan.disabled
 ? 'bg-white/10 text-white/40'
 : isSelected
 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
 : 'bg-white/10 text-white/70 hover:bg-white/20'
 }`}
 >
 {plan.cta}
 </div>
 </button>
 );
 })}
 </div>

 {/* Transaction Status */}
 {txState.status !== 'idle' && (
 <div className={`px-6 pb-3 text-center ${txState.status === 'success' ? 'text-green-400' : txState.status === 'error' ? 'text-red-400' : ''}`}>
 <p className="text-sm font-medium">{getTxStatusText()}</p>
 {txState.hash && (
 <a
 href={ARC_EXPLORER_TX(txState.hash)}
 target="_blank"
 rel="noopener noreferrer"
 className={`text-xs underline mt-1 inline-block ${mutedColor} hover:opacity-80`}
 >
 View on Arc Explorer ↗
 </a>
 )}
 </div>
 )}

 {/* Annual upsell note */}
 <div className={`px-6 pb-4 text-center`}>
 <p className={`text-xs ${mutedColor}`}>
 {!subscription.active
 ? 'Annual plans available at ~33% off. All plans include a 7-day free trial. Payments in USDC on Arc.'
 : 'Extend your subscription or upgrade for more features. USDC payments on Arc.'}
 </p>
 </div>

 {/* Footer */}
 <div className={`flex items-center justify-center gap-4 px-6 pb-6`}>
 <button
 onClick={() => { onClose(); resetTx(); }}
 className={`text-sm font-medium px-4 py-2 transition-all text-white/60 hover:text-white/80`}
 >
 {txState.status === 'success' ? 'Close' : 'Maybe later'}
 </button>
 {selectedPlan !== 'free' && (
 <button
 className={`px-6 py-2.5 text-sm font-semibold transition-all shadow-lg ${
 txState.status === 'success'
 ? 'bg-green-500 text-white cursor-default'
 : isProcessing
 ? 'bg-white/20 text-white/60 cursor-wait'
 : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90'
 }`}
 disabled={isProcessing || txState.status === 'success'}
 onClick={() => {
 if (activePlan?.tier !== undefined) {
 subscribe(activePlan.tier);
 }
 }}
 >
 {txState.status === 'success'
 ? '✓ Subscribed'
 : isProcessing
 ? getTxStatusText()
 : `Continue with ${activePlan?.name || 'Pro'}`
 }
 </button>
 )}
 </div>
 </div>
 </div>
 );
}
