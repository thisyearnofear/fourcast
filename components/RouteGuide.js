'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';

/**
 * RouteGuide — per-route first-run guide for the flagship routes.
 *
 * Replaces the single site-wide FirstRunBanner pattern with route-aware copy.
 * Each route has its own localStorage dismissal key, so a visitor who dismisses
 * the guide on /agent still sees it on /world-cup and /positions. A shared
 * "tour" key lets the "Replay the tour" entry in PageNav re-show every guide.
 *
 * Routes: 'agent' | 'world-cup' | 'positions'
 */

const STORAGE_PREFIX = 'fourcast_route_guide_';
const TOUR_RESET_KEY = 'fourcast_route_guide_tour_reset';

/**
 * Per-route guide content. Each entry is a 3-step "what this page proves in
 * 30 seconds" tour — the same shape as FirstRunBanner but scoped to the
 * flagship narrative (Mandate → Proof Theatre → Diligence).
 */
const ROUTE_GUIDES = {
  agent: {
    title: 'Mandate Control — 30 seconds',
    steps: [
      'The hero shows the agent’s current mandate: a versioned policy, a live decision, and the proof timeline crossing from "outcome withheld" into "proof available".',
      'The proof timeline is real — it eagerly fetches the canonical verification chain so the on-chain Solana verdict is shown, not a placeholder.',
      'Operator controls are demoted to a drawer. The autonomous system is the protagonist; the manual runner is a capability for investigation.',
    ],
    footnote: 'Every decision — manual or autonomous — is sealed into a hash-bound receipt in the ledger below.',
  },
  'world-cup': {
    title: 'Proof Theatre — 30 seconds',
    steps: [
      'Pick any finalised fixture to open the vertical 6-stage evidence timeline: pre-match evidence → seeded simulation → versioned policy gates → immutable receipt → TxLINE Merkle proof + Solana validation → reconciliation.',
      '“Verify proof” walks the full chain in one call via /api/worldcup/verify — receipt integrity, Merkle root, PDA derivation, and on-chain root compare.',
      'Finalised matches with a proof also surface on-chain settlement via the match-escrow program (CPI → txoracle::validate_stat).',
    ],
    footnote: 'No wallet needed to audit. The proof chain is the product.',
  },
  positions: {
    title: 'Allocator Diligence — 30 seconds',
    steps: [
      'The hero is behaviour, not performance: mandate adherence, receipt coverage, decision discipline rate, and calibration after resolution.',
      'Every number recomputes from the same public decision receipts the operator sealed pre-outcome — not self-reported P&L.',
      'Positions and P&L are demoted to a secondary section. An allocator’s first question is “is this operator disciplined?”, not “did they make money?”',
    ],
    footnote: 'This is the surface an allocator audits before letting an operator touch capital.',
  },
};

/**
 * Read whether a route guide should be visible.
 * Hidden when: explicitly dismissed for this route, OR a tour-reset signal
 * has not been consumed yet (PageNav's "Replay the tour" sets the signal).
 */
function readVisible(route) {
  if (typeof window === 'undefined') return false;
  try {
    // Tour reset: when PageNav sets TOUR_RESET_KEY, all route guides re-show
    // once and then clear the signal.
    const reset = window.localStorage.getItem(TOUR_RESET_KEY);
    if (reset) {
      window.localStorage.removeItem(STORAGE_PREFIX + route);
      window.localStorage.removeItem(TOUR_RESET_KEY);
      return true;
    }
    return window.localStorage.getItem(STORAGE_PREFIX + route) !== '1';
  } catch {
    return false;
  }
}

function dismissRoute(route) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + route, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Re-show every route guide on the next visit to each route. Called by
 * PageNav's "Replay the tour" entry. Exported so PageNav can import it
 * without coupling to the storage key format.
 */
export function replayTour() {
  try {
    window.localStorage.setItem(TOUR_RESET_KEY, '1');
  } catch {
    /* ignore */
  }
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
    <div className="mb-8 overflow-hidden border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300/80" />
            <p className="font-display text-sm font-semibold text-emerald-100">
              {guide.title}
            </p>
          </div>
          <ol className="mt-2.5 space-y-1.5 text-sm text-white/65">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 font-mono text-emerald-300/80 shrink-0">{i + 1}</span>
                <span className="leading-6">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-white/40">{guide.footnote}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissRoute(route);
            setVisible(false);
          }}
          className="inline-flex items-center gap-1 border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/60 hover:text-white"
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
