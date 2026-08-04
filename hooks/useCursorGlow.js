'use client';

import { useEffect } from 'react';

/* --------------------------------------------------------------------------
   useCursorGlow — a single global pointer listener that writes --cursor-x
   / --cursor-y onto the element under the pointer, so CSS-only radial-glow
   hovers (position-record, mc-card) can follow the cursor without a
   per-element JS ref.

   Cheaper than usePointerGlow per row: one pointermove listener on document,
   coalesced into a single rAF. Bails entirely under reduced motion or on
   coarse pointers (the CSS @media gate already hides the ::after, so this
   hook is a no-op there too).

   Mount once near the app root (e.g. in AppShell or the root layout).
   -------------------------------------------------------------------------- */

export function useCursorGlow() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !finePointer) return undefined;

    let frame = 0;
    let lastTarget = null;

    const apply = (e) => {
      frame = 0;
      const target = e.target.closest('.position-record, .mc-card');
      if (!target) {
        if (lastTarget) {
          lastTarget.style.removeProperty('--cursor-x');
          lastTarget.style.removeProperty('--cursor-y');
          lastTarget = null;
        }
        return;
      }
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
      target.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
      lastTarget = target;
    };

    const onMove = (e) => {
      if (!frame) frame = window.requestAnimationFrame(() => apply(e));
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}

export default useCursorGlow;
