'use client';

/**
 * NarrativeSteps — The "One Loop" breadcrumb
 * 
 * Visually frames where the user is in the core narrative:
 * Search → Analyze → Publish/Trade → Track
 *
 * Props:
 * currentStep: 'search' | 'analyze' | 'publish' | 'scored'
 * isNight: boolean
 * className?: string
 */
import { BRAND } from '@/constants/brand';

export default function NarrativeSteps({ currentStep, isNight = false, className = '' }) {
 const steps = [
 { id: 'search', ...BRAND.loop.search },
 { id: 'analyze', ...BRAND.loop.analyze },
 { id: 'publish', ...BRAND.loop.publish },
 { id: 'scored', ...BRAND.loop.scored },
 ];

 const currentIdx = steps.findIndex(s => s.id === currentStep);

 const textColor = 'text-white';
 const activeBg = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100';
 const inactiveBg = 'bg-white/5 border-white/10 text-white/40';
 const doneBg = 'bg-emerald-500/15 border-emerald-400/25 text-emerald-300';
 const lineColor = 'bg-white/10';
 const doneLineColor = 'bg-emerald-500/30';

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
 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
 border transition-all whitespace-nowrap
 ${isCurrent ? activeBg : isDone ? doneBg : inactiveBg}
 ${isCurrent ? 'shadow-sm shadow-emerald-500/15' : ''}
 `}
 >
 <span className={`font-mono text-[10px] ${isCurrent ? '' : 'opacity-70'}`}>{step.icon}</span>
 <span>{isCurrent ? step.label : step.short}</span>
 {isCurrent && (
 <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse ml-0.5" />
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
