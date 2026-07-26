'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Calculator, Sparkles } from 'lucide-react';
import { BRAND } from '@/constants/brand';

// Lazy-load PricingOverlay so the OperatorMath block stays cheap on first paint.
// Same dynamic-import pattern as app/markets/page.js to keep bundle behavior
// consistent across pages that surface the Quant-Operator pricing modal.
const PricingOverlay = dynamic(
 () => import('@/components/PricingOverlay'),
 { ssr: false }
);

/**
 * OperatorMath — the headline product claim rendered as a self-contained
 * emerald hero block. Surfaces BRAND.positioning.operatorMath end-to-end so
 * the concierge DM (docs/GO_TO_MARKET.md) and the daily Telegram report can
 * quote the same numbers verbatim.
 *
 * Drop-in: <OperatorMath /> mounts its own PricingOverlay when the user clicks
 * "Unlock Autopilot" — no parent state plumbing required.
 *
 * Variants:
 * <OperatorMath /> — full headline (default). Use on /labs/autopilot
 * where the math IS the product context.
 * <OperatorMath compact /> — discovery mode. Hides the "Operator Math ·
 * Headline" eyebrow pill and tightens vertical
 * spacing. Use on the landing page where the
 * hero already establishes context.
 */
export default function OperatorMath({ compact = false }) {
 const { operatorMath } = BRAND.positioning;
 const [showPricing, setShowPricing] = useState(false);

 return (
 <div
 data-testid="operator-math-container"
 className={`mc-panel ${compact ? 'mb-4 p-4' : 'mb-6 p-5'} border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.04]`}
 >
 <div className="flex items-start gap-3">
 <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
 <Calculator className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
 </div>
 <div className="min-w-0 flex-1">
 {!compact && (
 <div className="mb-1 flex items-center gap-2">
 <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]/80">
 Operator Math
 </span>
 <span className="inline-flex items-center gap-1 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
 <Sparkles className="h-3 w-3" aria-hidden="true" />
 Headline
 </span>
 </div>
 )}
 <p
 className="font-display text-base font-semibold leading-snug text-[var(--color-ink)] sm:text-lg"
 data-testid="operator-math-claim"
 >
 {operatorMath.claim}
 </p>
 <p
 className="mt-2 font-mono text-[12px] leading-relaxed text-[var(--color-accent)]/80"
 data-testid="operator-math-formula"
 >
 {operatorMath.formula}
 </p>
 <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-ink-muted)]">
 <span data-testid="operator-math-breakeven">
 <span className="text-[var(--color-ink-faint)]">Breakeven:</span> {operatorMath.breakeven}
 </span>
 <span className="text-[var(--color-ink-faint)]">·</span>
 <span data-testid="operator-math-digest">{operatorMath.digest}</span>
 </div>
 <p
 className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-faint)]"
 data-testid="operator-math-assumption"
 >
 <span className="text-[var(--color-ink-faint)]">Assumption:</span> {operatorMath.assumption}
 </p>
 <div className={`${compact ? 'mt-3' : 'mt-4'} flex items-center justify-end`}>
 <button
 type="button"
 onClick={() => setShowPricing(true)}
 className="inline-flex items-center gap-1.5 border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/25"
 data-testid="operator-math-cta"
 >
 Unlock Autopilot
 <span aria-hidden="true">→</span>
 </button>
 </div>
 </div>
 </div>
 <PricingOverlay
 isOpen={showPricing}
 onClose={() => setShowPricing(false)}
 />
 </div>
 );
}