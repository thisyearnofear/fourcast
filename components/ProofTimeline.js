'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInView } from '@/hooks/useInView';

/**
 * ProofTimeline — scroll-driven proof lifecycle.
 *
 * Horizontal node chain: decide → gate → size → seal → settle. As the
 * section scrolls through the viewport the chain "proves itself" left to
 * right — each node completes in turn (sealed amber → settled emerald),
 * which is the signature motion from design.md (proof progression from
 * sealed evidence to reconciliation) made scroll-driven.
 *
 * The final node is a real <button> that expands the verified receipt via
 * an asymmetric clip-path reveal (codrops EaseReverseClipMenu feel, built
 * dep-free with CSS transitions: slow unfold on open, fast snap on close).
 *
 * Reduced motion: the chain lands fully reconciled, receipt toggles without
 * displacement. Reuses the existing fc-proof-chain CSS vocabulary.
 */

const STEPS = [
  { key: 'decide', label: 'Decide', icon: '◉', detail: 'Agent scans markets, evaluates edge against policy.' },
  { key: 'gate', label: 'Gate', icon: '⬡', detail: 'Five-gate policy check: slippage, mandate, risk.' },
  { key: 'size', label: 'Kelly-size', icon: '⬢', detail: 'Optimal position sizing under Kelly criterion.' },
  { key: 'seal', label: 'Seal', icon: '◆', detail: 'Receipt hash committed before outcome resolves.' },
  { key: 'settle', label: 'Settle', icon: '◈', detail: 'On-chain settlement. Proof reconciled.' },
];

// Canonical Solana receipt — lives inside the "Settle" node.
const RECEIPT = {
  fixtureId: '18175981',
  fixture: 'France v Sweden',
  stage: 'World Cup · Round of 32',
  score: '3–0',
  escrow: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
  tx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};

export default function ProofTimeline() {
  const [ref, inView] = useInView({ threshold: 0.25 });
  const chainRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [complete, setComplete] = useState(0); // how many nodes are reconciled
  const reducedRef = useRef(false);

  // Detect reduced motion once on mount.
  useEffect(() => {
    reducedRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedRef.current) setComplete(STEPS.length);
  }, []);

  // Scroll-scrubbed progression: as the chain travels through the viewport,
  // nodes complete in sequence. rAF-coalesced; skipped under reduced motion.
  useEffect(() => {
    if (reducedRef.current) return undefined;
    const node = chainRef.current;
    if (!node || typeof window === 'undefined') return undefined;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the chain's top hits the viewport bottom, 1 when its bottom
      // clears ~40% up the viewport. Clamp to [0,1].
      const raw = (vh - rect.top) / (vh * 0.6 + rect.height);
      const t = Math.min(1, Math.max(0, raw));
      setComplete(Math.round(t * STEPS.length));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activeIdx = Math.min(complete, STEPS.length - 1);

  return (
    <section ref={ref} aria-label="Proof lifecycle">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
        A receipt you can open
      </p>

      <div className="mt-3">
        {/* Node chain — draws in on reveal, reconciles as you scroll. */}
        <div
          ref={chainRef}
          className={`fc-proof-chain ${inView ? 'is-visible' : ''}`}
        >
          <div className="fc-proof-chain__rail flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((step, i) => {
              const isComplete = i < complete;
              const isActive = i === activeIdx && !isComplete;
              const isSettle = step.key === 'settle';
              return (
                <button
                  key={step.key}
                  type="button"
                  style={{ '--node-delay': `${i * 90}ms` }}
                  className={[
                    'fc-proof-chain__node',
                    isActive ? 'is-active' : '',
                    isComplete ? 'is-complete' : '',
                  ].join(' ').trim()}
                  onClick={() => isSettle && setExpanded((v) => !v)}
                  aria-expanded={isSettle ? expanded : undefined}
                  aria-label={
                    isSettle
                      ? expanded
                        ? 'Hide settlement receipt'
                        : 'View settlement receipt'
                      : step.label
                  }
                >
                  <span className="fc-proof-chain__icon" aria-hidden>
                    {step.icon}
                  </span>
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-ink-faint)] sm:inline">
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="fc-proof-chain__line" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step descriptions — compact, below the chain. Hidden on mobile (too verbose). */}
        <div className="mt-3 hidden grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5 sm:grid">
          {STEPS.map((step) => (
            <div key={step.key} className="text-center sm:text-left">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                {step.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--color-ink-faint)]">
                {step.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Expanded receipt — asymmetric clip reveal (slow open, fast close). */}
        <div
          className={`fc-clip-wrap mt-4 ${expanded ? 'is-open' : ''}`}
          aria-hidden={!expanded}
        >
          <div>
            <div className="fc-clip border border-[var(--color-rule)] bg-[var(--color-wash-soft)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                {RECEIPT.stage}
              </p>
              <p className="mt-1 font-display text-base font-semibold text-[var(--color-ink)]">
                {RECEIPT.fixture}{' '}
                <span className="font-mono text-[var(--color-accent)]">{RECEIPT.score}</span>
              </p>
              <p className="mt-2 max-w-lg text-xs leading-5 text-[var(--color-ink-muted)]">
                Escrow settled via match-escrow CPI. Receipt committed before the outcome.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/proof?chain=solana&fixture=${RECEIPT.fixtureId}`}
                  className="fc-action inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  Open receipt
                </Link>
                <a
                  href={`https://explorer.solana.com/tx/${RECEIPT.tx}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-nav-link no-underline inline-flex items-center gap-1.5 px-3 py-2 text-[10px]"
                >
                  Settlement tx
                </a>
              </div>

              {/* Compact hash — collapsed by default per design.md */}
              <p className="mt-2 break-all font-mono text-[10px] text-[var(--color-ink-faint)]">
                Escrow: {RECEIPT.escrow}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
