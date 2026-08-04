'use client';

import { useState, useRef, useEffect, useId } from 'react';

/**
 * Plain-language explanations for the quant/prediction-market jargon used
 * across the app. One definition per term, written for a first-time user.
 */
export const GLOSSARY = {
 edge: {
 title: 'Edge',
 body: 'The gap between what the AI thinks the true probability is and the price the market is charging. A +8% edge means the market looks 8 points too cheap — that gap is the profit opportunity.',
 },
 brier: {
 title: 'Brier score',
 body: 'How accurate past probability calls were, from 0 (perfect) to 1 (always wrong). Under 0.15 is sharp; a coin-flipper scores 0.25. Lower is better.',
 },
 kelly: {
 title: 'Kelly sizing',
 body: 'A formula for how much of your bankroll to stake so you grow it fastest without going bust. Bigger edge and higher confidence → bigger suggested position.',
 },
 confidence: {
 title: 'Confidence',
 body: 'How much evidence backs this call. HIGH = multiple strong sources agree. LOW = thin or conflicting evidence — treat the number as a hunch, not a signal.',
 },
 fairProbability: {
 title: 'Fair probability',
 body: 'The AI\'s own estimate of how likely this event is, built from live web evidence — independent of what the market currently charges.',
 },
 mandate: {
 title: 'Mandate',
 body: 'The written policy your agent runs under: minimum edge, max position size, and loss limits. Versioned and public, so anyone can verify the agent stayed inside its own rules.',
 },
 sealedReceipt: {
 title: 'Sealed receipt',
 body: 'When a call is made, the AI\'s evidence, fair odds, and risk decision are hashed and timestamped on-chain before the outcome is known. Nobody can rewrite history afterwards.',
 },
 calibration: {
 title: 'Calibration',
 body: 'Do stated probabilities match real-world frequency? An analyst who says 70% should be right about 7 times out of 10. Good calibration means you can trust the number, not just the narrative.',
 },
 diligence: {
 title: 'Track record',
 body: 'The audited behaviour record: policy adherence, receipt coverage, and calibration — computed from public receipts, not self-reported P&L.',
 },
 arbitrage: {
 title: 'Arbitrage',
 body: 'The same question priced differently on two venues (e.g. Polymarket vs Kalshi). Buying the cheap side and selling the expensive side locks in the difference.',
 },
};

/**
 * InfoTip — a small, keyboard-accessible "?" popover for explaining jargon.
 *
 * Unlike hover-only tooltips, this is a real button: it works with keyboard
 * (Enter/Space toggles, Escape closes), touch, and screen readers.
 *
 * @param {string} term - key into GLOSSARY, or omit and pass title/body directly
 * @param {string} [title] - custom title (overrides glossary)
 * @param {string} [body] - custom body (overrides glossary)
 * @param {boolean} [isNight=true]
 */
export default function InfoTip({ term, title, body, isNight = true, className = '' }) {
 const [open, setOpen] = useState(false);
 const ref = useRef(null);
 const id = useId();

 const entry = term ? GLOSSARY[term] : null;
 const tipTitle = title || entry?.title || '';
 const tipBody = body || entry?.body || '';

 useEffect(() => {
 if (!open) return;
 function onKey(e) {
 if (e.key === 'Escape') setOpen(false);
 }
 function onClick(e) {
 if (ref.current && !ref.current.contains(e.target)) setOpen(false);
 }
 document.addEventListener('keydown', onKey);
 document.addEventListener('mousedown', onClick);
 return () => {
 document.removeEventListener('keydown', onKey);
 document.removeEventListener('mousedown', onClick);
 };
 }, [open]);

 if (!tipBody) return null;

 return (
 <span ref={ref} className={`relative inline-flex ${className}`}>
 <button
 type="button"
 onClick={() => setOpen((o) => !o)}
 aria-expanded={open}
 aria-controls={id}
 aria-label={`What is ${tipTitle}?`}
 className={`inline-flex items-center justify-center w-4 h-4 text-[10px] leading-none border transition-colors align-middle border-[var(--color-rule-strong)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-rule)]0`}
 >
 ?
 </button>
 {open && (
 <span
 id={id}
 role="tooltip"
 className={`absolute z-50 left-1/2 -translate-x-1/2 top-6 w-60 border p-3 text-left shadow-xl bg-[var(--color-paper-glass)] border-[var(--color-rule-strong)] text-[var(--color-ink)]`}
 >
 <span className="block text-xs font-semibold mb-1">{tipTitle}</span>
 <span className={`block text-[11px] leading-relaxed font-light text-[var(--color-ink)]`}>
 {tipBody}
 </span>
 </span>
 )}
 </span>
 );
}
