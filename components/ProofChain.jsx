'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ProofChain — interactive walkthrough of the verification pipeline.
 *
 * Replaces a static paragraph with a horizontal step rail. Each step
 * lights up sequentially on a 2.5s timer, showing a brief explanation
 * of what happened at that stage. Hover/focus jumps to that step
 * immediately (progressive disclosure: the chain is visible as nodes,
 * but detail only appears on interaction or auto-cycle).
 *
 * Falls back to all-steps-visible under reduced motion.
 */

const STEPS = [
  {
    label: 'Pre-match evidence',
    detail: 'Venue, fixture, and team form collected and hashed before kickoff.',
    icon: '◐',
  },
  {
    label: 'Seeded simulation',
    detail: '200+ ML models produce a fair-value probability under a fixed seed.',
    icon: '◑',
  },
  {
    label: 'Policy gates',
    detail: 'Versioned policy checks edge threshold, Kelly size, and risk limits.',
    icon: '◒',
  },
  {
    label: 'SHA-256 receipt',
    detail: 'Decision sealed into an immutable hash before the outcome is known.',
    icon: '◓',
  },
  {
    label: 'Merkle proof',
    detail: 'Receipt anchored into a TxLINE Merkle tree for public auditability.',
    icon: '●',
  },
  {
    label: 'Solana validation',
    detail: 'match-escrow CPI calls txoracle::validate_stat on-chain. No intermediary.',
    icon: '◆',
  },
  {
    label: 'Reconciliation',
    detail: 'Outcome resolved, receipt matched, reputation updated from the same proof.',
    icon: '✓',
  },
];

const CYCLE_MS = 2500;

export default function ProofChain() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(0);

  // Reveal on scroll into view.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      setActive(STEPS.length - 1);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Auto-cycle through steps once visible.
  useEffect(() => {
    if (!visible) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setActive(STEPS.length - 1);
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, CYCLE_MS);

    return () => window.clearInterval(timerRef.current);
  }, [visible]);

  const goTo = (idx) => {
    setActive(idx);
    window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, CYCLE_MS);
  };

  return (
    <div ref={containerRef} className="fc-proof-chain mt-4">
      {/* Step rail */}
      <div className="fc-proof-chain__rail flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const isActive = i === active;
          const isComplete = visible && i < active;
          return (
            <button
              key={step.label}
              type="button"
              onMouseEnter={() => goTo(i)}
              onFocus={() => goTo(i)}
              className={`fc-proof-chain__node ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
              aria-label={step.label}
            >
              <span className="fc-proof-chain__icon">{step.icon}</span>
              <span className="fc-proof-chain__line" />
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="fc-proof-chain__detail mt-3 min-h-[3rem] border-t border-white/8 pt-3">
        <div key={active} className="fc-market-slide">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300/60">
            Step {active + 1} / {STEPS.length}
          </span>
          <p className="mt-1 text-sm font-medium text-white/80">
            {STEPS[active].label}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-white/50">
            {STEPS[active].detail}
          </p>
        </div>
      </div>
    </div>
  );
}
