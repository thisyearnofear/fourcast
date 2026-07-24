'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * ReasoningVisualizer
 *
 * A high-fidelity "thinking" overlay that shows the AI's step-by-step
 * reasoning. Provides the "Wow" factor while the backend is processing
 * complex analysis.
 *
 * Palette discipline: per tokens.css, --color-review (violet) is semantic
 * only and not a decoration channel. The overlay uses --color-accent
 * (verification emerald) for the live computation indicator, --color-evidence
 * (evidence blue) for the step rail, and --color-sealed (sealed amber) for
 * the sealed/waiting states. Motion is constrained to transform/opacity and
 * collapses to a static layout under prefers-reduced-motion.
 */
export default function ReasoningVisualizer({
  isActive,
  onComplete,
  title = "Analyzing Market",
  steps = [],
  currentStepIndex = 0
}) {
  const [internalStep, setInternalStep] = useState(0);
  const [dots, setDots] = useState('');
  const reducedMotion = useReducedMotion();

  // Fallback simulated steps if none provided. Phase labels collapse the old
  // seven-step sequence into three real phases (Discover → Forecast → Verify)
  // tied to the actual agent pipeline rather than decorative copy.
  const getSimulatedSteps = () => {
    const marketName = title.replace('Analyzing ', '') || "Market";
    return [
      { label: `Discover · fetching consensus odds for "${marketName}"`, phase: 'discover' },
      { label: `Forecast · seeded Monte Carlo over the agent fair probability`, phase: 'forecast' },
      { label: `Verify · policy gates + hash-bound receipt sealing`, phase: 'verify' },
    ];
  };

  const activeSteps = steps.length > 0 ? steps : getSimulatedSteps();
  const displayStep = steps.length > 0 ? currentStepIndex : internalStep;

  useEffect(() => {
    if (!isActive) {
      setInternalStep(0);
      return;
    }

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    let stepInterval;
    if (steps.length === 0) {
      stepInterval = setInterval(() => {
        setInternalStep((prev) => {
          if (prev < activeSteps.length - 1) return prev + 1;
          return prev;
        });
      }, 2800);
    }

    return () => {
      clearInterval(dotsInterval);
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [isActive, steps.length, activeSteps.length]);

  if (!isActive) return null;

  const phaseColor = (phase) => {
    if (phase === 'discover') return 'var(--color-evidence)';
    if (phase === 'forecast') return 'var(--color-accent)';
    if (phase === 'verify') return 'var(--color-sealed)';
    return 'var(--color-evidence)';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div className="absolute inset-0 bg-[var(--color-paper-deep)]/60" aria-hidden />

      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-lg border border-[var(--color-rule-strong)] bg-[var(--color-paper-glass)] shadow-2xl pointer-events-auto"
        role="dialog"
        aria-label={`Reasoning trace · ${title}`}
      >
        {/* Live indicator — emerald, constrained to the active edge */}
        <div
          className="absolute top-0 left-0 right-0 h-px overflow-hidden"
          aria-hidden
        >
          <motion.div
            className="h-full w-1/3 bg-[var(--color-accent)]"
            initial={{ x: '-100%' }}
            animate={reducedMotion ? { x: 0 } : { x: ['-100%', '400%'] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        <div className="p-7 sm:p-8">
          <div className="flex items-center justify-between mb-7">
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-[var(--color-ink)]">
                {title}
                <span className="inline-block w-8 text-left ml-1 text-[var(--color-ink-muted)]">{dots}</span>
              </h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
                Agent · sealed reasoning trace
              </p>
            </div>
            <div
              className="relative flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--color-accent)]/40 bg-[var(--color-accent-quiet)] text-[var(--color-accent)]"
              aria-live="polite"
            >
              <span
                className="absolute inset-0 border border-[var(--color-accent)]/30 motion-safe:animate-pulse"
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-widest">live</span>
            </div>
          </div>

          <ol className="space-y-3">
            {activeSteps.map((step, idx) => {
              const isPast = idx < displayStep;
              const isCurrent = idx === displayStep;
              const isFuture = idx > displayStep;
              const tone = phaseColor(step.phase);
              return (
                <li
                  key={idx}
                  className={`flex items-start gap-3 border-l-2 pl-3 transition-opacity ${
                    isFuture ? 'opacity-30' : 'opacity-100'
                  }`}
                  style={{ borderColor: tone }}
                >
                  <span
                    className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[9px]"
                    style={{
                      borderColor: isPast || isCurrent ? tone : 'var(--color-rule)',
                      color: isPast || isCurrent ? tone : 'var(--color-ink-faint)',
                      background: isPast || isCurrent ? 'transparent' : 'transparent',
                    }}
                  >
                    {isPast ? '\u2713' : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-6 ${
                        isCurrent ? 'text-[var(--color-ink)]' : isPast ? 'text-[var(--color-ink-muted)]' : 'text-[var(--color-ink-faint)]'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <motion.div
                        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.18 }}
                        className="mt-2 overflow-hidden"
                      >
                        <div
                          className="h-px w-full overflow-hidden"
                          style={{ backgroundColor: 'var(--color-rule)' }}
                        >
                          <motion.div
                            className="h-full"
                            style={{ backgroundColor: tone, width: '40%' }}
                            initial={reducedMotion ? { opacity: 0.6 } : { x: '-100%' }}
                            animate={reducedMotion ? { opacity: 0.6 } : { x: ['-100%', '250%'] }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-7 flex items-center justify-between border-t border-[var(--color-rule)] pt-4 font-mono text-[10px] text-[var(--color-ink-faint)]">
            <span className="uppercase tracking-[0.16em]">Sealed trace · receipt pending</span>
            <span>est. {Math.max(0, (activeSteps.length - displayStep))} phase{activeSteps.length - displayStep === 1 ? '' : 's'} remaining</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
