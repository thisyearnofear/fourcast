'use client';

import { useEffect, useRef } from 'react';

/**
 * MagneticButton — cursor-responsive control.
 *
 * While the pointer is over the control it leans toward the cursor with a
 * configurable intensity, then springs back to center on leave. The
 * transform is written directly to the element (rAF-coalesced) instead of
 * re-rendering React on every pointermove.
 *
 * design.md: hover movement runs only on fine-pointer devices; reduced
 * motion removes displacement entirely.
 *
 * Usage:
 *   <MagneticButton as={Link} href="/arena" intensity={0.25}>
 *     Watch it decide <ArrowRight />
 *   </MagneticButton>
 */
export default function MagneticButton({ children, className, intensity = 0.3, as: Tag = 'button', ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return undefined;

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return undefined;

    let frame = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      frame = 0;
      el.style.transform = tx || ty ? `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)` : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      tx = (e.clientX - (rect.left + rect.width / 2)) * intensity;
      ty = (e.clientY - (rect.top + rect.height / 2)) * intensity;
      schedule();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      schedule();
    };

    // The spring ease lives on the element so follow + return both feel
    // intentional (codrops EaseReverseClipMenu interaction pattern).
    el.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [intensity]);

  return (
    <Tag ref={ref} className={className} {...props}>
      {children}
    </Tag>
  );
}
