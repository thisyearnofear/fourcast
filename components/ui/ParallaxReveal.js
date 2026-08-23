'use client';

import { useEffect, useRef } from 'react';

/**
 * ParallaxReveal — intersection-driven fade + scroll-driven parallax.
 *
 * Fades content in on first intersection, then shifts it subtly with scroll
 * for depth (higher `speed` = more shift, for layered depth planes). All
 * scroll work is rAF-coalesced and writes the transform directly — no
 * per-scroll React re-renders.
 *
 * Progressive enhancement: content renders fully visible; JS hides it only
 * to run the entrance, so no-JS and reduced-motion users lose nothing.
 * Reduced motion skips the effect entirely (design.md: displacement goes,
 * content stays).
 *
 * Usage:
 *   <ParallaxReveal speed={0.1} className="px-4 sm:px-6 lg:px-8">
 *     <MyCard />
 *   </ParallaxReveal>
 */
export default function ParallaxReveal({ children, speed = 0.15, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return undefined;

    let frame = 0;
    let visible = false;

    const apply = () => {
      frame = 0;
      if (!visible) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the element's top sits at the viewport bottom, 1 when it
      // reaches the top. The shift is small and always upward — a depth
      // plane, not scroll theater.
      const progress = Math.max(0, Math.min(1, 1 - rect.top / vh));
      const y = -(progress * speed * 60);
      node.style.transform = y < -0.5 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : '';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true;
          node.style.opacity = '1';
          observer.disconnect();
          onScroll();
        }
      },
      { threshold: 0.1 },
    );

    // Hide only once JS is live, then reveal on intersection.
    node.style.opacity = '0';
    node.style.transition = 'opacity 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
    observer.observe(node);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      node.style.transform = '';
      node.style.opacity = '';
      node.style.transition = '';
    };
  }, [speed]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
