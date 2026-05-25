'use client';

/**
 * NarrativeSteps — The "One Loop" breadcrumb
 * 
 * Visually frames where the user is in the core narrative:
 *   Search → Analyze → Publish/Trade → Get Scored
 *
 * Props:
 *   currentStep: 'search' | 'analyze' | 'publish' | 'scored'
 *   isNight: boolean
 *   className?: string
 */
import { BRAND } from '@/constants/brand';

export default function NarrativeSteps({ currentStep, isNight = false, className = '' }) {
  const steps = [
    { id: 'search',  ...BRAND.loop.search },
    { id: 'analyze', ...BRAND.loop.analyze },
    { id: 'publish', ...BRAND.loop.publish },
    { id: 'scored',  ...BRAND.loop.scored },
  ];

  const currentIdx = steps.findIndex(s => s.id === currentStep);

  const textColor = isNight ? 'text-white' : 'text-black';
  const activeBg = isNight
    ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
    : 'bg-purple-400/20 border-purple-500/40 text-purple-800';
  const inactiveBg = isNight
    ? 'bg-white/5 border-white/10 text-white/40'
    : 'bg-black/5 border-black/10 text-black/40';
  const doneBg = isNight
    ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300'
    : 'bg-emerald-400/15 border-emerald-500/25 text-emerald-700';
  const lineColor = isNight ? 'bg-white/10' : 'bg-black/10';
  const doneLineColor = isNight ? 'bg-emerald-500/30' : 'bg-emerald-500/20';

  return (
    <div className={`flex items-center gap-0 ${className}`} aria-label="Navigation steps">
      {steps.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle + label */}
            <div
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
                border transition-all whitespace-nowrap
                ${isCurrent ? activeBg : isDone ? doneBg : inactiveBg}
                ${isCurrent ? 'shadow-sm shadow-purple-500/15' : ''}
              `}
            >
              <span className={`${isCurrent ? '' : 'opacity-70'}`}>{step.icon}</span>
              <span>{isCurrent ? step.label : step.short}</span>
              {isCurrent && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse ml-0.5" />
              )}
            </div>

            {/* Connector arrow between steps */}
            {i < steps.length - 1 && (
              <div className="flex items-center mx-1.5">
                <div className={`w-4 h-px ${isDone ? doneLineColor : lineColor}`} />
                <span className={`text-[9px] ${isDone ? doneLineColor.replace('bg-', 'text-') : lineColor.replace('bg-', 'text-')}`}>
                  ▶
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
