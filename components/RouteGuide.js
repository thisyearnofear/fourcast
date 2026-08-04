'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';
import { dismissGuide, isGuideDismissed, resetTour } from '@/lib/tourState';

/**
 * RouteGuide — per-route first-run guide for the flagship routes.
 *
 * Replaces the single site-wide FirstRunBanner pattern with route-aware copy.
 * Dismissal state lives in the unified tour object (lib/tourState.js) shared
 * with FirstRunBanner, so "Replay the tour" in PageNav re-shows every guide
 * (banner + routes) from one storage key.
 *
 * Routes: 'agent' | 'world-cup' | 'positions'
 */

// Tour visibility/dismissal lives in one unified storage object — see
// lib/tourState.js (replaces the old per-route + banner + reset keys).

/**
 * Per-route guide content. Each entry is a 3-step "what this page proves in
 * 30 seconds" tour — the same shape as FirstRunBanner but scoped to the
 * Venue narrative (Markets → act → Positions; Private for Canton).
 */
const ROUTE_GUIDES = {
  agent: {
    title: 'Mandate — 30 seconds',
    steps: [
      'See the current mandate: versioned policy, live decision, proof timeline.',
      'The proof timeline fetches the real verification chain — Solana verdict when available.',
      'Operator controls sit in a drawer; the agent loop is the protagonist.',
    ],
    footnote: 'Every decision seals into a hash-bound receipt below.',
  },
  'world-cup': {
    title: 'Decision receipts — 30 seconds',
    steps: [
      'Pick a finalised fixture for the 6-stage evidence timeline.',
      'Verify walks the full chain in one call — receipt, Merkle, PDA, on-chain root.',
      'Settled fixtures surface match-escrow CPI settlement when available.',
    ],
    footnote: 'No wallet needed to audit.',
  },
  positions: {
    title: 'Positions — 30 seconds',
    steps: [
      'Public tab: track record from sealed receipts.',
      'Private tab: Canton positions — connect wallet to settle.',
      'Settle is holder-signed when a market resolves.',
    ],
    footnote: 'Public reputation and private CBTC in one place.',
  },
};

function readVisible(route) {
  if (typeof window === 'undefined') return false;
  return !isGuideDismissed(route);
}

/**
 * Re-show every route guide on the next visit to each route. Called by
 * PageNav's "Replay the tour" entry. Kept as a thin alias so PageNav's
 * import stays source-compatible.
 */
export function replayTour() {
  resetTour();
}

export default function RouteGuide({ route }) {
  const [visible, setVisible] = useState(false);
  const guide = ROUTE_GUIDES[route];

  useEffect(() => {
    if (!guide) return;
    // Defer to after mount so localStorage is readable in the browser only.
    setVisible(readVisible(route));
  }, [route, guide]);

  // Re-check when the window regains focus — lets a tour reset triggered on
  // another route/page take effect without a hard reload.
  useEffect(() => {
    if (!guide) return undefined;
    const onFocus = () => setVisible(readVisible(route));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [route, guide]);

  if (!guide || !visible) return null;

  return (
    <div className="mb-8 overflow-hidden border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.07] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]/80" />
            <p className="font-display text-sm font-semibold text-[var(--color-accent)]">
              {guide.title}
            </p>
          </div>
          <ol className="mt-2.5 space-y-1.5 text-sm text-[var(--color-ink-muted)]">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 font-mono text-[var(--color-accent)]/80 shrink-0">{i + 1}</span>
                <span className="leading-6">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">{guide.footnote}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissGuide(route);
            setVisible(false);
          }}
          className="inline-flex items-center gap-1 border border-[var(--color-rule)] bg-[var(--color-paper-deep)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          <X className="h-3 w-3" />
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * TourLink — the "Replay the tour" entry rendered in PageNav. Sets the
 * shared reset signal and navigates to /agent to start the tour.
 */
export function TourLink({ className = '' }) {
  return (
    <Link
      href="/agent"
      onClick={replayTour}
      className={`mc-nav-link no-underline inline-flex items-center gap-1.5 ${className}`}
      title="Re-show the route guides on /agent, /world-cup, and /positions"
    >
      <Sparkles className="h-3 w-3" />
      Replay the tour
    </Link>
  );
}
