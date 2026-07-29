'use client';

import { useEffect, useRef } from 'react';

/**
 * useParallax — shifts an element vertically as the page scrolls, clamped
 * so the shift never exceeds `max` pixels.
 *
 * Transform-only (translate3d) and rAF-coalesced: one write per frame while
 * scrolling, idle otherwise. Writes are skipped when the value moved less
 * than half a pixel. Bails entirely under reduced motion.
 *
 * @param {object} [options]
 * @param {number} [options.factor=-0.05] - px shift per px scrolled
 * @param {number} [options.max=40] - absolute clamp in px
 * @returns {React.RefObject} ref to attach to the target element
 */
export function useParallax({ factor = -0.05, max = 40 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    let frame = 0;
    let lastY = Infinity;

    const apply = () => {
      frame = 0;
      const y = Math.max(-max, Math.min(max, window.scrollY * factor));
      if (Math.abs(y - lastY) < 0.5) return;
      lastY = y;
      node.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      node.style.transform = '';
    };
  }, [factor, max]);

  return ref;
}

export default useParallax;
