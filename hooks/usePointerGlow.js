'use client';

import { useEffect, useRef } from 'react';

/**
 * usePointerGlow — drives a cursor-following glow (and optional tilt) on an
 * element via CSS custom properties.
 *
 * Writes --glow-x/--glow-y (px, relative to the element) on pointermove and,
 * when `tilt` > 0, --tilt-x/--tilt-y (deg, ± tilt from center). Writes are
 * coalesced into a single rAF per frame; no loop runs between events. Bails
 * entirely under reduced motion or on coarse pointers.
 *
 * @param {object} [options]
 * @param {number} [options.tilt=0] - max tilt in degrees (0 disables tilt)
 * @returns {React.RefObject} ref to attach to the target element
 */
export function usePointerGlow({ tilt = 0 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !finePointer) return undefined;

    let frame = 0;
    let lastEvent = null;

    const apply = () => {
      frame = 0;
      if (!lastEvent) return;
      const rect = node.getBoundingClientRect();
      const x = lastEvent.clientX - rect.left;
      const y = lastEvent.clientY - rect.top;
      node.style.setProperty('--glow-x', `${x}px`);
      node.style.setProperty('--glow-y', `${y}px`);
      if (tilt > 0 && rect.width > 0 && rect.height > 0) {
        const nx = (x / rect.width) * 2 - 1;
        const ny = (y / rect.height) * 2 - 1;
        node.style.setProperty('--tilt-x', `${(-ny * tilt).toFixed(2)}deg`);
        node.style.setProperty('--tilt-y', `${(nx * tilt).toFixed(2)}deg`);
      }
    };

    const onMove = (e) => {
      lastEvent = e;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const onLeave = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastEvent = null;
      node.style.removeProperty('--glow-x');
      node.style.removeProperty('--glow-y');
      node.style.removeProperty('--tilt-x');
      node.style.removeProperty('--tilt-y');
    };

    node.addEventListener('pointermove', onMove, { passive: true });
    node.addEventListener('pointerleave', onLeave, { passive: true });
    return () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [tilt]);

  return ref;
}

export default usePointerGlow;
